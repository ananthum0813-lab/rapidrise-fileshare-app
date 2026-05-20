import os
import re
import hashlib
from datetime import timedelta

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count
from django.conf import settings
from django.utils import timezone

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import ValidationError

from config.exceptions import success_response
from .models import File
from .serializers import FileSerializer, sanitize_filename, get_mime_type
from .permissions import IsFileOwner


class FilePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


# ── Expiry option → timedelta mapping ────────────────────────────────────────
# Single source of truth shared by FileUploadView and SetExpiryView.
# 'never' / None / unrecognised → None (no expiry).

_EXPIRY_DELTAS = {
    '1_minute': timedelta(minutes=1),  
    '1_hour':  timedelta(hours=1),
    '1_day':   timedelta(days=1),
    '7_days':  timedelta(days=7),
    '30_days': timedelta(days=30),
}

def _expiry_option_to_dt(expiry_option: str | None):
    """
    Convert an expiry_option string to an aware datetime (or None).

    Returns
    -------
    datetime | None
        The absolute expiry moment, or None when expiry_option is
        'never', empty, or unrecognised.
    """
    if not expiry_option or expiry_option == 'never':
        return None
    delta = _EXPIRY_DELTAS.get(expiry_option)
    if delta is None:
        return None
    return timezone.now() + delta


# ── Shared expiry guard ───────────────────────────────────────────────────────

def _assert_not_expired(file_obj) -> None:
    """
    Raise a 410-Gone APIException if the file's expiry time has passed.

    This provides an immediate barrier even in the window between the
    file's expires_at and the next Celery cleanup run (≤ 1 hour by default).
    Files with expires_at=None are permanent and always pass this check.
    """
    if file_obj.is_expired:
        from rest_framework.exceptions import APIException
        raise APIException(
            detail='This file has expired and is no longer available.',
            code='file_expired',
        )


# ──────────────────────────────────────────────────────────────────────────────
# Robust server-side filename deduplication
# ──────────────────────────────────────────────────────────────────────────────

def _split_name(filename: str) -> tuple[str, str]:
    """Split 'report (2).pdf' → ('report', '.pdf')."""
    if '.' in filename:
        dot = filename.rfind('.')
        return filename[:dot], filename[dot:]
    return filename, ''


_COUNTER_RE = re.compile(r'^(.*?)\s*\((\d+)\)$')
_DJANGO_SUFFIX_RE = re.compile(r'_[a-zA-Z0-9]+_?$')


def _strip_our_counter(base: str) -> str:
    m = _COUNTER_RE.match(base)
    return m.group(1).rstrip() if m else base


def _strip_django_suffix(base: str) -> str:
    return _DJANGO_SUFFIX_RE.sub('', base).rstrip()


def resolve_unique_filename(desired_name: str, owner, exclude_pk=None) -> str:
    raw_base, ext = _split_name(desired_name)
    clean_base    = _strip_django_suffix(raw_base)
    root_base     = _strip_our_counter(clean_base)

    prefix    = root_base
    ext_lower = ext.lower()

    qs = File.objects.filter(
        owner=owner,
        is_deleted=False,
        original_name__istartswith=prefix,
    )
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)

    existing_names = set(qs.values_list('original_name', flat=True))

    occupied   = set()
    exact_base = root_base.lower() + ext_lower

    for name in existing_names:
        name_lower = name.lower()
        if name_lower == exact_base:
            occupied.add(0)
            continue
        b, e = _split_name(name)
        if e.lower() != ext_lower:
            continue
        m = _COUNTER_RE.match(b)
        if m and m.group(1).rstrip().lower() == root_base.lower():
            occupied.add(int(m.group(2)))

    counter = 0
    while counter in occupied:
        counter += 1

    if counter == 0:
        return root_base + ext
    return f'{root_base} ({counter}){ext}'


# ──────────────────────────────────────────────────────────────────────────────
# SHA-256 helper
# ──────────────────────────────────────────────────────────────────────────────

def _compute_sha256(f) -> str:
    h = hashlib.sha256()
    for chunk in f.chunks():
        h.update(chunk)
    f.seek(0)
    return h.hexdigest()


# ──────────────────────────────────────────────────────────────────────────────
# Duplicate check endpoint
# ──────────────────────────────────────────────────────────────────────────────

