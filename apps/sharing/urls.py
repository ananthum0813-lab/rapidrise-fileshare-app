from django.urls import path
from . import views

urlpatterns = [
    # Authenticated
    path('', views.SharedFileListView.as_view(), name='share-list'),
    path('create/', views.CreateShareView.as_view(), name='share-create'),
    path('<uuid:pk>/revoke/', views.RevokeShareView.as_view(), name='share-revoke'),

    # Public (no auth)
    path('public/<uuid:token>/', views.PublicShareInfoView.as_view(), name='public-share-info'),
    path('public/<uuid:token>/download/', views.PublicShareDownloadView.as_view(), name='public-share-download'),
]