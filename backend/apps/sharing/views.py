"""
apps/sharing/views.py
─────────────────────────────────────────────────────────────────────────────
CHANGES:
  1. CreateZipShareView         — NEW: bundles multiple files per recipient
  2. ZipShareListView           — NEW: list all zip shares
  3. RevokeZipShareView         — NEW: revoke zip share
  4. PublicZipShareInfoView     — NEW: public metadata for zip share page
  5. PublicZipShareDownloadView — NEW: streams ZIP archive on-the-fly
  6. ShareAnalyticsView         — UPDATED: removed events detail (was broken)
  7. GlobalShareAnalyticsView   — UPDATED: includes zip share totals
  8. All existing views unchanged / backward-compatible
"""

import io
import os
import zipfile
import logging

from django.http import FileResponse, Http404, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count, Q
from django.conf import settings
from django.utils import timezone

from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied, NotFound, ValidationError

from config.exceptions import success_response
from apps.files.models import File
from apps.files.serializers import FileSerializer, sanitize_filename, get_mime_type

from .models import FileShare, ShareAnalyticsEvent, FileRequest, RequestRecipient, SubmissionInbox, ZipShare
from .serializers import (
    CreateShareSerializer,
    FileShareSerializer,
    PublicShareSerializer,
    ShareAnalyticsEventSerializer,
    ShareAnalyticsSummarySerializer,
    FileRequestSerializer,
    CreateFileRequestSerializer,
    PublicRequestInfoSerializer,
    SubmissionInboxSerializer,
    ReviewSubmissionSerializer,
    CreateZipShareSerializer,
    ZipShareSerializer,
    PublicZipShareSerializer,
)
from .services import (
    create_shares,
    get_valid_share,
    get_valid_recipient,
    record_analytics_event,
    create_file_request,
    create_submission,
)

logger = logging.getLogger(__name__)

# ── Dangerous extensions always blocked ───────────────────────────────────────
BLOCKED_EXTENSIONS = {
    'exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'js', 'msi',
    'dll', 'com', 'scr', 'pif', 'reg', 'hta', 'jar',
}

DEFAULT_ALLOWED_MIMES = {
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'text/plain', 'text/csv',
    'application/zip', 'application/x-zip-compressed',
    'video/mp4', 'video/webm',
    'audio/mpeg', 'audio/wav',
}

MAX_FILE_SIZE_BYTES = getattr(settings, 'MAX_UPLOAD_SIZE_BYTES', 100 * 1024 * 1024)


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

class SharePagination(PageNumberPagination):
    page_size             = 10
    page_size_query_param = 'page_size'
    max_page_size         = 100


def _get_client_ip(request):
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    return xff.split(',')[0].strip() if xff else request.META.get('REMOTE_ADDR')


def _validate_file(uploaded_file, allowed_extensions=None):
    errors = []
    name   = uploaded_file.name or ''
    ext    = name.rsplit('.', 1)[-1].lower() if '.' in name else ''

    if uploaded_file.size > MAX_FILE_SIZE_BYTES:
        mb = MAX_FILE_SIZE_BYTES // (1024 * 1024)
        errors.append(f'File exceeds maximum size of {mb} MB.')

    if ext in BLOCKED_EXTENSIONS:
        errors.append(f'File type ".{ext}" is not allowed.')

    if allowed_extensions and ext not in [e.lower().lstrip('.') for e in allowed_extensions]:
        errors.append(f'File type ".{ext}" is not accepted for this request.')

    mime = get_mime_type(uploaded_file)
    allowed_mimes = getattr(settings, 'ALLOWED_MIME_TYPES', DEFAULT_ALLOWED_MIMES)
    if mime not in allowed_mimes:
        errors.append(f'MIME type "{mime}" is not permitted.')

    return errors, mime