class CheckDuplicateView(APIView):
    """
    POST /api/files/check-duplicate/
    Body: { "sha256": "<64-char hex>" }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sha256 = request.data.get('sha256', '').strip().lower()
        if len(sha256) != 64 or not all(c in '0123456789abcdef' for c in sha256):
            raise ValidationError({'sha256': 'A valid 64-character SHA-256 hex string is required.'})

        duplicate = File.objects.filter(
            owner=request.user,
            sha256=sha256,
            is_deleted=False,
        ).first()

        if not duplicate:
            return success_response(
                data={'is_duplicate': False},
                status_code=status.HTTP_200_OK,
            )

        return success_response(
            data={
                'is_duplicate': True,
                'existing_file': FileSerializer(duplicate, context={'request': request}).data,
            },
            message='Duplicate file detected — same content already exists in your storage.',
            status_code=status.HTTP_200_OK,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Upload  (now honours expiry_option from the request body)
# ──────────────────────────────────────────────────────────────────────────────

class FileUploadView(APIView):
    """Upload one or multiple files (multipart/form-data, field name: 'files').

    Optional body field:
      expiry_option  — 'never' | '1_hour' | '1_day' | '7_days' | '30_days'
                       Omitting it or sending 'never' means no auto-delete.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        files = request.FILES.getlist('files')
        if not files:
            raise ValidationError({'files': 'No files provided.'})

        # FIX: read expiry_option and convert to an absolute datetime once,
        # then apply the same expires_at to every file in this batch.
        expiry_option = request.data.get('expiry_option', 'never')
        expires_at    = _expiry_option_to_dt(expiry_option)

        user      = request.user
        used_bytes = File.objects.filter(owner=user, is_deleted=False).aggregate(
            total=Sum('file_size')
        )['total'] or 0
        available  = settings.MAX_STORAGE_BYTES - used_bytes

        uploaded = []
        errors   = []
        batch_names: set[str] = set()

        for f in files:
            if f.size > settings.MAX_FILE_SIZE_BYTES:
                errors.append(f'{f.name}: Exceeds max size ({settings.MAX_FILE_SIZE_MB} MB)')
                continue
            if f.size > available:
                errors.append(f'{f.name}: Not enough storage space')
                continue

            mime_type = get_mime_type(f)
            if mime_type not in settings.ALLOWED_MIME_TYPES:
                errors.append(f'{f.name}: File type not allowed ({mime_type})')
                continue

            try:
                sha256 = _compute_sha256(f)
            except Exception:
                sha256 = ''

            desired = sanitize_filename(f.name)
            unique  = resolve_unique_filename(desired, user)

            if unique.lower() in {n.lower() for n in batch_names}:
                raw_base, ext = _split_name(unique)
                root_base     = _strip_our_counter(raw_base)
                counter       = 1
                while f'{root_base} ({counter}){ext}'.lower() in {n.lower() for n in batch_names}:
                    counter += 1
                unique = f'{root_base} ({counter}){ext}'

            batch_names.add(unique)

            try:
                record = File.objects.create(
                    owner=user,
                    original_name=unique,
                    file=f,
                    file_size=f.size,
                    mime_type=mime_type,
                    sha256=sha256,
                    expires_at=expires_at,   # FIX: was never set before
                )
                uploaded.append(FileSerializer(record, context={'request': request}).data)
                available -= f.size
            except Exception as e:
                errors.append(f'{f.name}: Upload failed — {e}')

        return success_response(
            data={
                'uploaded': uploaded,
                'errors':   errors or None,
                'count':    len(uploaded),
            },
            message=f'{len(uploaded)} file(s) uploaded successfully.' if uploaded else 'Upload failed.',
            status_code=status.HTTP_201_CREATED if uploaded else status.HTTP_400_BAD_REQUEST,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Set / clear expiry on an existing file  ← NEW VIEW (was completely missing)
# ──────────────────────────────────────────────────────────────────────────────

class SetExpiryView(APIView):
    """
    POST /api/files/<pk>/set-expiry/
    Body: { "expiry_option": "never" | "1_hour" | "1_day" | "7_days" | "30_days" }

    Sets or clears the auto-delete expiry for an existing file.
    Returns the updated FileSerializer payload so the frontend can
    refresh the row without an extra fetchFiles call.
    """
    permission_classes = [IsAuthenticated, IsFileOwner]

    def post(self, request, pk):
        file_obj = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(request, file_obj)

        expiry_option = request.data.get('expiry_option', 'never')

        # Validate — accept known values + 'never'
        valid_options = {'never', '1_minute', '1_hour', '1_day', '7_days', '30_days'}
        if expiry_option not in valid_options:
            raise ValidationError({
                'expiry_option': (
                    f"Invalid value '{expiry_option}'. "
                    f"Must be one of: {', '.join(sorted(valid_options))}."
                )
            })

        expires_at = _expiry_option_to_dt(expiry_option)   # None for 'never'
        file_obj.expires_at = expires_at
        file_obj.save(update_fields=['expires_at'])

        msg = (
            'Auto-delete cleared — file is now permanent.'
            if expires_at is None
            else f'File will auto-delete in {expiry_option.replace("_", " ")}.'
        )

        return success_response(
            data=FileSerializer(file_obj, context={'request': request}).data,
            message=msg,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Remaining views — unchanged
# ──────────────────────────────────────────────────────────────────────────────

class FileListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = File.objects.filter(owner=request.user, is_deleted=False)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(original_name__icontains=search)

        ordering = request.query_params.get('ordering', '-uploaded_at')
        valid_orderings = [
            'uploaded_at', '-uploaded_at',
            'original_name', '-original_name',
            'file_size', '-file_size',
        ]
        if ordering in valid_orderings:
            qs = qs.order_by(ordering)

        paginator = FilePagination()
        page      = paginator.paginate_queryset(qs, request)

        return success_response(data={
            'results':      FileSerializer(page, many=True).data,
            'count':        paginator.page.paginator.count,
            'total_pages':  paginator.page.paginator.num_pages,
            'current_page': paginator.page.number,
            'next':         paginator.get_next_link(),
            'previous':     paginator.get_previous_link(),
        })


class FileDetailView(APIView):
    permission_classes = [IsAuthenticated, IsFileOwner]

    def get_object(self, pk):
        obj = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(self.request, obj)
        _assert_not_expired(obj)
        return obj

    def get(self, request, pk):
        return success_response(data=FileSerializer(self.get_object(pk)).data)

    def delete(self, request, pk):
        file_obj = self.get_object(pk)
        name     = file_obj.original_name
        file_obj.delete_file()
        return success_response(message=f"'{name}' deleted successfully.")


class FileDownloadView(APIView):
    permission_classes = [IsAuthenticated, IsFileOwner]

    def get(self, request, pk):
        file_obj  = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(request, file_obj)
        _assert_not_expired(file_obj)
        file_path = file_obj.file.path
        if os.path.exists(file_path):
            return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=file_obj.original_name)
        raise Http404('File not found on server.')


class FileRenameView(APIView):
    permission_classes = [IsAuthenticated, IsFileOwner]

    def post(self, request, pk):
        file_obj = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(request, file_obj)

        new_name = request.data.get('new_name', '').strip()
        if not new_name:
            raise ValidationError({'new_name': 'New filename is required.'})

        original_name = file_obj.original_name
        original_ext  = ('.' + original_name.rsplit('.', 1)[1]) if '.' in original_name else ''

        if '.' in new_name:
            new_name = new_name.rsplit('.', 1)[0]

        new_name     = sanitize_filename(new_name) + original_ext
        desired_full = new_name

        if desired_full == original_name:
            raise ValidationError({'new_name': 'New filename is the same as the current name.'})

        unique_name = resolve_unique_filename(desired_full, request.user, exclude_pk=pk)

        if unique_name != desired_full:
            raise ValidationError({
                'new_name': f"A file named '{desired_full}' already exists. "
                            f"It would be saved as '{unique_name}' — "
                            f"please choose a different name or confirm.",
            })

        file_obj.original_name = unique_name
        file_obj.save(update_fields=['original_name'])

        return success_response(
            data=FileSerializer(file_obj).data,
            message=f"Renamed to '{unique_name}'.",
        )


class StorageInfoView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        result = File.objects.filter(owner=request.user, is_deleted=False).aggregate(
            used=Sum('file_size'),
            file_count=Count('id'),
        )
        used  = result['used'] or 0
        total = settings.MAX_STORAGE_BYTES
        return success_response(data={
            'used_bytes':    used,
            'total_bytes':   total,
            'used_mb':       round(used / (1024 * 1024), 2),
            'total_gb':      settings.MAX_STORAGE_GB,
            'usage_percent': round((used / total) * 100, 2) if total else 0,
            'file_count':    result['file_count'],
        })


# ── Favorites ─────────────────────────────────────────────────────────────────

class ToggleFavoriteView(APIView):
    permission_classes = [IsAuthenticated, IsFileOwner]

    def post(self, request, pk):
        file_obj = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(request, file_obj)
        file_obj.toggle_favorite()
        return success_response(
            data=FileSerializer(file_obj).data,
            message='⭐ Added to favorites.' if file_obj.is_favorite else '✓ Removed from favorites.',
        )


class FavoritesListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs        = File.objects.filter(owner=request.user, is_deleted=False, is_favorite=True).order_by('-uploaded_at')
        paginator = FilePagination()
        page      = paginator.paginate_queryset(qs, request)
        return success_response(data={
            'results':      FileSerializer(page, many=True).data,
            'count':        paginator.page.paginator.count,
            'total_pages':  paginator.page.paginator.num_pages,
            'current_page': paginator.page.number,
        })


# ── Trash ─────────────────────────────────────────────────────────────────────

class TrashListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs        = File.objects.filter(owner=request.user, is_deleted=True).order_by('-deleted_at')
        paginator = FilePagination()
        page      = paginator.paginate_queryset(qs, request)
        return success_response(data={
            'results':      FileSerializer(page, many=True).data,
            'count':        paginator.page.paginator.count,
            'total_pages':  paginator.page.paginator.num_pages,
            'current_page': paginator.page.number,
        })


class RestoreFileView(APIView):
    permission_classes = [IsAuthenticated, IsFileOwner]

    def post(self, request, pk):
        file_obj = get_object_or_404(File, pk=pk, is_deleted=True)
        self.check_object_permissions(request, file_obj)
        file_obj.restore_file()
        return success_response(
            data=FileSerializer(file_obj).data,
            message=f"✓ '{file_obj.original_name}' restored from trash.",
        )


class EmptyTrashView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        trashed = File.objects.filter(owner=request.user, is_deleted=True)
        count   = trashed.count()
        for f in trashed:
            f.permanently_delete()
        return success_response(message=f"✓ Permanently deleted {count} file(s) from trash.")


class PermanentlyDeleteView(APIView):
    permission_classes = [IsAuthenticated, IsFileOwner]

    def post(self, request, pk):
        file_obj = get_object_or_404(File, pk=pk, is_deleted=True)
        self.check_object_permissions(request, file_obj)
        name = file_obj.original_name
        file_obj.permanently_delete()
        return success_response(message=f"✓ Permanently deleted '{name}'.")


# ── Batch ─────────────────────────────────────────────────────────────────────

class BatchDeleteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('file_ids', [])
        if not ids:
            raise ValidationError({'file_ids': 'At least one file ID is required.'})
        files = File.objects.filter(owner=request.user, id__in=ids, is_deleted=False)
        count = files.count()
        for f in files:
            f.delete_file()
        return success_response(message=f"✓ Deleted {count} file(s).")


class BatchRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ids = request.data.get('file_ids', [])
        if not ids:
            raise ValidationError({'file_ids': 'At least one file ID is required.'})
        files = File.objects.filter(owner=request.user, id__in=ids, is_deleted=True)
        count = files.count()
        for f in files:
            f.restore_file()
        return success_response(message=f"✓ Restored {count} file(s) from trash.")


# ──────────────────────────────────────────────────────────────────────────────
# Folder views  (unchanged — kept in same file for project structure)
# ──────────────────────────────────────────────────────────────────────────────

import logging
from django.utils import timezone as tz

from rest_framework.exceptions import PermissionDenied

from apps.files.models import File  # already imported above, harmless re-alias

from .models import Folder
from .serializers import (
    FolderSerializer,
    FolderSummarySerializer,
    CreateFolderSerializer,
    AddRemoveFilesSerializer,
)

logger = logging.getLogger(__name__)


def _folder_with_active_files(folder: Folder) -> Folder:
    folder.files_active = folder.files.filter(is_deleted=False).order_by('original_name')
    return folder


class FolderListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        folders = Folder.objects.filter(owner=request.user).prefetch_related('files')
        return success_response(data={
            'folders': FolderSummarySerializer(folders, many=True).data,
            'count':   folders.count(),
        })

    def post(self, request):
        serializer = CreateFolderSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        folder = Folder.objects.create(
            owner=request.user,
            name=d['name'],
            description=d.get('description', ''),
            color=d.get('color', '#6366f1'),
            icon=d.get('icon', 'fa-folder'),
        )

        if d.get('file_ids'):
            files = File.objects.filter(pk__in=d['file_ids'], owner=request.user, is_deleted=False)
            folder.files.set(files)

        return success_response(
            data=FolderSummarySerializer(folder).data,
            message=f'Folder "{folder.name}" created.',
            status_code=status.HTTP_201_CREATED,
        )


class FolderDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_folder(self, pk, user):
        folder = get_object_or_404(Folder, pk=pk)
        if folder.owner != user:
            raise PermissionDenied('Not your folder.')
        return folder

    def get(self, request, pk):
        folder = _folder_with_active_files(self._get_folder(pk, request.user))
        return success_response(data=FolderSerializer(folder).data)

    def patch(self, request, pk):
        folder     = self._get_folder(pk, request.user)
        serializer = CreateFolderSerializer(
            data={**request.data, 'name': request.data.get('name', folder.name)},
            context={'request': request, 'folder_pk': str(pk)},
        )
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        folder.name        = d.get('name', folder.name)
        folder.description = d.get('description', folder.description)
        folder.color       = d.get('color', folder.color)
        folder.icon        = d.get('icon', folder.icon)
        folder.save(update_fields=['name', 'description', 'color', 'icon', 'updated_at'])

        return success_response(
            data=FolderSummarySerializer(folder).data,
            message='Folder updated.',
        )

    def delete(self, request, pk):
        folder = self._get_folder(pk, request.user)
        name   = folder.name
        folder.delete()
        return success_response(message=f'Folder "{name}" deleted.')


class FolderAddFilesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        folder = get_object_or_404(Folder, pk=pk, owner=request.user)
        ser    = AddRemoveFilesSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)

        files = File.objects.filter(pk__in=ser.validated_data['file_ids'], owner=request.user, is_deleted=False)
        folder.files.add(*files)

        added = files.count()
        return success_response(
            data={'folder_id': str(folder.id), 'added': added},
            message=f'{added} file(s) added to "{folder.name}".',
        )


