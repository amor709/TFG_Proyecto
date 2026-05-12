from django.urls import path
from . import views
from . import api_views

app_name = 'playlists'

urlpatterns = [
    path('<int:pk>/', views.playlist_detail, name='detail'),
    path('create/', views.create_playlist, name='create'),
    path('<int:playlist_id>/add/<int:song_id>/', views.add_song_to_playlist, name='add_song'),
    path('<int:playlist_id>/remove/<int:song_id>/', views.remove_song_from_playlist, name='remove_song'),
    path('<int:pk>/save/', views.save_playlist, name='save'),
    path('<int:pk>/unsave/', views.unsave_playlist, name='unsave'),
    path('user-playlists/', views.user_playlists, name='user_playlists'),
    # API endpoints para Mis joyas
    path('api/liked/info/', api_views.get_liked_playlist, name='get_liked_playlist'),
    path('api/liked/<int:song_id>/toggle/', api_views.toggle_liked_song, name='toggle_liked'),
    path('api/liked/<int:song_id>/check/', api_views.check_if_liked, name='check_liked'),
    path('api/liked/songs/', api_views.get_liked_songs, name='get_liked_songs'),
    path('api/liked/order/<str:order_by>/', api_views.set_liked_playlist_order, name='set_order'),
]