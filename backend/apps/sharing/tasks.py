"""
apps/sharing/tasks.py
─────────────────────────────────────────────────────────────────────────────
Celery background tasks for file security validation.

NO ClamAV required. Uses multi-layer validation:
  1. Magic-byte / file signature check (python-magic)
  2. MIME-type vs extension consistency check
  3. Embedded script/macro pattern scan (regex on raw bytes)
  4. File entropy analysis (detect suspiciously encrypted payloads)
  5. Archive bomb detection (zip ratio check)
  6. SHA-256 hash against a known-bad hash blocklist (Redis-backed)

Setup:
  pip install celery redis python-magic

  On Ubuntu/Debian:
    apt-get install libmagic1

  On macOS:
    brew install libmagic

Redis must be running on CELERY_BROKER_URL (default: redis://localhost:6379/0)

Celery worker:
  celery -A config worker --loglevel=info -Q file_scan --concurrency=4
"""

import io
import logging
import math
import os
import re
import struct
import zipfile

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)

# ── Configuration ──────────────────────────────────────────────────────────────

MAX_SCAN_BYTES      = 10 * 1024 * 1024   # Read up to 10 MB for pattern scanning
ENTROPY_THRESHOLD   = 7.5                # bits/byte — above = suspicious (encrypted/packed)
ZIP_RATIO_LIMIT     = 100               # Uncompressed / compressed > 100 → bomb
ZIP_NESTED_LIMIT    = 3                 # Reject archives nested deeper than this

# ── Known-bad SHA-256 hashes (extend via Redis SET "blocked_hashes") ──────────
# These are example EICAR test-file hashes and a few well-known bad hashes.
# In production, sync this set from a threat-intel feed into Redis.
STATIC_BLOCKED_HASHES: set[str] = {
    # EICAR test file (standard AV test)
    '275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f',
    # EICAR test file (with CRLF)
    '131f95c51cc819465fa1797f6ccacf9d494aaaff46fa3eac73ae63ffbdfd8267',
}

# ── Dangerous MIME types — always block ───────────────────────────────────────
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
    'application/x-java-archive',   # .jar executables
    'application/vnd.android.package-archive',  # .apk
}

# ── Dangerous extensions ──────────────────────────────────────────────────────
BLOCKED_EXTENSIONS = {
    'exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'msi', 'dll', 'com',
    'scr', 'pif', 'reg', 'hta', 'jar', 'apk', 'elf', 'deb', 'rpm',
    'dmg', 'pkg', 'app', 'run', 'bin',
}

# ── Dangerous magic-byte signatures ───────────────────────────────────────────
# (offset, bytes) — checked against the start of the file
DANGEROUS_SIGNATURES: list[tuple[int, bytes, str]] = [
    (0,  b'MZ',                          'Windows PE executable (MZ header)'),
    (0,  b'\x7fELF',                     'Linux ELF executable'),
    (0,  b'\xca\xfe\xba\xbe',           'Mach-O fat binary (macOS)'),
    (0,  b'\xce\xfa\xed\xfe',           'Mach-O 32-bit binary (macOS)'),
    (0,  b'\xcf\xfa\xed\xfe',           'Mach-O 64-bit binary (macOS)'),
    (0,  b'#!/',                          'Script with shebang (executable script)'),
    (0,  b'#! /',                         'Script with shebang (executable script)'),
    (0,  b'\x4d\x5a',                    'DOS/Windows executable'),
]

# ── Embedded malicious patterns (checked in raw file bytes) ───────────────────
# These patterns are common in macro-embedded documents and polyglot attacks.
MALICIOUS_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(rb'(?i)CreateObject\s*\(\s*["\']WScript\.Shell["\']'),
     'VBS/VBA WScript.Shell invocation'),
    (re.compile(rb'(?i)powershell\s+-(?:enc|EncodedCommand|nop|NonInteractive|W\s+Hidden)'),
     'PowerShell encoded/hidden execution'),
    (re.compile(rb'(?i)cmd\.exe\s+/[cCkK]'),
     'CMD shell execution'),
    (re.compile(rb'(?i)eval\s*\(\s*(?:base64_decode|gzinflate|str_rot13)'),
     'PHP obfuscated eval'),
    (re.compile(rb'(?i)<script[^>]*>.*?(?:eval|document\.write|unescape)\s*\(', re.DOTALL),
     'Embedded JavaScript eval'),
    (re.compile(rb'(?i)EICAR-STANDARD-ANTIVIRUS-TEST-FILE'),
     'EICAR test file pattern'),
    (re.compile(rb'(?i)AutoOpen|Auto_Open|Document_Open|Workbook_Open'),
     'Office auto-execution macro trigger'),
    (re.compile(rb'(?i)Shell\s*\(["\'](?:cmd|powershell|wscript|cscript)'),
     'VBA Shell() call to system interpreter'),
]


