from rest_framework import serializers
from apps.files.models import File
from .models import FileShare


class CreateShareSerializer(serializers.Serializer):
    file_id = serializers.UUIDField()
    recipient_email = serializers.EmailField()
    expiration_hours = serializers.IntegerField(
        min_value=1,
        max_value=720,
        help_text='Hours until the link expires (1–720).',
    )
    message = serializers.CharField(max_length=1000, required=False, allow_blank=True, default='')

    def validate_file_id(self, value):
        user = self.context['request'].user
        try:
            file = File.objects.get(pk=value, owner=user, is_deleted=False)
        except File.DoesNotExist:
            raise serializers.ValidationError('File not found or you do not have permission to share it.')
        self.context['file'] = file
        return value

    def validate_recipient_email(self, value):
        return value.lower().strip()


class FileShareSerializer(serializers.ModelSerializer):
    file_name = serializers.CharField(source='file.original_name', read_only=True)
    file_size_display = serializers.CharField(source='file.file_size_display', read_only=True)
    share_url = serializers.ReadOnlyField()
    has_been_accessed = serializers.ReadOnlyField()
    is_active = serializers.ReadOnlyField()

    class Meta:
        model = FileShare
        fields = [
            'id', 'file_name', 'file_size_display',
            'recipient_email', 'message',
            'share_url', 'status',
            'shared_at', 'expires_at',
            'accessed_at', 'download_count',
            'has_been_accessed', 'is_active',
        ]
        read_only_fields = fields


class PublicShareSerializer(serializers.ModelSerializer):
    """Minimal info returned to public (unauthenticated) users viewing a share link."""
    file_name = serializers.CharField(source='file.original_name', read_only=True)
    file_size_display = serializers.CharField(source='file.file_size_display', read_only=True)
    mime_type = serializers.CharField(source='file.mime_type', read_only=True)

    class Meta:
        model = FileShare
        fields = ['id', 'file_name', 'file_size_display', 'mime_type', 'message', 'shared_at', 'expires_at']
        read_only_fields = fields