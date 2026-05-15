"""
apps/sharing/tasks.py
═══════════════════════════════════════════════════════════════════════════════
UPDATED VERSION
───────────────────────────────────────────────────────────────────────────────
Changes:
  ✓ Removed hardcoded custom queue ('file_scan')
  ✓ Works with normal Celery worker command:
        celery -A config worker -l info
  ✓ Better logging
  ✓ Safer fallback execution
  ✓ Keeps retry support
  ✓ Keeps periodic recovery tasks
═══════════════════════════════════════════════════════════════════════════════
"""

import logging
import math
import os
import re
import tempfile
import zipfile

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Configuration ─────────────────────────────────────────────────────────────

MAX_SCAN_BYTES = 10 * 1024 * 1024
ENTROPY_THRESHOLD = 7.5
ZIP_RATIO_LIMIT = 100
RETRY_DELAYS = [30, 120, 480]

STATIC_BLOCKED_HASHES: set[str] = {
    '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
    '131f95c51cc819465fa1797f6ccacf9d494aaaff46fa3eac73ae63ffbdfd8267',
}

BLOCKED_MIME_TYPES = {
    'application/x-msdownload',
    'application/x-executable',
    'application/x-dosexec',
    'application/x-elf',
    'application/x-mach-binary',
    'application/x-bat',
    'application/x-sh',
    'application/x-shellscript',
    'text/x-shellscript',
    'application/x-msi',
    'application/x-ms-installer',
    'application/x-java-archive',
    'application/vnd.android.package-archive',
}

BLOCKED_EXTENSIONS = {
    'exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'msi',
    'dll', 'com', 'scr', 'pif', 'reg', 'hta',
    'jar', 'apk', 'elf', 'deb', 'rpm',
    'dmg', 'pkg', 'app', 'run', 'bin',
}

DANGEROUS_SIGNATURES: list[tuple[int, bytes, str]] = [
    (0, b'MZ', 'Windows PE executable'),
    (0, b'\x7fELF', 'Linux ELF executable'),
    (0, b'\xca\xfe\xba\xbe', 'Mach-O fat binary'),
    (0, b'\xce\xfa\xed\xfe', 'Mach-O 32-bit binary'),
    (0, b'\xcf\xfa\xed\xfe', 'Mach-O 64-bit binary'),
    (0, b'#!/', 'Script with shebang'),
    (0, b'#! /', 'Script with shebang'),
]