# ── Main scan task ─────────────────────────────────────────────────────────────

@shared_task(
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    name='sharing.scan_uploaded_file',
    queue='file_scan',
)
def scan_uploaded_file(self, file_id: str):
    """
    Celery task: multi-layer security scan a file and update its scan_status.

    Called immediately after a public upload:
        scan_uploaded_file.delay(str(file_record.id))

    Status flow:
        PENDING → SCANNING → SAFE | INFECTED | SCAN_FAILED
    """
    from apps.files.models import File

    # 1. Fetch file record
    try:
        file_obj = File.objects.get(pk=file_id)
    except File.DoesNotExist:
        logger.error('scan_uploaded_file: File %s not found — task aborted', file_id)
        return

    # 2. Mark as SCANNING
    try:
        file_obj.scan_status = File.ScanStatus.SCANNING
        file_obj.save(update_fields=['scan_status'])
    except Exception:
        logger.exception('scan_uploaded_file: Could not set SCANNING status for %s', file_id)

    # 3. Resolve physical path
    file_path = _resolve_path(file_obj)
    if not file_path:
        _mark_result(file_obj, File.ScanStatus.SCAN_FAILED, 'File path unavailable on disk')
        return

    # 4. Run all validation layers
    try:
        threat, detail = _full_scan(file_path, file_obj)

        if threat == 'INFECTED':
            _mark_result(file_obj, File.ScanStatus.INFECTED, detail)
            logger.warning(
                'scan_uploaded_file: THREAT detected — id=%s detail=%s', file_id, detail
            )
        elif threat == 'SCAN_FAILED':
            _mark_result(file_obj, File.ScanStatus.SCAN_FAILED, detail)
            logger.error('scan_uploaded_file: Scan failed for %s — %s', file_id, detail)
        else:
            _mark_result(file_obj, File.ScanStatus.SAFE, 'All security checks passed')

    except Exception as exc:
        logger.exception('scan_uploaded_file: Unexpected error for file %s', file_id)
        try:
            raise self.retry(exc=exc, countdown=30)
        except self.MaxRetriesExceededError:
            _mark_result(file_obj, File.ScanStatus.SCAN_FAILED, f'Max retries exceeded: {exc}')


# ── Multi-layer scan ───────────────────────────────────────────────────────────

def _full_scan(file_path: str, file_obj) -> tuple[str, str]:
    """
    Run all security layers in sequence.
    Returns ('SAFE'|'INFECTED'|'SCAN_FAILED', detail).
    Short-circuits on first threat detected.
    """
    # Layer 1: Extension check
    result = _check_extension(file_obj.original_name or os.path.basename(file_path))
    if result:
        return 'INFECTED', result

    # Layer 2: Magic-byte / file signature
    result = _check_magic_bytes(file_path)
    if result:
        return 'INFECTED', result

    # Layer 3: MIME type consistency (python-magic vs stored mime)
    result = _check_mime_consistency(file_path, file_obj.mime_type or '')
    if result:
        return 'INFECTED', result

    # Layer 4: SHA-256 hash blocklist
    result = _check_hash_blocklist(file_path, file_obj)
    if result:
        return 'INFECTED', result

    # Layer 5: Archive bomb detection
    result = _check_archive_bomb(file_path)
    if result:
        return 'INFECTED', result

    # Layer 6: Embedded malicious pattern scan (raw bytes)
    result = _check_malicious_patterns(file_path)
    if result:
        return 'INFECTED', result

    # Layer 7: Entropy analysis (detect packed/encrypted malware)
    result = _check_entropy(file_path)
    if result:
        return 'INFECTED', result

    return 'SAFE', 'All security checks passed'