def _zip_stream_generator(files_queryset):
    """
    Generator that yields ZIP bytes on-the-fly without writing to disk.
    Uses Python's zipfile with a BytesIO buffer per file.
    """
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, mode='w', compression=zipfile.ZIP_DEFLATED, allowZip64=True) as zf:
        for file_obj in files_queryset:
            try:
                if not file_obj.file or not file_obj.file.name:
                    continue
                file_path = file_obj.file.path
                if not os.path.exists(file_path):
                    continue
                zf.write(file_path, arcname=file_obj.original_name)
            except Exception as e:
                logger.warning('_zip_stream_generator: skipped %s — %s', file_obj.pk, e)

    buf.seek(0)
    while True:
        chunk = buf.read(65536)
        if not chunk:
            break
        yield chunk


# ──────────────────────────────────────────────────────────────────────────────
# File Duplicate Detection
# ──────────────────────────────────────────────────────────────────────────────

class CheckDuplicateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sha256 = request.data.get('sha256', '').strip().lower()
        if not sha256 or len(sha256) != 64:
            raise ValidationError({'sha256': 'Valid SHA-256 hex string required.'})

        duplicate = File.objects.filter(
            owner=request.user, sha256=sha256, is_deleted=False,
        ).first()

        if not duplicate:
            return success_response(data={'is_duplicate': False}, message='No duplicate found.')

        return success_response(
            data={
                'is_duplicate': True,
                'existing_file': FileSerializer(duplicate, context={'request': request}).data,
            },
            message='Duplicate file detected.',
        )


# ──────────────────────────────────────────────────────────────────────────────
# Single-file Share (unchanged)
# ──────────────────────────────────────────────────────────────────────────────

class CreateShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        raw = request.data.get('recipient_emails') or request.data.get('recipient_email', '')
        emails = [e.strip() for e in raw.split(',') if e.strip()] if isinstance(raw, str) else list(raw)

        serializer = CreateShareSerializer(
            data={**request.data, 'recipient_emails': emails},
            context={'request': request},
        )
        serializer.is_valid(raise_exception=True)

        shares = create_shares(
            user=request.user,
            file=serializer.context['file'],
            recipient_emails=serializer.validated_data['recipient_emails'],
            expiration_hours=serializer.validated_data['expiration_hours'],
            message=serializer.validated_data.get('message', ''),
        )

        return success_response(
            data={'shares': FileShareSerializer(shares, many=True).data, 'count': len(shares)},
            message=f'File shared with {len(shares)} recipient(s).',
            status_code=status.HTTP_201_CREATED,
        )


# ──────────────────────────────────────────────────────────────────────────────
# NEW: Multi-file ZIP Share
# ──────────────────────────────────────────────────────────────────────────────

class CreateZipShareView(APIView):
    """
    POST /api/sharing/zip/create/
    Creates one ZipShare record per recipient. Each gets a unique download URL
    that streams all selected files as a single ZIP archive.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateZipShareSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        d         = serializer.validated_data
        files     = serializer.context['files']
        emails    = d['recipient_emails']
        zip_name  = d.get('zip_name', 'shared_files.zip')
        message   = d.get('message', '')
        exp_hours = d['expiration_hours']

        from datetime import timedelta
        expires_at = timezone.now() + timedelta(hours=exp_hours)

        zip_shares = []
        for email in emails:
            zs = ZipShare.objects.create(
                shared_by=request.user,
                recipient_email=email,
                message=message,
                zip_name=zip_name,
                expires_at=expires_at,
                file_count=len(files),
            )
            zs.files.set(files)
            zip_shares.append(zs)

        return success_response(
            data={
                'zip_shares': ZipShareSerializer(zip_shares, many=True).data,
                'count': len(zip_shares),
                'file_count': len(files),
            },
            message=(
                f'{len(files)} files bundled into a ZIP and shared with '
                f'{len(zip_shares)} recipient(s). Each gets a unique download link.'
            ),
            status_code=status.HTTP_201_CREATED,
        )


class ZipShareListView(APIView):
    """GET /api/sharing/zip/ — list all zip shares for the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = ZipShare.objects.filter(shared_by=request.user).prefetch_related('files')
        status_filter = request.query_params.get('status', '').strip()
        if status_filter in [c[0] for c in ZipShare.Status.choices]:
            qs = qs.filter(status=status_filter)

        paginator = SharePagination()
        page = paginator.paginate_queryset(qs, request)
        return success_response(data={
            'results':      ZipShareSerializer(page, many=True).data,
            'count':        paginator.page.paginator.count,
            'total_pages':  paginator.page.paginator.num_pages,
            'current_page': paginator.page.number,
        })