class FolderRemoveFilesView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        folder = get_object_or_404(Folder, pk=pk, owner=request.user)
        ser    = AddRemoveFilesSerializer(data=request.data, context={'request': request})
        ser.is_valid(raise_exception=True)

        files = File.objects.filter(pk__in=ser.validated_data['file_ids'])
        folder.files.remove(*files)

        removed = files.count()
        return success_response(
            data={'folder_id': str(folder.id), 'removed': removed},
            message=f'{removed} file(s) removed from "{folder.name}".',
        )


class FolderShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        folder = get_object_or_404(Folder, pk=pk, owner=request.user)

        recipient_emails = request.data.get('recipient_emails', [])
        if not recipient_emails:
            raise ValidationError({'recipient_emails': 'At least one recipient email is required.'})

        expiration_hours = int(request.data.get('expiration_hours', 24))
        message          = request.data.get('message', '')
        share_type       = request.data.get('share_type', 'single')

        requested_ids = request.data.get('file_ids', [])
        if requested_ids:
            files = list(folder.files.filter(pk__in=requested_ids, is_deleted=False, owner=request.user))
        else:
            files = list(folder.files.filter(is_deleted=False, owner=request.user))

        if not files:
            raise ValidationError({'file_ids': 'No valid files found in this folder to share.'})

        expires_at = timezone.now() + timedelta(hours=expiration_hours)

        if share_type == 'single' or len(files) == 1:
            from apps.sharing.services import create_shares
            all_shares = []
            for file_obj in files:
                shares = create_shares(
                    user=request.user,
                    file=file_obj,
                    recipient_emails=recipient_emails,
                    expiration_hours=expiration_hours,
                    message=message,
                )
                all_shares.extend(shares)

            from apps.sharing.serializers import FileShareSerializer
            return success_response(
                data={
                    'share_type': 'single',
                    'shares':     FileShareSerializer(all_shares, many=True).data,
                    'count':      len(all_shares),
                },
                message=f'Shared {len(files)} file(s) with {len(recipient_emails)} recipient(s).',
                status_code=status.HTTP_201_CREATED,
            )

        from apps.sharing.models import ZipShare
        from apps.sharing.serializers import ZipShareSerializer

        zip_name = request.data.get('zip_name', '') or f'{folder.name}.zip'
        if not zip_name.endswith('.zip'):
            zip_name += '.zip'

        from apps.sharing.views import _send_zip_share_email

        zip_shares = []
        for email in recipient_emails:
            zs = ZipShare.objects.create(
                shared_by=request.user,
                recipient_email=email,
                message=message,
                zip_name=zip_name,
                expires_at=expires_at,
                file_count=len(files),
                status=ZipShare.Status.ACTIVE,
            )
            zs.files.set(files)
            zip_shares.append(zs)

            try:
                file_names = [f.original_name for f in files]
                _send_zip_share_email(zip_share=zs, shared_by=request.user, file_names=file_names)
            except Exception:
                logger.exception('FolderShareView: email failed for ZipShare %s → %s', zs.id, email)

        return success_response(
            data={
                'share_type': 'zip',
                'zip_shares': ZipShareSerializer(zip_shares, many=True).data,
                'count':      len(zip_shares),
                'file_count': len(files),
            },
            message=f'{len(files)} files bundled and shared with {len(zip_shares)} recipient(s).',
            status_code=status.HTTP_201_CREATED,
        )