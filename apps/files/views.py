import os

from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count
from django.conf import settings
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination

from config.exceptions import success_response
from .models import File
from .serializers import FileSerializer, FileUploadSerializer, sanitize_filename, get_mime_type
from .permissions import IsFileOwner


class FilePagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class FileUploadView(APIView):
    """Upload one or multiple files (multipart/form-data, field name: 'files')."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        files = request.FILES.getlist('files')
        if not files:
            from rest_framework.exceptions import ValidationError
            raise ValidationError({'files': 'No files provided.'})

        serializer = FileUploadSerializer(data={'files': files}, context={'request': request})
        serializer.is_valid(raise_exception=True)

        uploaded = []
        for f in files:
            record = File.objects.create(
                owner=request.user,
                original_name=sanitize_filename(f.name),
                file=f,
                file_size=f.size,
                mime_type=get_mime_type(f),
            )
            uploaded.append(FileSerializer(record).data)

        return success_response(
            data={'uploaded': uploaded, 'count': len(uploaded)},
            message=f'{len(uploaded)} file(s) uploaded successfully.',
            status_code=status.HTTP_201_CREATED,
        )


class FileListView(APIView):
    """List all files for the authenticated user, with search and ordering."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = File.objects.filter(owner=request.user, is_deleted=False)

        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(original_name__icontains=search)

        ordering = request.query_params.get('ordering', '-uploaded_at')
        valid_orderings = ['uploaded_at', '-uploaded_at', 'original_name', '-original_name', 'file_size', '-file_size']
        if ordering in valid_orderings:
            qs = qs.order_by(ordering)

        paginator = FilePagination()
        page = paginator.paginate_queryset(qs, request)

        return success_response(data={
            'results': FileSerializer(page, many=True).data,
            'count': paginator.page.paginator.count,
            'total_pages': paginator.page.paginator.num_pages,
            'current_page': paginator.page.number,
            'next': paginator.get_next_link(),
            'previous': paginator.get_previous_link(),
        })


class FileDetailView(APIView):
    """Get or delete a specific file. Only the owner can access."""
    permission_classes = [IsAuthenticated, IsFileOwner]

    def get_object(self, pk):
        obj = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(self.request, obj)
        return obj

    def get(self, request, pk):
        return success_response(data=FileSerializer(self.get_object(pk)).data)

    def delete(self, request, pk):
        file = self.get_object(pk)
        name = file.original_name
        file.delete_file()
        return success_response(message=f"'{name}' deleted successfully.")


class FileDownloadView(APIView):
    """Download a file. Only the owner can download."""
    permission_classes = [IsAuthenticated, IsFileOwner]

    def get(self, request, pk):
        file = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(request, file)

        if not file.file or not file.file.name:
            raise Http404('File not found on storage.')

        try:
            path = file.file.path
        except Exception:
            raise Http404('File not found on storage.')

        if not os.path.exists(path):
            raise Http404('File not found on storage.')

        response = FileResponse(
            open(path, 'rb'),
            content_type=file.mime_type or 'application/octet-stream',
        )
        response['Content-Disposition'] = f'attachment; filename="{file.original_name}"'
        response['Content-Length'] = file.file_size
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'"
        return response


class StorageInfoView(APIView):
    """Get storage usage stats for the authenticated user."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Single query for both used bytes and file count
        result = File.objects.filter(owner=request.user, is_deleted=False).aggregate(
            used=Sum('file_size'),
            file_count=Count('id'),
        )
        used = result['used'] or 0
        total = settings.MAX_STORAGE_BYTES

        return success_response(data={
            'used_bytes': used,
            'total_bytes': total,
            'used_mb': round(used / (1024 * 1024), 2),
            'total_gb': settings.MAX_STORAGE_GB,
            'usage_percent': round((used / total) * 100, 2) if total else 0,
            'file_count': result['file_count'],
        })