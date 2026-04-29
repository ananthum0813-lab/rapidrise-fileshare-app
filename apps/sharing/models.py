import uuid
from django.db import models
from django.conf import settings
from django.utils import timezone


class FileShare(models.Model):
    """Model for sharing files with recipients via email."""
    
    class Status(models.TextChoices):
        ACTIVE = 'active', 'Active'
        EXPIRED = 'expired', 'Expired'
        REVOKED = 'revoked', 'Revoked'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    file = models.ForeignKey(
        'files.File',
        on_delete=models.CASCADE,
        related_name='shares',
    )
    shared_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='shared_files',
    )
    recipient_email = models.EmailField()
    share_token = models.UUIDField(
        unique=True,
        default=uuid.uuid4,
        editable=False,
        db_index=True,
    )
    message = models.TextField(blank=True, max_length=1000)
    expires_at = models.DateTimeField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        db_index=True,
    )
    shared_at = models.DateTimeField(default=timezone.now)
    accessed_at = models.DateTimeField(null=True, blank=True)
    download_count = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'file_shares'
        ordering = ['-shared_at']
        indexes = [
            models.Index(fields=['shared_by', 'status']),
        ]

    def __str__(self):
        return f'{self.file.original_name} → {self.recipient_email}'

    @property
    def is_expired(self):
        """Check if share link has expired."""
        return timezone.now() > self.expires_at

    @property
    def is_active(self):
        """Check if share is currently active and not expired."""
        return self.status == self.Status.ACTIVE and not self.is_expired

    @property
    def has_been_accessed(self):
        """Check if share has been accessed."""
        return self.accessed_at is not None

    @property
    def share_url(self):
        """Generate public share URL."""
        return f'{settings.FRONTEND_URL}/shared/{self.share_token}'

    def mark_accessed(self):
        """Record first access time and increment download counter."""
        if not self.accessed_at:
            self.accessed_at = timezone.now()
        self.download_count += 1
        self.save(update_fields=['accessed_at', 'download_count'])

    def revoke(self):
        """Revoke this share link."""
        self.status = self.Status.REVOKED
        self.save(update_fields=['status'])