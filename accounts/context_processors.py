from music.models import Song
from accounts.models import ArtistProfile, ListeningHistory, PlaybackSession
from playlists.models import Playlist
import logging

logger = logging.getLogger(__name__)


def player_context(request):
    """
    Context processor que proporciona variables necesarias para el reproductor
    en todas las páginas de la aplicación
    """
    context = {}

    # Lista de canciones disponibles (para la playlist del sidebar)
    # Mostrar siempre las canciones más populares o del historial del usuario
    if request.user.is_authenticated:
        # Obtener las últimas 20 canciones escuchadas por el usuario
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

    context['songs'] = songs

    # Obtener la sesión activa más reciente
    active_session = None
    if request.user.is_authenticated:
        recent_session = PlaybackSession.objects.filter(
            user=request.user
        ).order_by('-last_activity').first()

        if recent_session:  # Corregido: eliminar verificación de is_active
            active_session = recent_session

    # Canción actual - SIEMPRE priorizar la sesión activa
    current_track = None
    if active_session and active_session.track_id:
        try:
            current_track = Song.objects.get(pk=active_session.track_id)
            context['current_track'] = current_track
        except Song.DoesNotExist:
            logger.warning(f'Track {active_session.track_id} no encontrada en sesión {active_session.session_id}')
            current_track = None

    # Si no hay sesión activa, usar historial (fallback)
    if not current_track and request.user.is_authenticated:
        last_played = ListeningHistory.objects.filter(
            user=request.user
        ).select_related('song').first()
        if last_played:
            context['current_track'] = last_played.song
            current_track = last_played.song

    # Si aún no hay canción, usar la primera disponible
    if not current_track:
        first_song = Song.objects.first()
        if first_song:
            context['current_track'] = first_song
            current_track = first_song

    # Artista relacionado - usar solo si hay una canción actual
    if current_track:
        related_artists = ArtistProfile.objects.exclude(
            pk=current_track.artist.pk
        )
        if related_artists.exists():
            context['related_artist'] = related_artists.order_by('?').first()
        else:
            context['related_artist'] = None
    else:
        context['related_artist'] = ArtistProfile.objects.order_by('?').first()

    # Items de biblioteca del usuario (para el sidebar)
    if request.user.is_authenticated:
        # Combinar playlists del usuario con álbumes/artistas seguidos
        user_playlists = Playlist.objects.filter(user=request.user)[:10]
        library_items = []

        # Agregar playlists
        for playlist in user_playlists:
            library_items.append({
                'id': playlist.id,
                'title': playlist.name,
                'type': 'playlist',
                'cover_image': playlist.cover if hasattr(playlist, 'cover') and playlist.cover else None,
                'artist': None,
                'is_active': False
            })

        # Agregar artistas seguidos (si el usuario tiene perfil de oyente)
        if hasattr(request.user, 'listener_profile'):
            followed_artists = request.user.listener_profile.following.all()[:5]
            for artist in followed_artists:
                library_items.append({
                    'id': artist.id,
                    'title': artist.name,
                    'type': 'artist',
                    'cover_image': artist.photo,
                    'artist': artist,
                    'is_active': False
                })

        context['library_items'] = library_items
    else:
        context['library_items'] = []

    return context

