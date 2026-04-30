from django.urls import path
from . import views

app_name = 'music'

urlpatterns = [
    # Vista principal
    path('', views.song_list, name='song_list'),
    path('api/track/<int:track_id>/', views.get_track_data, name='get_track_data'),

    # Vistas de lanzamientos (Sencillos y Álbumes)
    path('create/single/', views.create_single, name='create_single'),
    path('create/album/phase-a/', views.album_phase_a, name='album_phase_a'),
    path('create/album/<int:album_id>/phase-b/', views.album_phase_b, name='album_phase_b'),
    path('album/<int:album_id>/publish/', views.publish_album, name='publish_album'),
]
