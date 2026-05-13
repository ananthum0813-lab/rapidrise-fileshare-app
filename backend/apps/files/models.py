"""
apps/files/models.py
─────────────────────────────────────────────────────────────────────────────
FIX: Added method aliases delete_file(), restore_file(), permanently_delete()
     so views.py doesn't crash with AttributeError.
     The canonical implementations remain soft_delete() / restore() / hard_delete().
"""

import uuid
import os
from django.db import models
from django.conf import settings
from django.utils import timezone


def user_upload_path(instance, filename):
    """Store files under media/uploads/<user_id>/<filename>."""
    return f'uploads/{instance.owner_id}/{filename}'


class File(models.Model):

    class ScanStatus(models.TextChoices):
        PENDING     = 'pending',     'Pending'
        SCANNING    = 'scanning',    'Scanning'
        SAFE        = 'safe',        'Safe'
        INFECTED    = 'infected',    'Infected'
        SCAN_FAILED = 'scan_failed', 'Scan Failed'

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner         = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='files',
    )
    original_name = models.CharField(max_length=255)
    file          = models.FileField(upload_to=user_upload_path)
    file_size     = models.BigIntegerField(default=0)
    mime_type     = models.CharField(max_length=100, blank=True)
    sha256        = models.CharField(max_length=64, blank=True, db_index=True)

    scan_status = models.CharField(
        max_length=20,
        choices=ScanStatus.choices,
        default=ScanStatus.PENDING,
        db_index=True,
    )
    scan_result = models.CharField(max_length=1000, blank=True)
    scanned_at  = models.DateTimeField(null=True, blank=True)

    is_favorite = models.BooleanField(default=False)
    is_deleted  = models.BooleanField(default=False, db_index=True)
    deleted_at  = models.DateTimeField(null=True, blank=True)

    uploaded_at = models.DateTimeField(default=timezone.now, db_index=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'files'
        ordering = ['-uploaded_at']
        indexes  = [
            models.Index(fields=['owner', 'is_deleted']),
            models.Index(fields=['owner', 'is_favorite']),
            models.Index(fields=['sha256']),
            models.Index(fields=['scan_status']),
        ]

    def __str__(self):
        return f'{self.original_name} ({self.owner.email})'

    # ── Computed ──────────────────────────────────────────────────────────────

    @property
    def file_size_display(self):
        size = self.file_size
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size < 1024:
                return f'{size:.1f} {unit}'
            size /= 1024
        return f'{size:.1f} TB'

    @property
    def is_safe(self):
        return self.scan_status == self.ScanStatus.SAFE

    @property
    def is_infected(self):
        return self.scan_status == self.ScanStatus.INFECTED

    @property
    def scan_status_display(self):
        return self.get_scan_status_display()

    # ── Toggle favourite ──────────────────────────────────────────────────────

    def toggle_favorite(self):
        self.is_favorite = not self.is_favorite
        self.save(update_fields=['is_favorite'])

    # ── Soft delete ───────────────────────────────────────────────────────────

    def soft_delete(self):
        self.is_deleted = True
        self.deleted_at = timezone.now()
        self.save(update_fields=['is_deleted', 'deleted_at'])

    # Alias used by views.py → FileDetailView.delete()
    def delete_file(self):
        self.soft_delete()

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.save(update_fields=['is_deleted', 'deleted_at'])

    # Alias used by views.py → RestoreFileView.post()
    def restore_file(self):
        self.restore()

    def hard_delete(self):
        """Remove the physical file then delete the DB record."""
        try:
            if self.file and self.file.name:
                path = self.file.path
                if os.path.exists(path):
                    os.remove(path)
        except Exception:
            pass
        self.delete()

    # Alias used by views.py → PermanentlyDeleteView / EmptyTrashView
    def permanently_delete(self):
        self.hard_delete()