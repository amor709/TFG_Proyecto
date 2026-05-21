"""
API views para el sistema de "Mis joyas" (cancelar de favoritos)
"""
from django.http import JsonResponse
from django.db.models import Max
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from .models import Playlist, PlaylistSong
from music.models import Song


@login_required
@require_http_methods(["GET"])
def get_liked_playlist(request):
    """
    Obtener información de la playlist "Mis joyas" del usuario.
    """
    try:
        liked_playlist = Playlist.objects.get(user=request.user, is_liked_playlist=True)
        return JsonResponse({
            'success': True,
            'id': liked_playlist.pk,
            'name': liked_playlist.name,
            'description': liked_playlist.description,
        })
    except Playlist.DoesNotExist:
        return JsonResponse({
            'success': False,
            'message': 'Mis joyas no encontrado'
        }, status=404)


@login_required
@require_http_methods(["POST"])
def toggle_liked_song(request, song_id):
    """
    Añadir o quitar una canción de "Mis joyas".
    Si la canción está en "Mis joyas", la quita.
    Si no está, la añade.
    """
    try:
        song = Song.objects.get(pk=song_id)
    except Song.DoesNotExist:
        return JsonResponse({'success': False}, status=404)

    # Obtener la playlist "Mis joyas" del usuario
    try:
        liked_playlist = Playlist.objects.get(user=request.user, is_liked_playlist=True)
    except Playlist.DoesNotExist:
        # Si no existe, crearla (por si acaso)
        liked_playlist = Playlist.objects.create(
            user=request.user,
            name="Mis joyas",
            description="Tus canciones favoritas",
            is_public=False,
            is_liked_playlist=True
        )

    # Verificar si la canción ya está en "Mis joyas"
    is_already_liked = liked_playlist.songs.filter(pk=song_id).exists()

    if is_already_liked:
        # Quitar la canción
        PlaylistSong.objects.filter(playlist=liked_playlist, song=song).delete()
        # Reordenar las canciones restantes
        playlist_songs = liked_playlist.playlistsong_set.all().order_by('order')
        for i, ps in enumerate(playlist_songs, 1):
            ps.order = i
            ps.save()
        return JsonResponse({
            'success': True,
            'liked': False,
            'message': 'Canción removida de Mis joyas'
        })
    else:
        # Añadir la canción
        next_order = (liked_playlist.playlistsong_set.aggregate(Max('order'))['order__max'] or 0) + 1
        PlaylistSong.objects.create(
            playlist=liked_playlist,
            song=song,
            order=next_order
        )
        return JsonResponse({
            'success': True,
            'liked': True,
            'message': 'Canción añadida a Mis joyas'
        })


@login_required
@require_http_methods(["GET"])
def check_if_liked(request, song_id):
    """
    Verificar si una canción está en "Mis joyas".
    """
    try:
        song = Song.objects.get(pk=song_id)
    except Song.DoesNotExist:
        return JsonResponse({'success': False}, status=404)

    try:
        liked_playlist = Playlist.objects.get(user=request.user, is_liked_playlist=True)
        is_liked = liked_playlist.songs.filter(pk=song_id).exists()
    except Playlist.DoesNotExist:
        is_liked = False

    return JsonResponse({
        'success': True,
        'liked': is_liked
    })


@login_required
@require_http_methods(["POST"])
def set_liked_playlist_order(request, order_by):
    """
    Cambiar el ordenamiento de "Mis joyas".
    order_by puede ser 'added' (más reciente primero) o 'name' (alfabético)
    """
    if order_by not in ['added', 'name']:
        return JsonResponse({'success': False, 'message': 'Orden inválido'}, status=400)

    try:
        liked_playlist = Playlist.objects.get(user=request.user, is_liked_playlist=True)
        liked_playlist.order_by_field = order_by
        liked_playlist.save()
        return JsonResponse({
            'success': True,
            'message': f'Ordenamiento cambiado a {order_by}'
        })
    except Playlist.DoesNotExist:
        return JsonResponse({'success': False, 'message': 'Mis joyas no encontrado'}, status=404)


@login_required
@require_http_methods(["GET"])
def get_liked_songs(request):
    """
    Obtener todas las canciones de "Mis joyas" ordenadas según la preferencia.
    """
    try:
        liked_playlist = Playlist.objects.get(user=request.user, is_liked_playlist=True)
    except Playlist.DoesNotExist:
        return JsonResponse({'songs': []})

    # Obtener las canciones
    if liked_playlist.order_by_field == 'name':
        # Ordenar alfabéticamente
        songs = liked_playlist.songs.all().order_by('title')
    else:
        # Ordenar por fecha añadida (más reciente primero)
        songs = liked_playlist.songs.all().order_by('-playlistsong__id')

    songs_data = []
    for song in songs:
        songs_data.append({
            'id': song.pk,
            'title': song.title,
            'artist': song.artist.user.username,
            'duration': song.duration_display,
            'cover': song.cover.url if song.cover else None,
            'album': song.album.title if song.album else None,
        })

    return JsonResponse({
        'songs': songs_data,
        'order_by': liked_playlist.order_by_field,
        'total': len(songs_data)
    })


