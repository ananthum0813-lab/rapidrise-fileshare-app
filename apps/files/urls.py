from django.urls import path
from . import views

urlpatterns = [
    path('', views.FileListView.as_view(), name='file-list'),
    path('upload/', views.FileUploadView.as_view(), name='file-upload'),
    path('storage/', views.StorageInfoView.as_view(), name='storage-info'),
    path('<uuid:pk>/', views.FileDetailView.as_view(), name='file-detail'),
    path('<uuid:pk>/download/', views.FileDownloadView.as_view(), name='file-download'),
]