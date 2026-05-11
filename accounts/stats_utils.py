"""
Utilidades para gestionar estadísticas de reproducción de usuarios.
"""
from django.utils import timezone
from datetime import timedelta, datetime
from django.db.models import Q, Count
from .models import (
    ArtistPlayCount, SongPlayCount, 
    MonthlyArtistStats, MonthlySongStats
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
