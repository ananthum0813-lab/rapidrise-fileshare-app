from django.urls import path
from . import views

urlpatterns = [
  
    
    # File management endpoints
    path('', views.FileListView.as_view(), name='file-list'),
    path('upload/', views.FileUploadView.as_view(), name='file-upload'),
    path('storage/', views.StorageInfoView.as_view(), name='storage-info'),
    path('<uuid:pk>/', views.FileDetailView.as_view(), name='file-detail'),
    path('<uuid:pk>/download/', views.FileDownloadView.as_view(), name='file-download'),
    path('<uuid:pk>/rename/', views.FileRenameView.as_view(), name='file-rename'),
    
   
    # Favorites/Starring endpoints 
    path('<uuid:pk>/favorite/', views.ToggleFavoriteView.as_view(), name='toggle-favorite'),
    path('favorites/', views.FavoritesListView.as_view(), name='favorites-list'),
    
    # Trash/Recycle bin endpoints 
    path('trash/', views.TrashListView.as_view(), name='trash-list'),
    path('<uuid:pk>/restore/', views.RestoreFileView.as_view(), name='restore-file'),
    path('trash/empty/', views.EmptyTrashView.as_view(), name='empty-trash'),
    path('<uuid:pk>/delete-permanently/', views.PermanentlyDeleteView.as_view(), name='delete-permanently'),
    
    # Batch operations (multiple files)
    path('batch-delete/', views.BatchDeleteView.as_view(), name='batch-delete'),
    path('batch-restore/', views.BatchRestoreView.as_view(), name='batch-restore'),
]