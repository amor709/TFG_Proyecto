from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .models import Song, Album
import json


@csrf_exempt
@require_http_methods(["GET"])
def queue_html(request):
    """
    Genera el HTML de la cola de reproducción.
    Endpoint: /music/api/queue-html/?ids=1,2,3
    """
    ids_param = request.GET.get('ids', '')
    if not ids_param:
        return JsonResponse({'html': '<li class="queue-empty">La cola está vacía.</li>'})

    try:
        track_ids = [int(id_str.strip()) for id_str in ids_param.split(',') if id_str.strip()]
    except (ValueError, IndexError):
        return JsonResponse({'html': '<li class="queue-empty">La cola está vacía.</li>'})

    if not track_ids:
        return JsonResponse({'html': '<li class="queue-empty">La cola está vacía.</li>'})

    # Obtener las canciones en el orden especificado
    tracks = Song.objects.filter(id__in=track_ids).select_related('artist', 'artist__user', 'album')

    if not tracks:
        return JsonResponse({'html': '<li class="queue-empty">La cola está vacía.</li>'})

    # Crear un diccionario para mantener el orden
    track_dict = {track.id: track for track in tracks}

    # Construir HTML en el mismo orden que las IDs
    html_items = []
    for track_id in track_ids:
        if track_id in track_dict:
            track = track_dict[track_id]
            duration_display = track.duration_display if hasattr(track, 'duration_display') else '0:00'

            cover_url = track.album.cover.url if track.album and track.album.cover else '/static/img/album-placeholder.png'
            artist_name = track.artist.user.username if track.artist else 'Desconocido'

            collaborators_html = ''
            if hasattr(track, 'collaborators'):
                for collab in track.collaborators.all():
                    collaborators_html += f' & {collab.user.username}'

            html_item = f'''<li class="queue-item" data-track-id="{track.pk}" onclick="queueSystem.playQueueTrackAt({track_ids.index(track_id)}); return false;">
                <div class="queue-item__cover-wrap">
                    <img src="{cover_url}" alt="{track.title}" class="queue-item__cover" loading="lazy">
                    <div class="queue-item__play-overlay" aria-hidden="true">
                        <img src="/static/img/icon-play-sm.png" alt="" class="icon--xs">
                    </div>
                </div>
                <div class="queue-item__info">
                    <p class="queue-item__title">{track.title}</p>
                    <p class="queue-item__artist">{artist_name}{collaborators_html}</p>
                </div>
                <span class="queue-item__duration">{duration_display}</span>
            </li>'''
            html_items.append(html_item)

    html = ''.join(html_items) if html_items else '<li class="queue-empty">La cola está vacía.</li>'
    return JsonResponse({'html': html})


@csrf_exempt
@require_http_methods(["GET"])
def album_tracks(request, album_id, track_id):
    """
    Obtiene las canciones de un álbum a partir de una canción específica.
    Endpoint: /music/api/album-tracks/{album_id}/{track_id}/
    """
    try:
        album = Album.objects.get(id=album_id)
        tracks = album.songs.all().order_by('id').values_list('id', flat=True)

        if track_id not in tracks:
            return JsonResponse({'album_tracks': []})

        # Obtener el índice de la canción actual
        track_list = list(tracks)
        current_index = track_list.index(track_id)

        # Retornar las canciones después de la actual
        remaining_tracks = track_list[current_index + 1:]

        return JsonResponse({'album_tracks': remaining_tracks})
    except Album.DoesNotExist:
        return JsonResponse({'album_tracks': []})


@csrf_exempt
@require_http_methods(["GET"])
def suggested_tracks(request, track_id):
    """
    Obtiene canciones sugeridas basadas en los tags de una canción.
    Endpoint: /music/api/suggested-tracks/{track_id}/

    Estrategia de sugerencias:
    1. Primero: canciones con tags en común en "Mis Joyas" (liked_playlist)
    2. Si ninguna: canciones con tags en común en general
    3. Si ninguna: canciones aleatorias
    4. Si ninguna: devolver cualquier canción
    """
    try:
        from playlists.models import Playlist
        from django.db.models import Q
        
        track = Song.objects.get(id=track_id)
        track_tags = track.tags.all()
        suggested = []
        
        if track_tags.exists():
            # Obtener "Mis Joyas" del usuario actual si está autenticado
            if request.user.is_authenticated:
                liked_playlists = Playlist.objects.filter(
                    user=request.user,
                    is_liked_playlist=True
                )
                
                if liked_playlists.exists():
                    # Intento 1: Canciones de "Mis Joyas" con tags en común
                    suggested = list(
                        Song.objects.filter(
                            playlists__in=liked_playlists,
                            tags__in=track_tags
                        ).exclude(id=track.id).distinct().values_list('id', flat=True)[:10]
                    )
        
        # Intento 2: Si no hay en "Mis Joyas", canciones con tags en común en general
        if not suggested and track_tags.exists():
            suggested = list(Song.objects.filter(
                tags__in=track_tags
            ).exclude(id=track.id).distinct().values_list('id', flat=True)[:10])

        # Intento 3: Si no hay con tags, canciones aleatorias
        if not suggested:
            suggested = list(Song.objects.exclude(id=track.id).order_by('?').values_list('id', flat=True)[:10])

        # Intento 4: Si aún no hay, obtener CUALQUIER canción
        if not suggested:
            suggested = list(Song.objects.exclude(id=track.id).values_list('id', flat=True)[:10])

        return JsonResponse({'suggested_ids': suggested})
    except Song.DoesNotExist:
        # Si la canción no existe, devolver canciones aleatorias
        try:
            suggested = list(Song.objects.order_by('?').values_list('id', flat=True)[:10])
            return JsonResponse({'suggested_ids': suggested})
        except:
            return JsonResponse({'suggested_ids': []})






