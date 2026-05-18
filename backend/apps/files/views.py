import os
import re
import hashlib

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count
from django.conf import settings
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


# ──────────────────────────────────────────────────────────────────────────────
# Robust server-side filename deduplication
# ──────────────────────────────────────────────────────────────────────────────

def _split_name(filename: str) -> tuple[str, str]:
    """Split 'report (2).pdf' → ('report', '.pdf')."""
    if '.' in filename:
        dot = filename.rfind('.')
        return filename[:dot], filename[dot:]
    return filename, ''


# Matches " (N)" or "(N)" at end of base name — our own suffix style
_COUNTER_RE = re.compile(r'^(.*?)\s*\((\d+)\)$')

# Matches Django's auto-suffix patterns: _1_, _2, _abc123_ etc.
_DJANGO_SUFFIX_RE = re.compile(r'_[a-zA-Z0-9]+_?$')


def _strip_our_counter(base: str) -> str:
    """'report (2)' → 'report',  'report' → 'report'."""
    m = _COUNTER_RE.match(base)
    return m.group(1).rstrip() if m else base


def _strip_django_suffix(base: str) -> str:
    """
    Strip Django's auto-appended storage suffixes from a *display* name.
    e.g. 'Screenshot from 2026-05-11 15-36-24 _1_' → 'Screenshot from 2026-05-11 15-36-24'
    Only strips if the suffix looks like Django-generated (underscore + alnum + optional _).
    """
    return _DJANGO_SUFFIX_RE.sub('', base).rstrip()


def resolve_unique_filename(desired_name: str, owner, exclude_pk=None) -> str:
    """
    Return a display filename that is unique for this owner (among non-deleted files).

    Algorithm
    ---------
    1. Split desired_name → (raw_base, ext)
    2. Strip any Django storage suffix from raw_base           → clean_base
    3. Strip our own "(N)" counter from clean_base             → root_base
    4. Query ALL existing orignal_names that start with root_base + ext
    5. Collect every counter already in use (0 = no counter)
    6. Pick lowest non-negative integer NOT in that set:
       - 0  → return  root_base + ext              (e.g. "file.png")
       - N  → return  root_base + " (N)" + ext     (e.g. "file (3).png")

    This guarantees:
      file.png → file (1).png → file (2).png → file (3).png …
    and never resets or duplicates.
    """
    raw_base, ext = _split_name(desired_name)
    clean_base    = _strip_django_suffix(raw_base)
    root_base     = _strip_our_counter(clean_base)

    # Fetch all existing names for this owner that could collide
    prefix       = root_base          # names starting with root_base
    ext_lower    = ext.lower()

    qs = File.objects.filter(
        owner=owner,
        is_deleted=False,
        original_name__istartswith=prefix,
    )
    if exclude_pk:
        qs = qs.exclude(pk=exclude_pk)

    existing_names = set(qs.values_list('original_name', flat=True))

    # Build set of counters already occupied
    occupied = set()
    exact_base = root_base.lower() + ext_lower          # counter-0 candidate

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

    # Find the lowest free slot
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
# Duplicate check endpoint  (called by frontend BEFORE upload)
# ──────────────────────────────────────────────────────────────────────────────

