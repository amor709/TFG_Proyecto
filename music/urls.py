from django.urls import path
from . import views

app_name = 'music'

urlpatterns = [
    path('', views.song_list, name='song_list'),
    path('song/<int:pk>/', views.song_detail, name='song_detail'),
    path('albums/', views.album_list, name='album_list'),
    path('albums/<int:pk>/', views.album_detail, name='album_detail'),
    path('genres/', views.genre_list, name='genre_list'),
    path('genres/<int:pk>/', views.genre_detail, name='genre_detail'),
]
