import os

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied, NotFound

from config.exceptions import success_response
from .models import FileShare
from .serializers import CreateShareSerializer, FileShareSerializer, PublicShareSerializer
from .services import create_share, get_valid_share


class SharePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class CreateShareView(APIView):
    """Share a file with a recipient via email."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = CreateShareSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        share = create_share(
            user=request.user,
            file=serializer.context['file'],
            recipient_email=serializer.validated_data['recipient_email'],
            expiration_hours=serializer.validated_data['expiration_hours'],
            message=serializer.validated_data.get('message', ''),
        )

        return success_response(
            data=FileShareSerializer(share).data,
            message=f'File shared. A download link has been sent to {share.recipient_email}.',
            status_code=status.HTTP_201_CREATED,
        )


class SharedFileListView(APIView):
    """List all shares created by the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = FileShare.objects.filter(shared_by=request.user).select_related('file')

        status_filter = request.query_params.get('status', '').strip()
        if status_filter in FileShare.Status.values:
            qs = qs.filter(status=status_filter)

        paginator = SharePagination()
        page = paginator.paginate_queryset(qs, request)

        return success_response(data={
            'results': FileShareSerializer(page, many=True).data,
            'count': paginator.page.paginator.count,
            'total_pages': paginator.page.paginator.num_pages,
            'current_page': paginator.page.number,
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
        })


class RevokeShareView(APIView):
    """Revoke an active share link. Only the creator can revoke."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        share = get_object_or_404(FileShare, pk=pk)
        if share.shared_by != request.user:
            raise PermissionDenied('You can only revoke shares you created.')
        if share.status == FileShare.Status.REVOKED:
            return success_response(message='This share is already revoked.')
        share.revoke()
        return success_response(message='Share link revoked successfully.')


# ── Public endpoints (no authentication required) ──────────────────────────────

class PublicShareInfoView(APIView):
    """View shared file info using the share token. No login required."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            share = get_valid_share(str(token))
        except ValueError as e:
            raise NotFound(str(e))
        return success_response(data=PublicShareSerializer(share).data)


class PublicShareDownloadView(APIView):
    """Download a shared file using the share token. No login required."""
    permission_classes = [AllowAny]

    def get(self, request, token):
        try:
            share = get_valid_share(str(token))
        except ValueError as e:
            raise NotFound(str(e))

        file = share.file
        if file.is_deleted:
            raise NotFound('The shared file has been deleted by its owner.')

        if not file.file or not file.file.name:
            raise Http404('File not found on storage.')

        try:
            path = file.file.path
        except Exception:
            raise Http404('File not found on storage.')

        if not os.path.exists(path):
            raise Http404('File not found on storage.')

        share.mark_accessed()

        response = FileResponse(
            open(path, 'rb'),
            content_type=file.mime_type or 'application/octet-stream',
        )
        response['Content-Disposition'] = f'attachment; filename="{file.original_name}"'
        response['Content-Length'] = file.file_size
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'"
        return response