MALICIOUS_PATTERNS: list[tuple[re.Pattern, str]] = [
    (
        re.compile(rb'(?i)CreateObject\s*\(\s*["\']WScript\.Shell["\']'),
        'VBS/VBA WScript.Shell invocation',
    ),
    (
        re.compile(rb'(?i)powershell\s+-(?:enc|EncodedCommand|nop|NonInteractive|W\s+Hidden)'),
        'PowerShell encoded/hidden execution',
    ),
    (
        re.compile(rb'(?i)cmd\.exe\s+/[cCkK]'),
        'CMD shell execution',
    ),
    (
        re.compile(rb'(?i)eval\s*\(\s*(?:base64_decode|gzinflate|str_rot13)'),
        'PHP obfuscated eval',
    ),
    (
        re.compile(rb'(?i)EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
        'EICAR test file',
    ),
    (
        re.compile(rb'(?i)AutoOpen|Auto_Open|Document_Open|Workbook_Open'),
        'Office auto-execution macro',
    ),
    (
        re.compile(rb'(?i)Shell\s*\(["\'](?:cmd|powershell|wscript|cscript)'),
        'VBA Shell() execution',
    ),
]


# ── Public dispatcher ─────────────────────────────────────────────────────────

def dispatch_scan(file_id: str) -> bool:
    """
    Queue scan using Celery.

    Falls back to synchronous execution if Redis/Celery is unavailable.

    Returns:
        True  -> async queued
        False -> synchronous fallback executed
    """

    try:
        scan_uploaded_file.apply_async(
            args=[str(file_id)],
            countdown=1,
        )

        logger.info(
            'dispatch_scan: queued async scan file_id=%s',
            file_id,
        )

        return True

    except Exception as broker_err:

        logger.warning(
            'dispatch_scan: broker unavailable (%s). '
            'Running synchronous scan for file_id=%s',
            broker_err,
            file_id,
        )

        try:
            _run_scan(file_id)

        except Exception:
            logger.exception(
                'dispatch_scan: synchronous scan failed file_id=%s',
                file_id,
            )

        return False


# ── Celery task ───────────────────────────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name='sharing.scan_uploaded_file',
    acks_late=True,
    reject_on_worker_lost=True,
)
def scan_uploaded_file(self, file_id: str):

    attempt = self.request.retries

    logger.info(
        'scan_uploaded_file: START file_id=%s retry=%s',
        file_id,
        attempt,
    )

    try:
        _run_scan(file_id)

    except Exception as exc:

        logger.exception(
            'scan_uploaded_file: unexpected error file_id=%s retry=%s',
            file_id,
            attempt,
        )

        retry_delay = RETRY_DELAYS[
            min(attempt, len(RETRY_DELAYS) - 1)
        ]

        try:
            raise self.retry(
                exc=exc,
                countdown=retry_delay,
            )

        except self.MaxRetriesExceededError:

            from apps.files.models import File

            try:
                file_obj = File.objects.get(pk=file_id)

                _mark_result(
                    file_obj,
                    File.ScanStatus.SCAN_FAILED,
                    f'Max retries exceeded: {exc}',
                )

            except Exception:
                logger.exception(
                    'Failed updating final scan status file_id=%s',
                    file_id,
                )


# ── Core scan logic ───────────────────────────────────────────────────────────

def _run_scan(file_id: str) -> None:

    from apps.files.models import File

    try:
        file_obj = File.objects.get(pk=file_id)

    except File.DoesNotExist:
        logger.error('_run_scan: file not found file_id=%s', file_id)
        return

    except Exception:
        logger.exception('_run_scan: DB error file_id=%s', file_id)
        return

    logger.info(
        '_run_scan: processing file_id=%s current_status=%s',
        file_id,
        file_obj.scan_status,
    )

    try:
        File.objects.filter(pk=file_id).update(
            scan_status=File.ScanStatus.SCANNING,
            scanned_at=None,
        )

        file_obj.scan_status = File.ScanStatus.SCANNING

    except Exception:
        logger.exception(
            '_run_scan: failed setting SCANNING file_id=%s',
            file_id,
        )

    file_path, tmp_file = _resolve_path(file_obj)

    if not file_path:

        _mark_result(
            file_obj,
            File.ScanStatus.SCAN_FAILED,
            'File not accessible for scanning',
        )

        return

    try:

        threat, detail = _full_scan(file_path, file_obj)

        if threat == 'INFECTED':

            _mark_result(
                file_obj,
                File.ScanStatus.INFECTED,
                detail,
            )

            logger.warning(
                '_run_scan: INFECTED file_id=%s reason=%s',
                file_id,
                detail,
            )

        elif threat == 'SCAN_FAILED':

            _mark_result(
                file_obj,
                File.ScanStatus.SCAN_FAILED,
                detail,
            )

        else:

            _mark_result(
                file_obj,
                File.ScanStatus.SAFE,
                'All security checks passed',
            )

            logger.info(
                '_run_scan: SAFE file_id=%s',
                file_id,
            )

    except Exception as exc:

        _mark_result(
            file_obj,
            File.ScanStatus.SCAN_FAILED,
            f'Unexpected scan error: {exc}',
        )

        raise

    finally:

        if tmp_file:
            try:
                if os.path.exists(tmp_file):
                    os.unlink(tmp_file)
            except Exception:
                pass


# ── Scan pipeline ─────────────────────────────────────────────────────────────