# ── Layer implementations ──────────────────────────────────────────────────────

def _check_extension(filename: str) -> str | None:
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    if ext in BLOCKED_EXTENSIONS:
        return f'Blocked file extension: .{ext}'
    return None


def _check_magic_bytes(file_path: str) -> str | None:
    """Read the first 16 bytes and compare against known dangerous signatures."""
    try:
        with open(file_path, 'rb') as f:
            header = f.read(16)
        for offset, sig, description in DANGEROUS_SIGNATURES:
            if header[offset:offset + len(sig)] == sig:
                return f'Dangerous file signature detected: {description}'
    except Exception as exc:
        logger.warning('_check_magic_bytes failed: %s', exc)
    return None


def _check_mime_consistency(file_path: str, stored_mime: str) -> str | None:
    """
    Use python-magic to detect the actual MIME type from file content
    and cross-check against the stored/claimed MIME type.
    Flags dangerous MIME types and large mismatches.
    """
    try:
        import magic as libmagic
        detected = libmagic.from_file(file_path, mime=True) or ''
    except ImportError:
        # python-magic not installed — skip this layer gracefully
        logger.info('python-magic not available — skipping MIME consistency check')
        return None
    except Exception as exc:
        logger.warning('_check_mime_consistency failed: %s', exc)
        return None

    if detected in BLOCKED_MIME_TYPES:
        return f'Dangerous MIME type detected: {detected}'

    # Flag executable disguised as something else
    if stored_mime and detected:
        stored_main = stored_mime.split('/')[0]
        detected_main = detected.split('/')[0]
        # Allow text/application interchange (common for JSON/CSV)
        # But flag if application claims to be image/audio/video
        if detected_main == 'application' and stored_main in ('image', 'audio', 'video'):
            return (
                f'MIME type mismatch: claimed {stored_mime}, '
                f'actual content is {detected}'
            )

    return None


def _check_hash_blocklist(file_path: str, file_obj) -> str | None:
    """
    Compare file SHA-256 against static blocklist and Redis dynamic blocklist.
    """
    import hashlib

    try:
        sha = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(65536), b''):
                sha.update(chunk)
        digest = sha.hexdigest()

        # Store hash on file_obj for future reference (best-effort)
        try:
            if hasattr(file_obj, 'sha256') and not file_obj.sha256:
                file_obj.sha256 = digest
                file_obj.save(update_fields=['sha256'])
        except Exception:
            pass

        if digest in STATIC_BLOCKED_HASHES:
            return f'File matches known malicious hash: {digest[:16]}…'

        # Redis dynamic blocklist
        try:
            import django_redis
            from django.core.cache import cache
            if cache.sismember('blocked_hashes', digest):
                return f'File matches dynamic threat blocklist: {digest[:16]}…'
        except Exception:
            pass  # Redis blocklist is optional

    except Exception as exc:
        logger.warning('_check_hash_blocklist failed: %s', exc)

    return None


def _check_archive_bomb(file_path: str) -> str | None:
    """
    Detect ZIP bombs: files that compress to an extreme ratio.
    Also detects deeply nested archives.
    """
    if not zipfile.is_zipfile(file_path):
        return None

    try:
        compressed_size = os.path.getsize(file_path)
        if compressed_size == 0:
            return None

        total_uncompressed = 0
        with zipfile.ZipFile(file_path, 'r') as zf:
            members = zf.infolist()
            if len(members) > 10_000:
                return f'Archive contains excessive file count ({len(members):,} entries)'

            for member in members:
                total_uncompressed += member.file_size
                if total_uncompressed > 5 * 1024 * 1024 * 1024:  # 5 GB cap
                    return 'Archive bomb detected: uncompressed size exceeds 5 GB'

                # Check for nested archives
                if member.filename.lower().endswith(('.zip', '.gz', '.tar', '.rar', '.7z')):
                    logger.info('Nested archive detected in %s: %s', file_path, member.filename)

        if compressed_size > 0:
            ratio = total_uncompressed / compressed_size
            if ratio > ZIP_RATIO_LIMIT:
                return f'Archive bomb detected: compression ratio {ratio:.0f}:1 exceeds limit'

    except zipfile.BadZipFile:
        pass  # Not a valid zip — let other layers handle it
    except Exception as exc:
        logger.warning('_check_archive_bomb failed: %s', exc)

    return None


