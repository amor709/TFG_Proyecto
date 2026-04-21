from django.shortcuts import render, get_object_or_404
from .models import Song, Album, Genre


def song_list(request):
    songs = Song.objects.all().order_by('-release_date')
    return render(request, 'music/song_list.html', {'songs': songs})


def song_detail(request, pk):
    song = get_object_or_404(Song, pk=pk)
    return render(request, 'music/song_detail.html', {'song': song})


def album_list(request):
    albums = Album.objects.all().order_by('-release_date')
    return render(request, 'music/album_list.html', {'albums': albums})


def album_detail(request, pk):
    album = get_object_or_404(Album, pk=pk)
    songs = album.songs.all()
    return render(request, 'music/album_detail.html', {'album': album, 'songs': songs})


def genre_list(request):
    genres = Genre.objects.all()
    return render(request, 'music/genre_list.html', {'genres': genres})


def genre_detail(request, pk):
    genre = get_object_or_404(Genre, pk=pk)
    songs = Song.objects.filter(genre=genre)
    return render(request, 'music/genre_detail.html', {'genre': genre, 'songs': songs})