def _full_scan(file_path: str, file_obj):

    checks = [
        lambda: _check_extension(
            file_obj.original_name or os.path.basename(file_path)
        ),
        lambda: _check_magic_bytes(file_path),
        lambda: _check_mime_consistency(
            file_path,
            file_obj.mime_type or '',
        ),
        lambda: _check_hash_blocklist(file_path, file_obj),
        lambda: _check_archive_bomb(file_path),
        lambda: _check_malicious_patterns(file_path),
        lambda: _check_entropy(file_path),
    ]

    for check in checks:

        result = check()

        if result:
            return 'INFECTED', result

    return 'SAFE', 'All security checks passed'


# ── Individual checks ─────────────────────────────────────────────────────────

def _check_extension(filename: str):

    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''

    if ext in BLOCKED_EXTENSIONS:
        return f'Blocked extension: .{ext}'

    return None


def _check_magic_bytes(file_path: str):

    try:

        with open(file_path, 'rb') as f:
            header = f.read(16)

        for offset, sig, desc in DANGEROUS_SIGNATURES:

            if header[offset:offset + len(sig)] == sig:
                return f'Dangerous signature: {desc}'

    except Exception as exc:
        logger.warning('_check_magic_bytes: %s', exc)

    return None


def _check_mime_consistency(file_path: str, stored_mime: str):

    try:
        import magic as libmagic

        detected = libmagic.from_file(
            file_path,
            mime=True,
        ) or ''

    except ImportError:
        return None

    except Exception as exc:
        logger.warning('_check_mime_consistency: %s', exc)
        return None

    if detected in BLOCKED_MIME_TYPES:
        return f'Dangerous MIME type: {detected}'

    if stored_mime and detected:

        if (
            detected.split('/')[0] == 'application'
            and stored_mime.split('/')[0] in ('image', 'audio', 'video')
        ):
            return (
                f'MIME mismatch: '
                f'claimed {stored_mime}, actual {detected}'
            )

    return None


def _check_hash_blocklist(file_path: str, file_obj):

    import hashlib

    try:

        sha = hashlib.sha256()

        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                sha.update(chunk)

        digest = sha.hexdigest()

        try:
            if hasattr(file_obj, 'sha256') and not file_obj.sha256:

                type(file_obj).objects.filter(
                    pk=file_obj.pk
                ).update(sha256=digest)

                file_obj.sha256 = digest

        except Exception:
            pass

        if digest in STATIC_BLOCKED_HASHES:
            return f'Known malicious hash: {digest[:16]}...'

    except Exception as exc:
        logger.warning('_check_hash_blocklist: %s', exc)

    return None


def _check_archive_bomb(file_path: str):

    if not zipfile.is_zipfile(file_path):
        return None

    try:

        compressed = os.path.getsize(file_path)

        if not compressed:
            return None

        total = 0

        with zipfile.ZipFile(file_path, 'r') as zf:

            members = zf.infolist()

            if len(members) > 10000:
                return f'Too many archive entries: {len(members)}'

            for member in members:

                total += member.file_size

                if total > 5 * 1024 * 1024 * 1024:
                    return 'Archive bomb: uncompressed > 5GB'

        if (total / compressed) > ZIP_RATIO_LIMIT:
            return f'Archive bomb ratio: {total // compressed}:1'

    except zipfile.BadZipFile:
        return None

    except Exception as exc:
        logger.warning('_check_archive_bomb: %s', exc)

    return None


def _check_malicious_patterns(file_path: str):

    try:

        with open(file_path, 'rb') as f:
            raw = f.read(MAX_SCAN_BYTES)

        for pattern, desc in MALICIOUS_PATTERNS:

            if pattern.search(raw):
                return f'Malicious pattern: {desc}'

    except Exception as exc:
        logger.warning('_check_malicious_patterns: %s', exc)

    return None