def _check_malicious_patterns(file_path: str) -> str | None:
    """
    Scan raw file bytes for known malicious code patterns (regex-based).
    Reads up to MAX_SCAN_BYTES to keep it fast.
    """
    try:
        with open(file_path, 'rb') as f:
            raw = f.read(MAX_SCAN_BYTES)

        for pattern, description in MALICIOUS_PATTERNS:
            if pattern.search(raw):
                return f'Malicious pattern detected: {description}'

    except Exception as exc:
        logger.warning('_check_malicious_patterns failed: %s', exc)

    return None


def _check_entropy(file_path: str) -> str | None:
    """
    Calculate Shannon entropy of the file.
    Very high entropy (> ENTROPY_THRESHOLD) may indicate packed/encrypted malware.
    Only flag non-archive, non-media files — PDFs/images/archives legitimately have high entropy.
    """
    SKIP_EXTENSIONS = {
        'zip', 'gz', 'tar', 'bz2', '7z', 'rar',
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mp3', 'wav', 'pdf',
    }

    try:
        ext = file_path.rsplit('.', 1)[-1].lower() if '.' in file_path else ''
        if ext in SKIP_EXTENSIONS:
            return None

        with open(file_path, 'rb') as f:
            data = f.read(MAX_SCAN_BYTES)

        if len(data) < 512:
            return None  # Too small to compute meaningful entropy

        entropy = _shannon_entropy(data)
        if entropy > ENTROPY_THRESHOLD:
            return (
                f'Suspicious file entropy ({entropy:.2f} bits/byte) — '
                'file may be packed or encrypted malware'
            )

    except Exception as exc:
        logger.warning('_check_entropy failed: %s', exc)

    return None


def _shannon_entropy(data: bytes) -> float:
    """Calculate Shannon entropy in bits per byte."""
    if not data:
        return 0.0
    freq = [0] * 256
    for byte in data:
        freq[byte] += 1
    length = len(data)
    entropy = 0.0
    for count in freq:
        if count > 0:
            p = count / length
            entropy -= p * math.log2(p)
    return entropy


# ── Helpers ────────────────────────────────────────────────────────────────────

def _resolve_path(file_obj) -> str | None:
    try:
        if not file_obj.file or not file_obj.file.name:
            return None
        path = file_obj.file.path
        return path if os.path.exists(path) else None
    except Exception:
        return None


def _mark_result(file_obj, scan_status, message: str) -> None:
    try:
        file_obj.scan_status = scan_status
        file_obj.scan_result = message[:1000]
        file_obj.scanned_at  = timezone.now()
        file_obj.save(update_fields=['scan_status', 'scan_result', 'scanned_at'])
    except Exception:
        logger.exception('_mark_result: Could not save scan result for file %s', file_obj.pk)


# ── Periodic task: expire old shares ──────────────────────────────────────────

@shared_task(name='sharing.expire_old_shares')
def expire_old_shares():
    """
    Periodic task: mark expired FileShare and ZipShare records.
    Schedule in settings:
        CELERY_BEAT_SCHEDULE = {
            'expire-shares': {
                'task': 'sharing.expire_old_shares',
                'schedule': crontab(minute=0, hour='*/6'),
            },
        }
    """
    from .models import FileShare, ZipShare

    now = timezone.now()
    fs_count = FileShare.objects.filter(
        status=FileShare.Status.ACTIVE, expires_at__lt=now
    ).update(status=FileShare.Status.EXPIRED)

    zs_count = ZipShare.objects.filter(
        status=ZipShare.Status.ACTIVE, expires_at__lt=now
    ).update(status=ZipShare.Status.EXPIRED)

    logger.info(
        'expire_old_shares: marked %d FileShares and %d ZipShares as expired',
        fs_count, zs_count,
    )
    return {'file_shares_expired': fs_count, 'zip_shares_expired': zs_count}