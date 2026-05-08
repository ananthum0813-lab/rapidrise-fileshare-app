import uuid
import os
from django.db import models
from django.conf import settings
from django.utils import timezone


def user_upload_path(instance, filename):
    """Store files in user-specific directories with UUID names to prevent conflicts."""
    ext = os.path.splitext(filename)[1].lower()
    return f'uploads/{instance.owner.id}/{uuid.uuid4().hex}{ext}'


class File(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='files',
    )
    original_name = models.CharField(max_length=255)
    file = models.FileField(upload_to=user_upload_path)
    file_size = models.BigIntegerField(help_text='Size in bytes')
    mime_type = models.CharField(max_length=100, blank=True)
    uploaded_at = models.DateTimeField(default=timezone.now)
    
    # ✨ NEW FIELDS FOR NEW FEATURES
    is_deleted = models.BooleanField(default=False, db_index=True)  # Soft delete for trash
    deleted_at = models.DateTimeField(null=True, blank=True)         # When deleted
    is_favorite = models.BooleanField(default=False, db_index=True)  # ⭐ Star/favorite
    
    class Meta:
        db_table = 'files'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['owner', 'is_deleted']),
            models.Index(fields=['owner', 'is_favorite']),  # ✨ For quick favorite queries
        ]

    def __str__(self):
        return f'{self.original_name} ({self.owner.email})'

    @property
    def file_size_display(self):
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f'{size:.1f} {unit}'
            size /= 1024
        return f'{size:.1f} TB'

    def delete_file(self):
        """Soft-delete the DB record and remove the physical file from storage."""
        if self.file and self.file.name:
            try:
                path = self.file.path
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    # ✨ NEW METHODS
    def restore_file(self):
        """Restore a deleted file from trash."""
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])

    def toggle_favorite(self):
        """Toggle favorite status."""
        self.is_favorite = not self.is_favorite
        self.save(update_fields=['is_favorite'])

    def permanently_delete(self):
        """Permanently delete file and remove from storage (for trash cleanup)."""
        if self.file and self.file.name:
            try:
                path = self.file.path
                if os.path.exists(path):
                    os.remove(path)
            except Exception:
                pass
        self.delete()  # Remove from database