from django.shortcuts import render, get_object_or_404
from django.http import JsonResponse
from django.views.decorators.http import require_GET
from .models import Song, Album, Genre


@require_GET
def get_track_data(request, track_id):
    """ REOCRDATORIO DE FUNCION: eSTO datos de una canción en JSON para cargar sin recargar página. Asi creamos el efecto AJAX"""
    try:
        track = get_object_or_404(Song, pk=track_id)
        data = {
            'id': track.id,
            'title': track.title,
            'artist': track.artist.user.username,
            'cover': track.cover.url if track.cover else '/static/img/logo.png',
            'audio_url': track.audio_file.url if track.audio_file else '',
            'related_artist': {
                'id': track.artist.id,
                'name': track.artist.user.username,
                'photo': track.artist.photo.url
            }
        }
        return JsonResponse(data)
    except Song.DoesNotExist:
        return JsonResponse({'error': 'Canción no encontrada'}, status=404)


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
