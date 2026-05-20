"""
apps/files/urls.py

All file and folder URL patterns.
The critical addition is the set-expiry route — without it every call from
SetExpiryModal returns 404 / "Failed to update expiry."
"""

from django.urls import path
from .views import (
    # ── File views ────────────────────────────────────────────────────────────
    CheckDuplicateView,
    FileUploadView,
    FileListView,
    FileDetailView,
    FileDownloadView,
    FileRenameView,
    StorageInfoView,
    SetExpiryView,          # FIX: was never registered

    # ── Favourite / Trash / Batch ─────────────────────────────────────────────
    ToggleFavoriteView,
    FavoritesListView,
    TrashListView,
    RestoreFileView,
    EmptyTrashView,
    PermanentlyDeleteView,
    BatchDeleteView,
    BatchRestoreView,

    # ── Folder views ──────────────────────────────────────────────────────────
    FolderListCreateView,
    FolderDetailView,
    FolderAddFilesView,
    FolderRemoveFilesView,
    FolderShareView,
)

urlpatterns = [
    # ── Utility (no pk) ───────────────────────────────────────────────────────
    path('storage/',            StorageInfoView.as_view(),    name='file-storage'),
    path('upload/',             FileUploadView.as_view(),     name='file-upload'),
    path('check-duplicate/',    CheckDuplicateView.as_view(), name='file-check-duplicate'),
    path('favorites/',          FavoritesListView.as_view(),  name='file-favorites'),
    path('trash/',              TrashListView.as_view(),      name='file-trash'),
    path('trash/empty/',        EmptyTrashView.as_view(),     name='file-trash-empty'),
    path('batch-delete/',       BatchDeleteView.as_view(),    name='file-batch-delete'),
    path('batch-restore/',      BatchRestoreView.as_view(),   name='file-batch-restore'),
    path('',                    FileListView.as_view(),       name='file-list'),

    # ── Per-file actions (require pk) ─────────────────────────────────────────
    path('<uuid:pk>/',                  FileDetailView.as_view(),       name='file-detail'),
    path('<uuid:pk>/download/',         FileDownloadView.as_view(),     name='file-download'),
    path('<uuid:pk>/rename/',           FileRenameView.as_view(),       name='file-rename'),
    path('<uuid:pk>/favorite/',         ToggleFavoriteView.as_view(),   name='file-favorite'),
    path('<uuid:pk>/restore/',          RestoreFileView.as_view(),      name='file-restore'),
    path('<uuid:pk>/delete-permanently/', PermanentlyDeleteView.as_view(), name='file-delete-permanently'),
    # FIX: this route was completely absent — SetExpiryModal POSTs here
    path('<uuid:pk>/set-expiry/',       SetExpiryView.as_view(),        name='file-set-expiry'),

    # ── Folder routes ─────────────────────────────────────────────────────────
    path('folders/',                        FolderListCreateView.as_view(),  name='folder-list'),
    path('folders/<uuid:pk>/',              FolderDetailView.as_view(),      name='folder-detail'),
    path('folders/<uuid:pk>/add-files/',    FolderAddFilesView.as_view(),    name='folder-add-files'),
    path('folders/<uuid:pk>/remove-files/', FolderRemoveFilesView.as_view(), name='folder-remove-files'),
    path('folders/<uuid:pk>/share/',        FolderShareView.as_view(),       name='folder-share'),
]