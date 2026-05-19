"""
API endpoints para sincronizar estado de reproducción entre dispositivos/pestañas
"""

from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.contrib.auth.decorators import login_required
from django.utils import timezone
import json
import logging

from accounts.models import PlaybackSession, ArtistProfile, ListeningHistory
from music.models import Song
from accounts.stats_utils import record_play

logger = logging.getLogger(__name__)


@login_required
@require_http_methods(["POST"])
def save_playback_state(request):
    try:
        data = json.loads(request.body)
        session_id = data.get('session_id')

        if not session_id:
            return JsonResponse({
                'error': 'session_id requerido'
            }, status=400)

        # Obtener o crear sesión de reproducción
        session, created = PlaybackSession.objects.get_or_create(
            user=request.user,
            session_id=session_id,
            defaults={
                'track_id': data.get('track_id'),
                'track_title': data.get('track_title', ''),
                'track_artist': data.get('track_artist', ''),
                'cover_url': data.get('cover_url', ''),
                'current_time': data.get('current_time', 0),
                'is_playing': data.get('is_playing', False),
                'device_info': data.get('device_info', ''),
                'user_agent': request.META.get('HTTP_USER_AGENT', '')
            }
        )

        # Actualizar estado
        if not created:
            session.track_id = data.get('track_id', session.track_id)
            session.track_title = data.get('track_title', session.track_title)
            session.track_artist = data.get('track_artist', session.track_artist)
            session.cover_url = data.get('cover_url', session.cover_url)
            session.current_time = data.get('current_time', session.current_time)
            session.is_playing = data.get('is_playing', session.is_playing)
            session.device_info = data.get('device_info', session.device_info)
            session.user_agent = request.META.get('HTTP_USER_AGENT', '')
            session.last_activity = timezone.now()
            session.save()

        logger.info(f'Estado de reproducción guardado para {request.user.username}: {session_id}')

        return JsonResponse({
            'status': 'success',
            'session_id': session.session_id,
            'is_active': session.is_active
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'error': 'JSON inválido'
        }, status=400)
    except Exception as e:
        logger.error(f'Error al guardar estado de reproducción: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def get_playback_state(request):
    """
    Obtener estado de reproducción del usuario
    GET /api/playback/state/
    """
    try:
        session = PlaybackSession.objects.filter(user=request.user).first()

        if not session:
            return JsonResponse({
                'session': None
            })

        return JsonResponse({
            'session': {
                'session_id': session.session_id,
                'track_id': session.track_id,
                'track_title': session.track_title,
                'track_artist': session.track_artist,
                'cover_url': session.cover_url,
                'current_time': session.current_time,
                'is_playing': session.is_playing,
                'is_active': session.is_active,
                'last_activity': session.last_activity.isoformat()
            }
        })

    except Exception as e:
        logger.error(f'Error al obtener estado de reproducción: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["POST"])
def check_concurrent_session(request):
    """
    Verificar si hay sesiones concurrentes activas
    POST /api/playback/check-concurrent/
    """
    try:
        data = json.loads(request.body)
        session_id = data.get('session_id')

        # Obtener todas las sesiones activas para el usuario
        active_sessions = PlaybackSession.objects.filter(
            user=request.user,
            is_playing=True
        )

        # Filtrar las que están realmente activas
        active_sessions = [s for s in active_sessions if s.is_active]

        # Buscar si hay otra sesión diferente reproduciéndose
        other_sessions = [
            s for s in active_sessions
            if s.session_id != session_id
        ]

        if other_sessions:
            # Hay reproducción concurrente
            logger.warning(
                f'Reproducción concurrente detectada para {request.user.username}: '
                f'{session_id} y {other_sessions[0].session_id}'
            )
            return JsonResponse({
                'has_concurrent': True,
                'other_session': {
                    'session_id': other_sessions[0].session_id,
                    'track_title': other_sessions[0].track_title,
                    'device_info': other_sessions[0].device_info
                }
            })
        else:
            return JsonResponse({
                'has_concurrent': False,
                'other_session': None
            })

    except json.JSONDecodeError:
        return JsonResponse({
            'error': 'JSON inválido'
        }, status=400)
    except Exception as e:
        logger.error(f'Error al verificar sesiones concurrentes: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["POST"])
def stop_playback_session(request):
    """
    Detener sesión de reproducción
    POST /api/playback/stop/
    """
    try:
        data = json.loads(request.body)
        session_id = data.get('session_id')

        session = PlaybackSession.objects.filter(
            user=request.user,
            session_id=session_id
        ).first()

        if session:
            session.is_playing = False
            session.save()
            logger.info(f'Sesión de reproducción detenida para {request.user.username}: {session_id}')

        return JsonResponse({
            'status': 'success'
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'error': 'JSON inválido'
        }, status=400)
    except Exception as e:
        logger.error(f'Error al detener sesión de reproducción: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def get_player_info(request):
    """
    Obtener información completa del reproductor para actualizar los paneles laterales
    GET /accounts/api/player-info/
    """
    try:
        # Obtener sesión activa más reciente
        session = PlaybackSession.objects.filter(
            user=request.user
        ).order_by('-last_activity').first()

        session_data = None
        current_track_data = None
        related_artist_data = None

        if session:
            session_data = {
                'session_id': session.session_id,
                'track_id': session.track_id,
                'track_title': session.track_title,
                'track_artist': session.track_artist,
                'cover_url': session.cover_url,
                'current_time': session.current_time,
                'is_playing': session.is_playing,
                'is_active': session.is_active,
                'last_activity': session.last_activity.isoformat()
            }

            # Obtener datos completos de la canción
            if session.track_id:
                try:
                    track = Song.objects.get(pk=session.track_id)
                    current_track_data = {
                        'id': track.id,
                        'title': track.title,
                        'artist': track.artist.user.username,
                        'artist_id': track.artist.id,
                        'cover': track.cover.url if track.cover else '/static/img/logo.png',
                        'audio_url': track.audio_file.url if track.audio_file else '',
                    }

                    # Obtener artista relacionado
                    related_artists = ArtistProfile.objects.exclude(
                        pk=track.artist.pk
                    )
                    if related_artists.exists():
                        related = related_artists.order_by('?').first()
                        related_artist_data = {
                            'id': related.id,
                            'name': related.user.username,
                            'photo': related.photo.url if related.photo else '/static/img/userdefault.png',
                        }
                except Song.DoesNotExist:
                    logger.warning(f'Track {session.track_id} no encontrada para usuario {request.user.username}')

        return JsonResponse({
            'status': 'success',
            'session': session_data,
            'current_track': current_track_data,
            'related_artist': related_artist_data
        })

    except Exception as e:
        logger.error(f'Error al obtener información del reproductor: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def get_playlist(request):
    """
    Obtener la lista de canciones consistente para el reproductor
    GET /accounts/api/playlist/
    """
    try:
        songs_list = []

        # Para usuarios autenticados, mostrar sus canciones recientes
        if request.user.is_authenticated:
            recent_history = ListeningHistory.objects.filter(
                user=request.user
            ).select_related('song').order_by('-played_at')[:20]

            if recent_history:
                songs = [history.song for history in recent_history]
            else:
                # Si no hay historial, mostrar canciones populares
                songs = Song.objects.all().order_by('-plays')[:20]
        else:
            # Para usuarios no autenticados, mostrar canciones populares
            songs = Song.objects.all().order_by('-plays')[:20]

        for song in songs:
            songs_list.append({
                'id': song.id,
                'title': song.title,
                'artist': song.artist.user.username,
                'cover': song.cover.url if song.cover else '/static/img/logo.png',
                'audio_url': song.audio_file.url if song.audio_file else '',
            })

        return JsonResponse({
            'status': 'success',
            'songs': songs_list
        })

    except Exception as e:
        logger.error(f'Error al obtener playlist: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["POST"])
def add_to_listening_history(request):
    """
    Agregar una canción al historial de escucha del usuario
    POST /accounts/api/add-to-history/
    """
    try:
        data = json.loads(request.body)
        song_id = data.get('song_id')

        if not song_id:
            return JsonResponse({
                'error': 'song_id requerido'
            }, status=400)

        # Verificar que la canción existe
        try:
            song = Song.objects.get(pk=song_id)
        except Song.DoesNotExist:
            return JsonResponse({}, status=404)

        # Crear entrada en el historial
        history_entry, created = ListeningHistory.objects.get_or_create(
            user=request.user,
            song=song,
            defaults={'played_at': timezone.now()}
        )

        # Si ya existía, actualizar el timestamp
        if not created:
            history_entry.played_at = timezone.now()
            history_entry.save()

        # Registrar la reproducción en las estadísticas
        record_play(request.user, song)

        # Mantener solo las últimas 100 entradas por usuario
        ListeningHistory.objects.filter(user=request.user).order_by('-played_at')[100:].delete()

        logger.info(f'Canción agregada al historial: {request.user.username} - {song.title}')

        return JsonResponse({
            'status': 'success',
            'created': created
        })

    except json.JSONDecodeError:
        return JsonResponse({
            'error': 'JSON inválido'
        }, status=400)
    except Exception as e:
        logger.error(f'Error al agregar canción al historial: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["POST"])
def toggle_follow_artist(request, artist_id):
    """
    Alternar seguimiento de un artista (seguir/dejar de seguir)
    POST /accounts/api/follow-artist/{artist_id}/
    """
    try:
        listener_profile = request.user.listener_profile

        try:
            artist = ArtistProfile.objects.get(pk=artist_id)
        except ArtistProfile.DoesNotExist:
            return JsonResponse({
                'error': 'Artista no encontrado'
            }, status=404)

        is_following = listener_profile.following.filter(pk=artist_id).exists()

        if is_following:
            listener_profile.following.remove(artist)
            status = 'unfollowed'
        else:
            listener_profile.following.add(artist)
            status = 'followed'

        logger.info(f'{request.user.username} {status} {artist.user.username}')

        return JsonResponse({
            'status': 'success',
            'action': status,
            'is_following': not is_following
        })

    except Exception as e:
        logger.error(f'Error al alternar seguimiento: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def check_following_artist(request, artist_id):
    """
    Verificar si el usuario sigue a un artista
    GET /accounts/api/check-following/{artist_id}/
    """
    try:
        listener_profile = request.user.listener_profile
        is_following = listener_profile.following.filter(pk=artist_id).exists()

        return JsonResponse({
            'is_following': is_following
        })

    except Exception as e:
        logger.error(f'Error al verificar seguimiento: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)


@login_required
@require_http_methods(["GET"])
def get_following_artists(request, limit=5):
    """
    Obtener artistas que sigue el usuario
    GET /accounts/api/following-artists/?limit=5
    """
    try:
        listener_profile = request.user.listener_profile
        limit_param = request.GET.get('limit', limit)
        
        try:
            limit_param = int(limit_param)
        except (ValueError, TypeError):
            limit_param = limit
        
        following = listener_profile.following.all()[:limit_param]
        
        artists = []
        for artist in following:
            artists.append({
                'id': artist.id,
                'name': artist.user.username,
                'photo': artist.photo.url if artist.photo else '/static/img/userdefault.png',
                'bio': artist.bio[:100] if artist.bio else '',
                'followers_count': artist.followers_count
            })
        
        return JsonResponse({
            'status': 'success',
            'artists': artists,
            'total_count': listener_profile.following.count()
        })
    
    except Exception as e:
        logger.error(f'Error al obtener artistas seguidos: {str(e)}')
        return JsonResponse({
            'error': str(e)
        }, status=500)
