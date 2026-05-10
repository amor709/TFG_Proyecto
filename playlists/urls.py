from django.urls import path
from . import views

app_name = 'playlists'

urlpatterns = [
    path('<int:pk>/', views.playlist_detail, name='detail'),
    path('create/', views.create_playlist, name='create'),
    path('<int:playlist_id>/add/<int:song_id>/', views.add_song_to_playlist, name='add_song'),
    path('<int:playlist_id>/remove/<int:song_id>/', views.remove_song_from_playlist, name='remove_song'),
    path('<int:pk>/save/', views.save_playlist, name='save'),
    path('<int:pk>/unsave/', views.unsave_playlist, name='unsave'),
    path('user-playlists/', views.user_playlists, name='user_playlists'),
]