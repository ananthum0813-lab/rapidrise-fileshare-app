import re
import os
import mimetypes
from django.conf import settings
from django.db.models import Sum
from rest_framework import serializers
from .models import File


def sanitize_filename(name: str) -> str:
    """
    Make a filename safe:
    - Strip directory traversal (e.g. ../../etc/passwd)
    - Replace dangerous characters
    - Collapse multiple dots (prevent .php.jpg tricks)
    """
    name = os.path.basename(name)
    name = re.sub(r'[^\w\s.\-]', '_', name).strip()
    name = re.sub(r'\.{2,}', '.', name)
    return name or 'unnamed_file'


def get_mime_type(file) -> str:
    """Detect MIME type from filename. Returns 'application/octet-stream' as fallback."""
    guessed, _ = mimetypes.guess_type(file.name)
    return guessed or 'application/octet-stream'


class FileSerializer(serializers.ModelSerializer):
    file_size_display = serializers.ReadOnlyField()

    class Meta:
        model = File
        fields = ['id', 'original_name', 'file_size', 'file_size_display', 'mime_type', 'uploaded_at']
        read_only_fields = fields


class FileUploadSerializer(serializers.Serializer):
    files = serializers.ListField(
        child=serializers.FileField(allow_empty_file=False),
        min_length=1,
        max_length=20,
        error_messages={'min_length': 'At least one file is required.'},
    )

    def validate_files(self, files):
        allowed_types = getattr(settings, 'ALLOWED_MIME_TYPES', set())
        max_size = settings.MAX_FILE_SIZE_BYTES
        errors = []

        for f in files:
            # Size check
            if f.size > max_size:
                errors.append(f"'{f.name}' is too large. Max size is {settings.MAX_FILE_SIZE_MB}MB.")
                continue

            # MIME type check against allowlist
            mime, _ = mimetypes.guess_type(f.name)
            if allowed_types and mime not in allowed_types:
                errors.append(f"'{f.name}' — file type '{mime or 'unknown'}' is not allowed.")

        if errors:
            raise serializers.ValidationError(errors)
        return files

    def validate(self, attrs):
        user = self.context['request'].user
        new_size = sum(f.size for f in attrs['files'])
        used = File.objects.filter(owner=user, is_deleted=False).aggregate(
            total=Sum('file_size')
        )['total'] or 0

        if used + new_size > settings.MAX_STORAGE_BYTES:
            available = (settings.MAX_STORAGE_BYTES - used) / (1024 * 1024)
            raise serializers.ValidationError(
                f'Storage limit exceeded. You only have {available:.1f}MB available.'
            )
        return attrs