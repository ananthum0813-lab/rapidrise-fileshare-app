import logging
from datetime import timedelta

from django.utils import timezone

from apps.authentication.services import send_share_email
from .models import FileShare

logger = logging.getLogger(__name__)


def create_share(user, file, recipient_email: str, expiration_hours: int, message: str) -> FileShare:
    """Create a FileShare record and send the share email."""
    expires_at = timezone.now() + timedelta(hours=expiration_hours)

    share = FileShare.objects.create(
        file=file,
        shared_by=user,
        recipient_email=recipient_email,
        expires_at=expires_at,
        message=message,
    )

    send_share_email(
        recipient_email=recipient_email,
        sender_name=user.full_name or user.email,
        file_name=file.original_name,
        share_url=share.share_url,
        message=message,
        expires_at=expires_at,
    )

    return share


def get_valid_share(token: str) -> FileShare:
    """
    Fetch a share by token and validate it.
    Raises ValueError with a user-friendly message if invalid or expired.
    """
    try:
        share = FileShare.objects.select_related('file', 'shared_by').get(
            share_token=token,
            status=FileShare.Status.ACTIVE,
        )
    except FileShare.DoesNotExist:
        raise ValueError('Share link not found or has been revoked.')

    if share.is_expired:
        share.status = FileShare.Status.EXPIRED
        share.save(update_fields=['status'])
        raise ValueError('This share link has expired.')

    return share