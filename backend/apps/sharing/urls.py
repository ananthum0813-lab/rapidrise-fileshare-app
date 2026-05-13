"""
apps/sharing/urls.py
─────────────────────────────────────────────────────────────────────────────
All sharing routes — single-file shares, ZIP shares, file requests, inbox.
"""

from django.urls import path
from .views import (
    # Duplicate check
    CheckDuplicateView,

    # Single-file shares
    CreateShareView,
    SharedFileListView,
    RevokeShareView,
    ShareAnalyticsView,
    GlobalShareAnalyticsView,

    # Multi-file ZIP shares (NEW)
    CreateZipShareView,
    ZipShareListView,
    RevokeZipShareView,
    PublicZipShareInfoView,
    PublicZipShareDownloadView,

    # Public single-file share
    PublicShareInfoView,
    PublicShareDownloadView,

    # File requests (authenticated)
    FileRequestListView,
    FileRequestDetailView,

    # Public upload — per-recipient token
    PublicRecipientInfoView,
    PublicRecipientUploadView,

    # Legacy public upload — shared token
    PublicFileRequestInfoView,
    PublicFileRequestUploadView,

    # Submission inbox
    SubmissionInboxListView,
    ReviewSubmissionView,
    DeleteInfectedFileView,
)

urlpatterns = [
    # ── Duplicate detection ──────────────────────────────────────────────────
    path('check-duplicate/', CheckDuplicateView.as_view(), name='check-duplicate'),

    # ── Single-file shares ───────────────────────────────────────────────────
    path('',              SharedFileListView.as_view(),  name='share-list'),
    path('create/',       CreateShareView.as_view(),     name='share-create'),
    path('<uuid:pk>/revoke/',    RevokeShareView.as_view(),    name='share-revoke'),
    path('<uuid:pk>/analytics/', ShareAnalyticsView.as_view(), name='share-analytics'),
    path('analytics/',           GlobalShareAnalyticsView.as_view(), name='share-global-analytics'),

    # ── Multi-file ZIP shares (NEW) ──────────────────────────────────────────
    path('zip/',                          ZipShareListView.as_view(),        name='zip-share-list'),
    path('zip/create/',                   CreateZipShareView.as_view(),      name='zip-share-create'),
    path('zip/<uuid:pk>/revoke/',         RevokeZipShareView.as_view(),      name='zip-share-revoke'),
    path('public/zip/<uuid:token>/',          PublicZipShareInfoView.as_view(),     name='public-zip-info'),
    path('public/zip/<uuid:token>/download/', PublicZipShareDownloadView.as_view(), name='public-zip-download'),

    # ── Public single-file share ─────────────────────────────────────────────
    path('public/<uuid:token>/',          PublicShareInfoView.as_view(),     name='public-share-info'),
    path('public/<uuid:token>/download/', PublicShareDownloadView.as_view(), name='public-share-download'),

    # ── File requests (authenticated) ────────────────────────────────────────
    path('requests/',         FileRequestListView.as_view(),   name='request-list'),
    path('requests/<uuid:pk>/', FileRequestDetailView.as_view(), name='request-detail'),

    # ── Per-recipient upload (public) ────────────────────────────────────────
    path('requests/upload/<uuid:token>/',        PublicRecipientInfoView.as_view(),   name='recipient-info'),
    path('requests/upload/<uuid:token>/submit/', PublicRecipientUploadView.as_view(), name='recipient-upload'),

    # ── Legacy shared-token public upload ────────────────────────────────────
    path('requests/public/<uuid:token>/',        PublicFileRequestInfoView.as_view(),   name='public-request-info'),
    path('requests/public/<uuid:token>/upload/', PublicFileRequestUploadView.as_view(), name='public-request-upload'),

    # ── Submission Inbox ─────────────────────────────────────────────────────
    path('inbox/',                            SubmissionInboxListView.as_view(), name='inbox-list'),
    path('inbox/<uuid:pk>/review/',           ReviewSubmissionView.as_view(),    name='inbox-review'),
    path('inbox/<uuid:pk>/delete-file/',      DeleteInfectedFileView.as_view(),  name='inbox-delete-infected'),
]