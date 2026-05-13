"""
apps/sharing/services.py
─────────────────────────────────────────────────────────────────────────────
Business logic for:
  - FileShare creation (multi-recipient, each with unique token)
  - FileRequest creation (each recipient gets a UNIQUE upload URL)
  - SubmissionInbox creation
  - File request email sending
"""

import logging
from datetime import timedelta

from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils import timezone
from django.conf import settings

from apps.authentication.services import send_share_email
from .models import FileShare, ShareAnalyticsEvent, FileRequest, RequestRecipient, SubmissionInbox

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Share services (unchanged)
# ──────────────────────────────────────────────────────────────────────────────

def create_shares(user, file, recipient_emails: list, expiration_hours: int, message: str) -> list:
    """
    Create one FileShare record per recipient and dispatch notification emails.
    Each share gets its own unique token / URL.
    """
    expires_at = timezone.now() + timedelta(hours=expiration_hours)
    shares = []

    for email in recipient_emails:
        share = FileShare.objects.create(
            file=file,
            shared_by=user,
            recipient_email=email,
            expires_at=expires_at,
            message=message,
        )
        try:
            send_share_email(
                recipient_email=email,
                sender_name=getattr(user, 'full_name', None) or user.email,
                file_name=file.original_name,
                share_url=share.share_url,
                message=message,
                expires_at=expires_at,
            )
        except Exception:
            logger.exception('Failed to send share email to %s', email)
        shares.append(share)

    return shares


def get_valid_share(token: str) -> FileShare:
    """
    Fetch an active share by token.
    Raises ValueError with a user-friendly message if invalid / expired.
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


def record_analytics_event(share: FileShare, event_type: str, ip: str = None, user_agent: str = '') -> None:
    ShareAnalyticsEvent.objects.create(
        share=share,
        event_type=event_type,
        ip_address=ip,
        user_agent=(user_agent or '')[:512],
    )


# ──────────────────────────────────────────────────────────────────────────────
# File Request services
# ──────────────────────────────────────────────────────────────────────────────

def create_file_request(
    owner,
    title: str,
    description: str,
    recipient_emails: list,
    expiration_hours: int,
    max_files: int,
    required_files: list,
    allowed_extensions: list,
    # legacy single email kept for backward compat
    recipient_email: str = '',
) -> FileRequest:
    """
    Create a FileRequest and, for each recipient email, generate a
    UNIQUE RequestRecipient row with its own upload_token / upload_url.

    Each recipient receives a separate email with THEIR OWN upload link —
    never a shared/common URL.
    """
    expires_at = timezone.now() + timedelta(hours=expiration_hours) if expiration_hours else None

    req = FileRequest.objects.create(
        owner=owner,
        title=title,
        description=description,
        recipient_email=recipient_email or (recipient_emails[0] if recipient_emails else ''),
        expires_at=expires_at,
        max_files=max_files,
        required_files=required_files,
        allowed_extensions=allowed_extensions,
    )

    owner_name = getattr(owner, 'full_name', None) or owner.email

    # Create a unique RequestRecipient + send email for every recipient
    for email in recipient_emails:
        recipient = RequestRecipient.objects.create(
            file_request=req,
            email=email,
        )
        try:
            _send_request_email(
                recipient_email=email,
                owner_name=owner_name,
                title=title,
                description=description,
                upload_url=recipient.upload_url,   # ← UNIQUE per recipient
                expires_at=expires_at,
            )
        except Exception:
            logger.exception('Failed to send file-request email to %s', email)

    return req


def _send_request_email(recipient_email, owner_name, title, description, upload_url, expires_at):
    """
    Send a professional 'you have been asked to upload files' email.
    Falls back to plain-text if HTML template is unavailable.
    """
    expiry_str = expires_at.strftime('%d %b %Y, %H:%M UTC') if expires_at else 'No expiry'

    subject = f'📎 File Request: {title}'

    # Plain-text body (always sent)
    text_body = (
        f"Hi,\n\n"
        f"{owner_name} has requested files from you.\n\n"
        f"Request: {title}\n"
        f"{f'Details: {description}' if description else ''}\n\n"
        f"Click the link below to upload your files:\n"
        f"{upload_url}\n\n"
        f"This link expires: {expiry_str}\n\n"
        f"— FileVault\n\n"
        f"This is a unique link for {recipient_email}. Do not share it with others."
    )

    # Try HTML template; gracefully skip if not set up yet
    html_body = None
    try:
        html_body = render_to_string('emails/file_request.html', {
            'owner_name':    owner_name,
            'title':         title,
            'description':   description,
            'upload_url':    upload_url,
            'expiry_str':    expiry_str,
            'recipient_email': recipient_email,
        })
    except Exception:
        pass  # template not set up yet — plain text is fine

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_body,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient_email],
    )
    if html_body:
        msg.attach_alternative(html_body, 'text/html')

    msg.send(fail_silently=True)


def get_valid_recipient(token: str) -> RequestRecipient:
    """
    Validate a per-recipient upload token.
    Returns (RequestRecipient) or raises ValueError.
    """
    try:
        recipient = (
            RequestRecipient.objects
            .select_related('file_request', 'file_request__owner')
            .get(upload_token=token)
        )
    except RequestRecipient.DoesNotExist:
        raise ValueError('Invalid upload link.')

    req = recipient.file_request

    if req.status != FileRequest.Status.OPEN:
        raise ValueError('This file request is no longer accepting uploads.')

    if req.is_expired:
        req.close()
        raise ValueError('This upload link has expired.')

    return recipient


# ──────────────────────────────────────────────────────────────────────────────
# Submission Inbox services
# ──────────────────────────────────────────────────────────────────────────────

def create_submission(
    owner,
    source_type: str,
    original_filename: str,
    file_size: int,
    mime_type: str,
    submitter_email: str = '',
    submitter_name: str = '',
    submitter_ip: str = None,
    file_request: FileRequest = None,
    recipient: RequestRecipient = None,
    file=None,
) -> SubmissionInbox:
    return SubmissionInbox.objects.create(
        owner=owner,
        source_type=source_type,
        file_request=file_request,
        recipient=recipient,
        submitter_email=submitter_email,
        submitter_name=submitter_name,
        submitter_ip=submitter_ip,
        original_filename=original_filename,
        file_size=file_size,
        mime_type=mime_type,
        file=file,
    )