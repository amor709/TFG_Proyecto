"""
Utilidades para gestionar estadísticas de reproducción de usuarios.
"""
from django.utils import timezone
from datetime import timedelta, datetime
from django.db.models import Q, Count, F
from .models import (
    ArtistPlayCount, SongPlayCount,
    MonthlyArtistStats, MonthlySongStats,
    ArtistProfile, UserTag
)


def record_play(user, song):
    """
    Registra una reproducción de canción.
    Actualiza:
    - ArtistPlayCount (permanente)
    - SongPlayCount (permanente)
    - MonthlyArtistStats (30 días)
    - MonthlySongStats (30 días)
    
    Args:
        user: User instance
        song: Song instance
    """
    if not user or not song or not song.artist:
        return False
    
    now = timezone.now()
    current_month = now.strftime('%Y-%m')
    
    # 1. Actualizar ArtistPlayCount (permanente)
    artist_play, _ = ArtistPlayCount.objects.get_or_create(
        user=user,
        artist=song.artist,
        defaults={'play_count': 0}
    )
    artist_play.play_count += 1
    artist_play.last_played = now
    artist_play.save()
    
    # 2. Actualizar SongPlayCount (permanente)
    song_play, _ = SongPlayCount.objects.get_or_create(
        user=user,
        song=song,
        defaults={'play_count': 0}
    )
    song_play.play_count += 1
    song_play.last_played = now
    song_play.save()
    
    # 3. Actualizar MonthlyArtistStats (30 días)
    monthly_artist, _ = MonthlyArtistStats.objects.get_or_create(
        user=user,
        artist=song.artist,
        month=current_month,
        defaults={'play_count': 0}
    )
    monthly_artist.play_count += 1
    monthly_artist.last_updated = now
    monthly_artist.save()
    
    # 4. Actualizar MonthlySongStats (30 días)
    monthly_song, _ = MonthlySongStats.objects.get_or_create(
        user=user,
        song=song,
        month=current_month,
        defaults={'play_count': 0}
    )
    monthly_song.play_count += 1
    monthly_song.last_updated = now
    monthly_song.save()

    # 5. Contadores GLOBALES (no por-usuario), de forma atómica:
    #    - Song.plays: lo usa "Canciones más escuchadas" del perfil de artista.
    #    - ArtistProfile.total_plays: total de reproducciones del artista.
    from music.models import Song
    Song.objects.filter(pk=song.pk).update(plays=F('plays') + 1)
    ArtistProfile.objects.filter(pk=song.artist_id).update(total_plays=F('total_plays') + 1)

    # 6. Preferencias de género del usuario (UserTag), para las recomendaciones:
    #    - Renovar los tags de la canción escuchada (last_listened se actualiza solo).
    #    - Eliminar los tags que lleven más de 30 días sin reproducirse.
    for tag in song.tags.all():
        user_tag, created = UserTag.objects.get_or_create(user=user, tag=tag)
        if not created:
            user_tag.listen_count += 1
            user_tag.save()  # last_listened se actualiza solo (auto_now=True)
    UserTag.objects.filter(
        user=user,
        last_listened__lt=now - timedelta(days=30)
    ).delete()

    return True


def get_top_songs_this_month(user, limit=5):
    """
    Obtiene las canciones más escuchadas este mes.
    
    Args:
        user: User instance
        limit: Número máximo de resultados
    
    Returns:
        QuerySet de Song ordenadas por play_count
    """
    current_month = timezone.now().strftime('%Y-%m')
    
    monthly_stats = MonthlySongStats.objects.filter(
        user=user,
        month=current_month
    ).select_related('song', 'song__artist', 'song__album').order_by('-play_count')[:limit]
    
    return [stat.song for stat in monthly_stats]


def get_top_artists_this_month(user, limit=5):
    """
    Obtiene los artistas más escuchados este mes.
    
    Args:
        user: User instance
        limit: Número máximo de resultados
    
    Returns:
        QuerySet de ArtistProfile ordenadas por play_count
    """
    current_month = timezone.now().strftime('%Y-%m')
    
    monthly_stats = MonthlyArtistStats.objects.filter(
        user=user,
        month=current_month
    ).select_related('artist', 'artist__user').order_by('-play_count')[:limit]
    
    return [stat.artist for stat in monthly_stats]


def get_all_top_songs_this_month(user):
    """
    Obtiene TODAS las canciones más escuchadas este mes.
    
    Args:
        user: User instance
    
    Returns:
        QuerySet de Song ordenadas por play_count
    """
    current_month = timezone.now().strftime('%Y-%m')
    
    monthly_stats = MonthlySongStats.objects.filter(
        user=user,
        month=current_month
    ).select_related('song', 'song__artist', 'song__album').order_by('-play_count')
    
    return [stat.song for stat in monthly_stats]


def get_all_top_artists_this_month(user):
    """
    Obtiene TODOS los artistas más escuchados este mes.
    
    Args:
        user: User instance
    
    Returns:
        QuerySet de ArtistProfile ordenadas por play_count
    """
    current_month = timezone.now().strftime('%Y-%m')
    
    monthly_stats = MonthlyArtistStats.objects.filter(
        user=user,
        month=current_month
    ).select_related('artist', 'artist__user').order_by('-play_count')
    
    return [stat.artist for stat in monthly_stats]


def cleanup_old_monthly_stats(user, days=30):
    """
    Limpia las estadísticas mensuales más antiguas de 30 días.
    Se llama cuando un nuevo mes comienza.
    
    Args:
        user: User instance (None para todos los usuarios)
        days: Número de días a mantener (por defecto 30)
    """
    cutoff_date = timezone.now() - timedelta(days=days)
    cutoff_month = cutoff_date.strftime('%Y-%m')
    
    if user:
        MonthlyArtistStats.objects.filter(
            user=user,
            month__lt=cutoff_month
        ).delete()
        
        MonthlySongStats.objects.filter(
            user=user,
            month__lt=cutoff_month
        ).delete()
    else:
        # Limpiar para todos los usuarios
        MonthlyArtistStats.objects.filter(
            month__lt=cutoff_month
        ).delete()
        
        MonthlySongStats.objects.filter(
            month__lt=cutoff_month
        ).delete()


def handle_artist_deletion(artist):
    """
    Maneja la eliminación de un artista.
    Elimina todas sus reproducciones en estadísticas.
    
    Args:
        artist: ArtistProfile instance
    """
    ArtistPlayCount.objects.filter(artist=artist).delete()
    MonthlyArtistStats.objects.filter(artist=artist).delete()


def handle_song_deactivation(song):
    """
    Maneja la desactivación de una canción.
    Las reproducciones se mantienen, pero la canción no aparece en búsquedas.
    
    Este método no hace nada aquí, solo documenta el comportamiento.
    Las reproducciones ya están registradas en SongPlayCount y MonthlySongStats.
    """
    pass