class CheckDuplicateView(APIView):
    """
    POST /api/files/check-duplicate/
    Body: { "sha256": "<64-char hex>" }

    Returns:
      { is_duplicate: false }                       — safe to upload
      { is_duplicate: true, existing_file: {...} }  — duplicate found
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
# Upload  (with server-side dedup + sha256 store)
# ──────────────────────────────────────────────────────────────────────────────

class FileUploadView(APIView):
    """Upload one or multiple files (multipart/form-data, field name: 'files')."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        files = request.FILES.getlist('files')
        if not files:
            raise ValidationError({'files': 'No files provided.'})

        user      = request.user
        used_bytes = File.objects.filter(owner=user, is_deleted=False).aggregate(
            total=Sum('file_size')
        )['total'] or 0
        available  = settings.MAX_STORAGE_BYTES - used_bytes

        uploaded = []
        errors   = []

        # Track names assigned IN THIS batch so two files in the same upload
        # don't get the same resolved name.
        batch_names: set[str] = set()

        for f in files:
            # ── size check ────────────────────────────────────────────────────
            if f.size > settings.MAX_FILE_SIZE_BYTES:
                errors.append(f'{f.name}: Exceeds max size ({settings.MAX_FILE_SIZE_MB} MB)')
                continue
            if f.size > available:
                errors.append(f'{f.name}: Not enough storage space')
                continue

            # ── MIME check ────────────────────────────────────────────────────
            mime_type = get_mime_type(f)
            if mime_type not in settings.ALLOWED_MIME_TYPES:
                errors.append(f'{f.name}: File type not allowed ({mime_type})')
                continue

            # ── SHA-256 ───────────────────────────────────────────────────────
            try:
                sha256 = _compute_sha256(f)
            except Exception:
                sha256 = ''

            # ── Resolve unique display name ───────────────────────────────────
            # Start from the sanitized desired name, then find the next free slot.
            desired   = sanitize_filename(f.name)
            unique    = resolve_unique_filename(desired, user)

            # Also avoid clashing with names already assigned in this batch
            if unique.lower() in {n.lower() for n in batch_names}:
                raw_base, ext = _split_name(unique)
                root_base     = _strip_our_counter(raw_base)
                counter       = 1
                while f'{root_base} ({counter}){ext}'.lower() in {n.lower() for n in batch_names}:
                    counter += 1
                unique = f'{root_base} ({counter}){ext}'

            batch_names.add(unique)

            # ── Create record ─────────────────────────────────────────────────
            try:
                record = File.objects.create(
                    owner=user,
                    original_name=unique,
                    file=f,
                    file_size=f.size,
                    mime_type=mime_type,
                    sha256=sha256,
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
# All existing views — unchanged
# ──────────────────────────────────────────────────────────────────────────────

class FileListView(APIView):
    """List all files for the authenticated user, with search and ordering."""
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
        file_path = file_obj.file.path
        if os.path.exists(file_path):
            return FileResponse(open(file_path, 'rb'), as_attachment=True, filename=file_obj.original_name)
        raise Http404('File not found on server.')


class FileRenameView(APIView):
    """
    Rename a file.

    - Extension is protected (cannot be changed).
    - Uses resolve_unique_filename so the new name is guaranteed unique.
    """
    permission_classes = [IsAuthenticated, IsFileOwner]

    def post(self, request, pk):
        file_obj = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(request, file_obj)

        new_name = request.data.get('new_name', '').strip()
        if not new_name:
            raise ValidationError({'new_name': 'New filename is required.'})

        # Protect extension
        original_name = file_obj.original_name
        original_ext  = ('.' + original_name.rsplit('.', 1)[1]) if '.' in original_name else ''

        # Strip any extension the user may have typed
        if '.' in new_name:
            new_name = new_name.rsplit('.', 1)[0]

        new_name    = sanitize_filename(new_name) + original_ext
        desired_full = new_name

        if desired_full == original_name:
            raise ValidationError({'new_name': 'New filename is the same as the current name.'})

        # Resolve uniqueness (exclude this file itself so a no-op rename is detected above)
        unique_name = resolve_unique_filename(desired_full, request.user, exclude_pk=pk)

        # If resolve_unique_filename changed the name it means there's a clash
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
    



"""

All folder-related API views.

    path('folders/',                          FolderListCreateView.as_view(),  name='folder-list'),
    path('folders/<uuid:pk>/',                FolderDetailView.as_view(),      name='folder-detail'),
    path('folders/<uuid:pk>/add-files/',      FolderAddFilesView.as_view(),    name='folder-add-files'),
    path('folders/<uuid:pk>/remove-files/',   FolderRemoveFilesView.as_view(), name='folder-remove-files'),
    path('folders/<uuid:pk>/share/',          FolderShareView.as_view(),       name='folder-share'),
"""

import logging
from datetime import timedelta

from django.shortcuts import get_object_or_404
from django.utils import timezone

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import ValidationError, PermissionDenied

from config.exceptions import success_response
from apps.files.models import File

from .models import Folder
from .serializers import (
    FolderSerializer,
    FolderSummarySerializer,
    CreateFolderSerializer,
    AddRemoveFilesSerializer,
)

logger = logging.getLogger(__name__)


# ── helper: attach active (non-deleted) files to queryset ────────────────────

def _folder_with_active_files(folder: Folder) -> Folder:
    """
    Annotate the folder instance with a `files_active` attribute so that
    FolderSerializer can embed only non-deleted files without an extra query.
    """
    folder.files_active = folder.files.filter(is_deleted=False).order_by('original_name')
    return folder


# ─────────────────────────────────────────────────────────────────────────────
# List + Create
# ─────────────────────────────────────────────────────────────────────────────

class FolderListCreateView(APIView):
    """
    GET  /api/files/folders/   — list all folders (summary, no embedded files)
    POST /api/files/folders/   — create a folder, optionally pre-loading files
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# Detail (get, patch, delete)
# ─────────────────────────────────────────────────────────────────────────────

class FolderDetailView(APIView):
    """
    GET    /api/files/folders/<pk>/   — full folder with file list
    PATCH  /api/files/folders/<pk>/   — rename / recolour / re-icon
    DELETE /api/files/folders/<pk>/   — delete folder (files are NOT deleted)
    """
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
            message=f'Folder updated.',
        )

    def delete(self, request, pk):
        folder = self._get_folder(pk, request.user)
        name   = folder.name
        folder.delete()           # M2M rows cascade; actual Files are untouched
        return success_response(message=f'Folder "{name}" deleted.')


# ─────────────────────────────────────────────────────────────────────────────
# Add / Remove files
# ─────────────────────────────────────────────────────────────────────────────

class FolderAddFilesView(APIView):
    """POST /api/files/folders/<pk>/add-files/  { file_ids: [...] }"""
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
    """POST /api/files/folders/<pk>/remove-files/  { file_ids: [...] }"""
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


# ─────────────────────────────────────────────────────────────────────────────
# Share files from a folder  (delegates to the same sharing logic)
# ─────────────────────────────────────────────────────────────────────────────

class FolderShareView(APIView):
    """
    POST /api/files/folders/<pk>/share/

    Body:
      {
        "file_ids":         ["uuid", ...],   # subset (or omit for all)
        "recipient_emails": ["a@b.com"],
        "expiration_hours": 24,
        "message":          "optional",
        "share_type":       "single" | "zip",  # single=one per file, zip=bundle
        "zip_name":         "MyFolder.zip"      # only for zip
      }

    Reuses the exact same service layer used by the Sharing page so behaviour
    is guaranteed identical.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        folder = get_object_or_404(Folder, pk=pk, owner=request.user)

        recipient_emails = request.data.get('recipient_emails', [])
        if not recipient_emails:
            raise ValidationError({'recipient_emails': 'At least one recipient email is required.'})

        expiration_hours = int(request.data.get('expiration_hours', 24))
        message          = request.data.get('message', '')
        share_type       = request.data.get('share_type', 'single')  # 'single' | 'zip'

        # Determine which files to share
        requested_ids = request.data.get('file_ids', [])
        if requested_ids:
            files = list(folder.files.filter(pk__in=requested_ids, is_deleted=False, owner=request.user))
        else:
            files = list(folder.files.filter(is_deleted=False, owner=request.user))

        if not files:
            raise ValidationError({'file_ids': 'No valid files found in this folder to share.'})

        expires_at = timezone.now() + timedelta(hours=expiration_hours)

        # ── Single-file mode: one share per file per recipient ──────────────
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

        # ── ZIP mode: bundle all selected files per recipient ───────────────
        from apps.sharing.models import ZipShare
        from apps.sharing.serializers import ZipShareSerializer

        zip_name = request.data.get('zip_name', '') or f'{folder.name}.zip'
        if not zip_name.endswith('.zip'):
            zip_name += '.zip'

        # Reuse the email helper from sharing views
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