def _check_entropy(file_path: str):

    SKIP = {
        'zip', 'gz', 'tar', 'bz2', '7z', 'rar',
        'jpg', 'jpeg', 'png', 'gif', 'webp',
        'mp4', 'mp3', 'wav', 'pdf',
    }

    try:

        ext = file_path.rsplit('.', 1)[-1].lower()

        if ext in SKIP:
            return None

        with open(file_path, 'rb') as f:
            data = f.read(MAX_SCAN_BYTES)

        if len(data) < 512:
            return None

        entropy = _shannon_entropy(data)

        if entropy > ENTROPY_THRESHOLD:
            return f'Suspicious entropy: {entropy:.2f}'

    except Exception as exc:
        logger.warning('_check_entropy: %s', exc)

    return None


def _shannon_entropy(data: bytes) -> float:

    if not data:
        return 0.0

    freq = [0] * 256

    for byte in data:
        freq[byte] += 1

    n = len(data)

    return -sum(
        (count / n) * math.log2(count / n)
        for count in freq if count
    )


# ── Helpers ───────────────────────────────────────────────────────────────────

def _resolve_path(file_obj):

    try:

        if not file_obj.file or not file_obj.file.name:
            return None, None

        try:

            path = file_obj.file.path

            if os.path.exists(path):
                return path, None

        except NotImplementedError:
            pass

        suffix = os.path.splitext(file_obj.file.name)[-1] or '.bin'

        tmp = tempfile.NamedTemporaryFile(
            delete=False,
            suffix=suffix,
            prefix='scan_',
        )

        with file_obj.file.open('rb') as src:

            while chunk := src.read(65536):
                tmp.write(chunk)

        tmp.flush()
        tmp.close()

        return tmp.name, tmp.name

    except Exception as exc:

        logger.warning('_resolve_path: %s', exc)

        return None, None


def _mark_result(file_obj, scan_status, message: str):

    try:

        type(file_obj).objects.filter(pk=file_obj.pk).update(
            scan_status=scan_status,
            scan_result=message[:1000],
            scanned_at=timezone.now(),
        )

        logger.info(
            '_mark_result: file_id=%s status=%s',
            file_obj.pk,
            scan_status,
        )

    except Exception:
        logger.exception(
            '_mark_result failed file_id=%s',
            file_obj.pk,
        )


# ── Periodic tasks ────────────────────────────────────────────────────────────

@shared_task(name='sharing.expire_old_shares')
def expire_old_shares():

    from .models import FileShare, ZipShare

    now = timezone.now()

    fs = FileShare.objects.filter(
        status=FileShare.Status.ACTIVE,
        expires_at__lt=now,
    ).update(status=FileShare.Status.EXPIRED)

    zs = ZipShare.objects.filter(
        status=ZipShare.Status.ACTIVE,
        expires_at__lt=now,
    ).update(status=ZipShare.Status.EXPIRED)

    logger.info(
        'expire_old_shares: file_shares=%s zip_shares=%s',
        fs,
        zs,
    )

    return {
        'file_shares_expired': fs,
        'zip_shares_expired': zs,
    }


@shared_task(name='sharing.unstick_scanning_files')
def unstick_scanning_files():

    from datetime import timedelta
    from apps.files.models import File

    cutoff = timezone.now() - timedelta(minutes=5)

    stuck = File.objects.filter(
        scan_status__in=[
            File.ScanStatus.SCANNING,
            File.ScanStatus.PENDING,
        ],
        scanned_at__isnull=True,
        created_at__lt=cutoff,
    )

    requeued = 0

    for file_obj in stuck:

        try:

            dispatch_scan(str(file_obj.id))

            requeued += 1

            logger.info(
                'unstick_scanning_files: requeued file_id=%s',
                file_obj.id,
            )

        except Exception:
            logger.exception(
                'unstick_scanning_files failed file_id=%s',
                file_obj.id,
            )

    logger.info(
        'unstick_scanning_files: total_requeued=%s',
        requeued,
    )

    return {
        'requeued': requeued,
    }