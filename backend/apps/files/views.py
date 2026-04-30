import os

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


class FileUploadView(APIView):
    """Upload one or multiple files (multipart/form-data, field name: 'files')."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        files = request.FILES.getlist('files')
        if not files:
            raise ValidationError({'files': 'No files provided.'})

        user = request.user
        
        # Calculate current usage
        used_bytes = File.objects.filter(
            owner=user,
            is_deleted=False
        ).aggregate(total=Sum('file_size'))['total'] or 0
        
        total_allowed = settings.MAX_STORAGE_BYTES
        available = total_allowed - used_bytes

        uploaded = []
        errors = []

        for f in files:
            # Validate file size
            if f.size > settings.MAX_FILE_SIZE_BYTES:
                errors.append(f'{f.name}: Exceeds max size ({settings.MAX_FILE_SIZE_MB}MB)')
                continue

            # Validate user storage
            if f.size > available:
                errors.append(f'{f.name}: Not enough storage space')
                continue

            # Validate MIME type
            mime_type = get_mime_type(f)
            if mime_type not in settings.ALLOWED_MIME_TYPES:
                errors.append(f'{f.name}: File type not allowed')
                continue

            try:
                record = File.objects.create(
                    owner=user,
                    original_name=sanitize_filename(f.name),
                    file=f,
                    file_size=f.size,
                    mime_type=mime_type,
                )
                uploaded.append(FileSerializer(record).data)
                available -= f.size
            except Exception as e:
                errors.append(f'{f.name}: Upload failed - {str(e)}')

        return success_response(
            data={
                'uploaded': uploaded,
                'errors': errors if errors else None,
                'count': len(uploaded),
            },
            message=f'{len(uploaded)} file(s) uploaded successfully.' if uploaded else 'Upload failed.',
            status_code=status.HTTP_201_CREATED if uploaded else status.HTTP_400_BAD_REQUEST,
        )


class FileListView(APIView):
    """List all files for the authenticated user, with search and ordering."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = File.objects.filter(owner=request.user, is_deleted=False)

        # Search
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(original_name__icontains=search)

        # Ordering
        ordering = request.query_params.get('ordering', '-uploaded_at')
        valid_orderings = ['uploaded_at', '-uploaded_at', 'original_name', '-original_name', 'file_size', '-file_size']
        if ordering in valid_orderings:
            qs = qs.order_by(ordering)

        # Pagination
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
        """Get file details."""
        file_obj = self.get_object(pk)
        return success_response(data=FileSerializer(file_obj).data)

    def delete(self, request, pk):
        """Delete a file (soft delete)."""
        file_obj = self.get_object(pk)
        name = file_obj.original_name
        file_obj.delete_file()
        return success_response(message=f"'{name}' deleted successfully.")


class FileDownloadView(APIView):
    """Download a file. Only the owner can download."""
    permission_classes = [IsAuthenticated, IsFileOwner]

    def get(self, request, pk):
        file_obj = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(request, file_obj)
        file_path = file_obj.file.path
        if os.path.exists(file_path):
            response = FileResponse(open(file_path, 'rb'), as_attachment=True, filename=file_obj.original_name)
            return response
        raise NotFound('File not found on server.')

"""
CORRECTED FileRenameView with Filename Uniqueness Validation
Location: apps/files/views.py
Purpose: Ensure each file has a unique name per user
"""

class FileRenameView(APIView):
    """
    Rename a file while maintaining filename uniqueness per user.
    
    SECURITY & UNIQUENESS:
    ✅ Only filename owner can rename
    ✅ Extension is protected (cannot be changed)
    ✅ Filename must be unique (per user, excluding deleted files)
    ✅ Cannot rename to existing filename
    ✅ Case-insensitive uniqueness check
    """
    permission_classes = [IsAuthenticated, IsFileOwner]

    def post(self, request, pk):
        file_obj = get_object_or_404(File, pk=pk, is_deleted=False)
        self.check_object_permissions(request, file_obj)
        
        new_name = request.data.get('new_name', '').strip()
        if not new_name:
            raise ValidationError({'new_name': 'New filename is required.'})
        
        # Extract original file extension
        original_name = file_obj.original_name
        if '.' in original_name:
            original_ext = '.' + original_name.rsplit('.', 1)[1]
        else:
            original_ext = ''
        
        # Remove extension from new_name if user provided one
        if '.' in new_name:
            new_name = new_name.rsplit('.', 1)[0]
        
        # Sanitize and reconstruct: filename + original_extension
        new_name = sanitize_filename(new_name)
        new_name = new_name + original_ext
        
        # Prevent no-op renames
        if new_name == original_name:
            raise ValidationError({'new_name': 'New filename is the same as current.'})
        
        # ✅ CHECK UNIQUENESS: Ensure filename doesn't exist for this user
        # Exclude deleted files and the current file being renamed
        filename_exists = File.objects.filter(
            owner=request.user,
            original_name=new_name,
            is_deleted=False
        ).exclude(pk=pk).exists()
        
        if filename_exists:
            raise ValidationError({
                'new_name': f"You already have a file named '{new_name}'. Please choose a different name."
            })
        
        # ✅ RENAME: Update the filename
        file_obj.original_name = new_name
        file_obj.save(update_fields=['original_name'])
        
        return success_response(
            data=FileSerializer(file_obj).data,
            message=f"Renamed '{original_name}' to '{new_name}'."
        )

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