class RevokeZipShareView(APIView):
    """POST /api/sharing/zip/<pk>/revoke/"""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        zs = get_object_or_404(ZipShare, pk=pk)
        if zs.shared_by != request.user:
            raise PermissionDenied('You can only revoke ZIP shares you created.')
        if zs.status == ZipShare.Status.REVOKED:
            return success_response(message='This ZIP share is already revoked.')
        zs.revoke()
        return success_response(message='ZIP share revoked successfully.')


class PublicZipShareInfoView(APIView):
    """GET /api/sharing/public/zip/<token>/ — no auth"""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            zs = ZipShare.objects.prefetch_related('files').get(share_token=str(token))
        except ZipShare.DoesNotExist:
            raise NotFound('ZIP share not found.')

        if not zs.is_active:
            raise NotFound('This ZIP share link has expired or been revoked.')

        return success_response(data=PublicZipShareSerializer(zs).data)


class PublicZipShareDownloadView(APIView):
    """
    GET /api/sharing/public/zip/<token>/download/
    Streams all files in the ZipShare as a single ZIP archive on-the-fly.
    No auth — public download link.
    """
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            zs = ZipShare.objects.prefetch_related('files').get(share_token=str(token))
        except ZipShare.DoesNotExist:
            raise NotFound('ZIP share not found.')

        if not zs.is_active:
            raise NotFound('This ZIP share link has expired or been revoked.')

        files = zs.files.filter(is_deleted=False)
        if not files.exists():
            raise NotFound('No files available in this ZIP share.')

        ip         = _get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        zs.mark_accessed(ip=ip, user_agent=user_agent)

        response = StreamingHttpResponse(
            _zip_stream_generator(files),
            content_type='application/zip',
        )
        response['Content-Disposition']    = f'attachment; filename="{zs.zip_name}"'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control']          = 'no-cache, no-store, must-revalidate'
        return response


# ──────────────────────────────────────────────────────────────────────────────
# Share List / Revoke / Analytics (updated to include zip totals)
# ──────────────────────────────────────────────────────────────────────────────

class SharedFileListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = FileShare.objects.filter(shared_by=request.user).select_related('file')
        status_filter = request.query_params.get('status', '').strip()
        if status_filter in [c[0] for c in FileShare.Status.choices]:
            qs = qs.filter(status=status_filter)
        file_id = request.query_params.get('file_id', '').strip()
        if file_id:
            qs = qs.filter(file__id=file_id)

        paginator = SharePagination()
        page = paginator.paginate_queryset(qs, request)
        return success_response(data={
            'results':      FileShareSerializer(page, many=True).data,
            'count':        paginator.page.paginator.count,
            'total_pages':  paginator.page.paginator.num_pages,
            'current_page': paginator.page.number,
            'next':         paginator.get_next_link(),
            'previous':     paginator.get_previous_link(),
        })


class RevokeShareView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        share = get_object_or_404(FileShare, pk=pk)
        if share.shared_by != request.user:
            raise PermissionDenied('You can only revoke shares you created.')
        if share.status == FileShare.Status.REVOKED:
            return success_response(message='This share is already revoked.')
        share.revoke()
        return success_response(message='Share link revoked successfully.')


class ShareAnalyticsView(APIView):
    """GET /api/sharing/<pk>/analytics/ — summary only, no event log."""
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        share = get_object_or_404(FileShare, pk=pk, shared_by=request.user)
        return success_response(data=ShareAnalyticsSummarySerializer(share).data)


