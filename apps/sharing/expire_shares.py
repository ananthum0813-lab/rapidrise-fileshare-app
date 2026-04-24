"""
Management command to mark expired share links as expired.

Run manually:
    python manage.py expire_shares

Or via cron (every hour):
    0 * * * * /path/to/venv/bin/python /path/to/manage.py expire_shares
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.sharing.models import FileShare


class Command(BaseCommand):
    help = 'Mark all expired share links as expired.'

    def handle(self, *args, **options):
        updated = FileShare.objects.filter(
            status=FileShare.Status.ACTIVE,
            expires_at__lt=timezone.now(),
        ).update(status=FileShare.Status.EXPIRED)

        if updated:
            self.stdout.write(self.style.SUCCESS(f'Marked {updated} share(s) as expired.'))
        else:
            self.stdout.write('No expired shares found.')