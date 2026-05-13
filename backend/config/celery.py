"""
config/celery.py
─────────────────────────────────────────────────────────────────────────────
Celery application setup.

Add to config/__init__.py:
    from .celery import app as celery_app
    __all__ = ('celery_app',)

Add to settings.py:
    CELERY_BROKER_URL      = env('REDIS_URL', default='redis://localhost:6379/0')
    CELERY_RESULT_BACKEND  = env('REDIS_URL', default='redis://localhost:6379/0')
    CELERY_ACCEPT_CONTENT  = ['json']
    CELERY_TASK_SERIALIZER = 'json'
    CELERY_RESULT_SERIALIZER = 'json'
    CELERY_TIMEZONE        = 'UTC'

Run workers:
    celery -A config worker --loglevel=info
"""

import os
from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('filevault')

# Read config from Django settings — all keys prefixed with CELERY_
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from INSTALLED_APPS (looks for tasks.py in each app)
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Health-check task. Run: celery -A config call config.celery.debug_task"""
    print(f'Request: {self.request!r}')