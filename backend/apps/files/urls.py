from django.urls import path
from . import views

urlpatterns = [
    # ── Core file management ──────────────────────────────────────────────────
    path('',                              views.FileListView.as_view(),         name='file-list'),
    path('upload/',                       views.FileUploadView.as_view(),       name='file-upload'),
    path('storage/',                      views.StorageInfoView.as_view(),      name='storage-info'),

    # ── Duplicate detection  (called by frontend BEFORE upload) ───────────────
    path('check-duplicate/',              views.CheckDuplicateView.as_view(),   name='check-duplicate'),

    # ── File detail / download / rename ──────────────────────────────────────
    path('<uuid:pk>/',                    views.FileDetailView.as_view(),       name='file-detail'),
    path('<uuid:pk>/download/',           views.FileDownloadView.as_view(),     name='file-download'),
    path('<uuid:pk>/rename/',             views.FileRenameView.as_view(),       name='file-rename'),

    # ── Favourites ────────────────────────────────────────────────────────────
    path('<uuid:pk>/favorite/',           views.ToggleFavoriteView.as_view(),   name='toggle-favorite'),
    path('favorites/',                    views.FavoritesListView.as_view(),    name='favorites-list'),

    # ── Trash ─────────────────────────────────────────────────────────────────
    path('trash/',                        views.TrashListView.as_view(),        name='trash-list'),
    path('trash/empty/',                  views.EmptyTrashView.as_view(),       name='empty-trash'),
    path('<uuid:pk>/restore/',            views.RestoreFileView.as_view(),      name='restore-file'),
    path('<uuid:pk>/delete-permanently/', views.PermanentlyDeleteView.as_view(), name='delete-permanently'),

    # ── Batch operations ──────────────────────────────────────────────────────
    path('batch-delete/',                 views.BatchDeleteView.as_view(),      name='batch-delete'),
    path('batch-restore/',                views.BatchRestoreView.as_view(),     name='batch-restore'),
]