class GlobalShareAnalyticsView(APIView):
    """GET /api/sharing/analytics/ — aggregated totals across single + zip shares."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Single-file shares
        fs_qs  = FileShare.objects.filter(shared_by=request.user)
        fs_agg = fs_qs.aggregate(
            total_shares=Count('id'),
            total_downloads=Sum('download_count'),
            total_views=Sum('view_count'),
            active_count=Count('id', filter=Q(status='active')),
            expired_count=Count('id', filter=Q(status='expired')),
            revoked_count=Count('id', filter=Q(status='revoked')),
        )

        # ZIP shares
        zs_qs  = ZipShare.objects.filter(shared_by=request.user)
        zs_agg = zs_qs.aggregate(
            total_zip_shares=Count('id'),
            total_zip_downloads=Sum('download_count'),
            zip_active=Count('id', filter=Q(status='active')),
            zip_expired=Count('id', filter=Q(status='expired')),
            zip_revoked=Count('id', filter=Q(status='revoked')),
        )

        top_shares = fs_qs.order_by('-download_count')[:5]
        top_zips   = zs_qs.order_by('-download_count')[:5]

        return success_response(data={
            'single_file': fs_agg,
            'zip_shares':  zs_agg,
            # Legacy key for backward compat
            'totals': {
                'total_shares':    (fs_agg['total_shares'] or 0) + (zs_agg['total_zip_shares'] or 0),
                'total_downloads': (fs_agg['total_downloads'] or 0) + (zs_agg['total_zip_downloads'] or 0),
                'total_views':     fs_agg['total_views'] or 0,
                'active_count':    (fs_agg['active_count'] or 0) + (zs_agg['zip_active'] or 0),
                'expired_count':   (fs_agg['expired_count'] or 0) + (zs_agg['zip_expired'] or 0),
                'revoked_count':   (fs_agg['revoked_count'] or 0) + (zs_agg['zip_revoked'] or 0),
            },
            'top_shares': FileShareSerializer(top_shares, many=True).data,
            'top_zips':   ZipShareSerializer(top_zips, many=True).data,
        })


# ──────────────────────────────────────────────────────────────────────────────
# Public Share endpoints (unchanged)
# ──────────────────────────────────────────────────────────────────────────────

class PublicShareInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            share = get_valid_share(str(token))
        except ValueError as e:
            raise NotFound(str(e))

        ip         = _get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        share.mark_viewed(ip=ip, user_agent=user_agent)
        record_analytics_event(share, ShareAnalyticsEvent.EventType.VIEW, ip=ip, user_agent=user_agent)
        return success_response(data=PublicShareSerializer(share).data)


class PublicShareDownloadView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            share = get_valid_share(str(token))
        except ValueError as e:
            raise NotFound(str(e))

        file_obj = share.file
        if file_obj.is_deleted:
            raise NotFound('The shared file has been deleted by its owner.')
        if not file_obj.file or not file_obj.file.name:
            raise Http404

        try:
            path = file_obj.file.path
        except Exception:
            raise Http404

        if not os.path.exists(path):
            raise Http404

        ip         = _get_client_ip(request)
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        share.mark_accessed(ip=ip, user_agent=user_agent)
        record_analytics_event(share, ShareAnalyticsEvent.EventType.DOWNLOAD, ip=ip, user_agent=user_agent)

        response = FileResponse(open(path, 'rb'), content_type=file_obj.mime_type or 'application/octet-stream')
        response['Content-Disposition']    = f'attachment; filename="{file_obj.original_name}"'
        response['Content-Length']         = file_obj.file_size
        response['X-Content-Type-Options'] = 'nosniff'
        response['Cache-Control']          = 'no-cache, no-store, must-revalidate'
        return response


# ──────────────────────────────────────────────────────────────────────────────
# File Requests — authenticated owner CRUD (unchanged)
# ──────────────────────────────────────────────────────────────────────────────

class FileRequestListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = FileRequest.objects.filter(owner=request.user).prefetch_related('recipients')
        status_filter = request.query_params.get('status', '').strip()
        if status_filter in [c[0] for c in FileRequest.Status.choices]:
            qs = qs.filter(status=status_filter)

        paginator = SharePagination()
        page = paginator.paginate_queryset(qs, request)
        return success_response(data={
            'results':      FileRequestSerializer(page, many=True).data,
            'count':        paginator.page.paginator.count,
            'total_pages':  paginator.page.paginator.num_pages,
            'current_page': paginator.page.number,
        })

    def post(self, request):
        serializer = CreateFileRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        req = create_file_request(
            owner=request.user,
            title=d['title'],
            description=d.get('description', ''),
            recipient_emails=d.get('all_recipient_emails', []),
            recipient_email=d.get('recipient_email', ''),
            expiration_hours=d.get('expiration_hours', 168),
            max_files=d.get('max_files', 10),
            required_files=d.get('required_files', []),
            allowed_extensions=d.get('allowed_extensions', []),
        )
        return success_response(
            data=FileRequestSerializer(req).data,
            message='File request created. Unique upload links sent to all recipients.',
            status_code=status.HTTP_201_CREATED,
        )


class FileRequestDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_obj(self, pk, user):
        req = get_object_or_404(FileRequest, pk=pk)
        if req.owner != user:
            raise PermissionDenied('Not your request.')
        return req

    def get(self, request, pk):
        req = self._get_obj(pk, request.user)
        return success_response(data=FileRequestSerializer(req).data)

    def delete(self, request, pk):
        req = self._get_obj(pk, request.user)
        req.close()
        return success_response(message='File request closed.')


# ──────────────────────────────────────────────────────────────────────────────
# Public recipient-specific upload endpoints
# ──────────────────────────────────────────────────────────────────────────────

class PublicRecipientInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            recipient = get_valid_recipient(str(token))
        except ValueError as e:
            raise NotFound(str(e))

        req = recipient.file_request
        remaining = max(0, req.max_files - req.submission_count)

        data = PublicRequestInfoSerializer({
            'id':                    req.id,
            'title':                 req.title,
            'description':           req.description,
            'owner_name':            getattr(req.owner, 'full_name', None) or req.owner.email,
            'expires_at':            req.expires_at,
            'max_files':             req.max_files,
            'allowed_extensions':    req.allowed_extensions,
            'required_files':        req.required_files,
            'submission_count':      req.submission_count,
            'remaining_slots':       remaining,
            'recipient_email':       recipient.email,
            'recipient_name':        recipient.name,
            'recipient_upload_count': recipient.upload_count,
        }).data

        return success_response(data=data)


class PublicRecipientUploadView(APIView):
    """
    POST /api/sharing/requests/upload/<token>/
    Security layers (before Celery async scan):
      1. Token validation
      2. Slot check
      3. Size, extension, MIME validation
      4. File saved with scan_status=SCANNING
      5. scan_uploaded_file.delay() queued
    """
    permission_classes = [AllowAny]

    def post(self, request, token):
        try:
            recipient = get_valid_recipient(str(token))
        except ValueError as e:
            raise ValidationError({'token': str(e)})

        req = recipient.file_request

        current_count = req.submission_count
        if current_count >= req.max_files:
            raise ValidationError({
                'files': f'This request has reached its limit of {req.max_files} files.'
            })

        files = request.FILES.getlist('files')
        if not files:
            raise ValidationError({'files': 'No files provided.'})

        remaining_slots = req.max_files - current_count
        if len(files) > remaining_slots:
            raise ValidationError({
                'files': f'Only {remaining_slots} more file(s) can be uploaded to this request.'
            })

        ip = _get_client_ip(request)
        created = []
        errors  = []

        for f in files:
            validation_errors, mime = _validate_file(f, req.allowed_extensions or None)
            if validation_errors:
                errors.append({'file': f.name, 'errors': validation_errors})
                continue

            try:
                clean_name  = sanitize_filename(f.name)
                file_record = File.objects.create(
                    owner=req.owner,
                    original_name=clean_name,
                    file=f,
                    file_size=f.size,
                    mime_type=mime,
                    scan_status=File.ScanStatus.SCANNING,
                )

                submission = create_submission(
                    owner=req.owner,
                    source_type=SubmissionInbox.SourceType.FILE_REQUEST,
                    original_filename=clean_name,
                    file_size=f.size,
                    mime_type=mime,
                    submitter_email=recipient.email,
                    submitter_name=recipient.name,
                    submitter_ip=ip,
                    file_request=req,
                    recipient=recipient,
                    file=file_record,
                )
                created.append({
                    'filename': clean_name,
                    'size':     f.size,
                    'scan_status': 'scanning',
                })

                try:
                    from .tasks import scan_uploaded_file
                    scan_uploaded_file.apply_async(
                        args=[str(file_record.id)],
                        queue='file_scan',
                    )
                except Exception:
                    logger.exception('Failed to queue scan task for file %s', file_record.id)

            except Exception as e:
                logger.exception('Upload failed for file %s', f.name)
                errors.append({'file': f.name, 'errors': [f'Upload failed: {str(e)}']})

        if created:
            recipient.record_upload(ip=ip)

        if not created:
            return success_response(
                data={'submitted': 0, 'errors': errors},
                message='No files were uploaded. See errors.',
                status_code=status.HTTP_400_BAD_REQUEST,
            )

        return success_response(
            data={
                'submitted': len(created),
                'files':     created,
                'errors':    errors or None,
                'message': (
                    'Files uploaded successfully. '
                    'Security scanning is in progress — files will be available after scan completes.'
                ),
            },
            message=f'{len(created)} file(s) uploaded and queued for security scanning.',
            status_code=status.HTTP_201_CREATED,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Legacy: shared-token public upload
# ──────────────────────────────────────────────────────────────────────────────

class PublicFileRequestInfoView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, token):
        req = get_object_or_404(FileRequest, upload_token=token, status=FileRequest.Status.OPEN)
        if req.is_expired:
            req.close()
            raise NotFound('This upload request has expired.')
        return success_response(data=FileRequestSerializer(req).data)


class PublicFileRequestUploadView(APIView):
    """Legacy shared-token upload — no per-recipient tracking."""
    permission_classes = [AllowAny]

    def post(self, request, token):
        req = get_object_or_404(FileRequest, upload_token=token, status=FileRequest.Status.OPEN)
        if req.is_expired:
            req.close()
            raise NotFound('This upload request has expired.')

        files = request.FILES.getlist('files')
        if not files:
            raise ValidationError({'files': 'No files provided.'})

        if len(files) > req.max_files:
            raise ValidationError({'files': f'Maximum {req.max_files} files allowed.'})

        submitter_email = request.data.get('submitter_email', '').strip()
        submitter_name  = request.data.get('submitter_name', '').strip()
        ip = _get_client_ip(request)

        created = []
        errors  = []

        for f in files:
            validation_errors, mime = _validate_file(f)
            if validation_errors:
                errors.append({'file': f.name, 'errors': validation_errors})
                continue

            try:
                clean_name  = sanitize_filename(f.name)
                file_record = File.objects.create(
                    owner=req.owner,
                    original_name=clean_name,
                    file=f,
                    file_size=f.size,
                    mime_type=mime,
                    scan_status=File.ScanStatus.SCANNING,
                )
                submission = create_submission(
                    owner=req.owner,
                    source_type=SubmissionInbox.SourceType.FILE_REQUEST,
                    original_filename=clean_name,
                    file_size=f.size,
                    mime_type=mime,
                    submitter_email=submitter_email,
                    submitter_name=submitter_name,
                    submitter_ip=ip,
                    file_request=req,
                    file=file_record,
                )
                created.append(submission.id)

                try:
                    from .tasks import scan_uploaded_file
                    scan_uploaded_file.apply_async(
                        args=[str(file_record.id)],
                        queue='file_scan',
                    )
                except Exception:
                    logger.exception('Failed to queue scan for file %s', file_record.id)

            except Exception as e:
                errors.append({'file': f.name, 'errors': [str(e)]})

        return success_response(
            data={'submitted': len(created), 'errors': errors or None},
            message=f'{len(created)} file(s) submitted and queued for scanning.',
            status_code=status.HTTP_201_CREATED if created else status.HTTP_400_BAD_REQUEST,
        )


# ──────────────────────────────────────────────────────────────────────────────
# Submission Inbox
# ──────────────────────────────────────────────────────────────────────────────

class SubmissionInboxListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = (
            SubmissionInbox.objects
            .filter(owner=request.user)
            .select_related('file', 'file_request', 'recipient')
        )

        status_filter = request.query_params.get('status', '').strip()
        if status_filter:
            qs = qs.filter(status=status_filter)

        source_filter = request.query_params.get('source_type', '').strip()
        if source_filter:
            qs = qs.filter(source_type=source_filter)

        scan_filter = request.query_params.get('scan_status', '').strip()
        if scan_filter:
            qs = qs.filter(file__scan_status=scan_filter)

        counts = qs.values('status').annotate(n=Count('id'))
        status_counts = {row['status']: row['n'] for row in counts}

        scan_counts = (
            SubmissionInbox.objects
            .filter(owner=request.user)
            .values('file__scan_status')
            .annotate(n=Count('id'))
        )
        scan_status_counts = {
            row['file__scan_status']: row['n']
            for row in scan_counts if row['file__scan_status']
        }

        paginator = SharePagination()
        page = paginator.paginate_queryset(qs, request)

        return success_response(data={
            'results':           SubmissionInboxSerializer(page, many=True, context={'request': request}).data,
            'count':             paginator.page.paginator.count,
            'total_pages':       paginator.page.paginator.num_pages,
            'current_page':      paginator.page.number,
            'status_counts':     status_counts,
            'scan_status_counts': scan_status_counts,
        })


class ReviewSubmissionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        submission = get_object_or_404(SubmissionInbox, pk=pk, owner=request.user)

        if request.data.get('action') == 'approve':
            if submission.file and submission.file.scan_status != File.ScanStatus.SAFE:
                raise ValidationError({
                    'action': 'Cannot approve a file that has not passed security scanning.'
                })

        serializer = ReviewSubmissionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        action = serializer.validated_data['action']
        note   = serializer.validated_data.get('note', '')

        if action == 'approve':
            submission.approve(note=note)
        elif action == 'reject':
            submission.reject(reason=note)
        elif action == 'needs_action':
            submission.mark_needs_action(note=note)
        elif action == 'complete':
            submission.mark_complete()

        return success_response(
            data=SubmissionInboxSerializer(submission, context={'request': request}).data,
            message=f'Submission marked as {action}.',
        )


class DeleteInfectedFileView(APIView):
    """
    DELETE /api/sharing/inbox/<pk>/delete-file/
    Owner only. Permanently deletes INFECTED or SCAN_FAILED files.
    """
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        submission = get_object_or_404(SubmissionInbox, pk=pk, owner=request.user)
        file_obj   = submission.file

        if file_obj and file_obj.scan_status not in (
            File.ScanStatus.INFECTED,
            File.ScanStatus.SCAN_FAILED,
        ):
            raise ValidationError({
                'detail': (
                    'This endpoint is only for deleting infected or scan-failed files. '
                    'Use the standard delete endpoint for safe files.'
                )
            })

        filename = submission.original_filename

        if file_obj:
            try:
                file_obj.hard_delete()
            except Exception:
                logger.exception('Failed to hard-delete file %s', file_obj.pk)

        submission.delete()

        return success_response(
            message=f'Infected file "{filename}" has been permanently deleted.',
        )