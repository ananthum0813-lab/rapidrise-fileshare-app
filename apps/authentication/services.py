import secrets
import logging
from datetime import timedelta

from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from .models import User, PasswordResetToken

logger = logging.getLogger(__name__)


def get_tokens_for_user(user) -> dict:
    refresh = RefreshToken.for_user(user)
    return {'refresh': str(refresh), 'access': str(refresh.access_token)}


def send_password_reset_email(email: str) -> None:
    """
    Generate a password reset token and email it.
    Silently ignores unknown emails to prevent enumeration.
    """
    try:
        user = User.objects.get(email=email, is_active=True)
    except User.DoesNotExist:
        return

    # Invalidate any existing tokens
    PasswordResetToken.objects.filter(user=user, is_used=False).update(is_used=True)

    token = secrets.token_urlsafe(32)
    expires_at = timezone.now() + timedelta(hours=settings.PASSWORD_RESET_EXPIRY_HOURS)
    PasswordResetToken.objects.create(user=user, token=token, expires_at=expires_at)

    reset_link = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    try:
        html_message = render_to_string('emails/password_reset.html', {
            'user_name': user.first_name,
            'reset_link': reset_link,
            'expiry_hours': settings.PASSWORD_RESET_EXPIRY_HOURS,
        })
        send_mail(
            subject='Reset Your FileShare Password',
            message=f'Hi {user.first_name},\n\nReset your password: {reset_link}\n\nExpires in {settings.PASSWORD_RESET_EXPIRY_HOURS} hours.',
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f'Failed to send password reset email to {email}: {e}')


def send_share_email(recipient_email: str, sender_name: str, file_name: str,
                     share_url: str, message: str, expires_at) -> None:
    """Send file share notification email."""
    try:
        html_message = render_to_string('emails/file_share.html', {
            'sender_name': sender_name,
            'file_name': file_name,
            'share_url': share_url,
            'message': message,
            'expires_at': expires_at.strftime('%d %b %Y, %H:%M UTC'),
        })
        send_mail(
            subject=f'{sender_name} shared a file with you on FileShare',
            message=f'{sender_name} shared "{file_name}".\nDownload: {share_url}\nExpires: {expires_at}',
            html_message=html_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient_email],
            fail_silently=False,
        )
    except Exception as e:
        logger.error(f'Failed to send share email to {recipient_email}: {e}')