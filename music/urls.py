from django.urls import path
from . import views

app_name = 'music'

urlpatterns = [
    # Vista principal
    path('', views.song_list, name='song_list'),
    path('api/track/<int:track_id>/', views.get_track_data, name='get_track_data'),

    # Vista de artista
    path('artist/', views.artist_detail, name='artist_detail'),
    path('artist/<int:artist_id>/', views.artist_detail, name='artist_detail_public'),

    # Vista de álbum
    path('album/<int:album_id>/', views.album_detail, name='album_detail'),

    # Vistas de lanzamientos (Sencillos y Álbumes)
    path('create/single/', views.create_single, name='create_single'),
    path('create/album/phase-a/', views.album_phase_a, name='album_phase_a'),
    path('create/album/<int:album_id>/phase-b/', views.album_phase_b, name='album_phase_b'),
    path('album/<int:album_id>/publish/', views.publish_album, name='publish_album'),
    path('song/<int:song_id>/delete/', views.delete_song, name='delete_song'),
]
