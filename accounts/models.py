from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings
from django.utils import timezone
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.core.validators import RegexValidator


# Validador personalizado que permite espacios
username_validator = RegexValidator(
    regex=r'^[\w\s.@+-]+$',
    message='Introduzca un nombre de usuario válido. Este valor puede contener únicamente letras, números, espacios y los caracteres @/./+/-/_',
    code='invalid_username',
)


class User(AbstractUser):
    username = models.CharField(
        max_length=150,
        unique=True,
        validators=[username_validator],
        help_text='150 caracteres como máximo. Letras, dígitos, espacios y @/./+/-/_',
    )
    email = models.EmailField(unique=True)
    nickname = models.CharField(max_length=50, blank=True, null=True)
    is_artist = models.BooleanField(default=False)
    is_premium = models.BooleanField(default=False)
    language = models.CharField(max_length=10, default='es')
    birth_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.username


class ArtistProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='artist_profile'
    )
    bio = models.TextField(max_length=500, blank=True)

    photo = models.FileField(upload_to='profiles/', max_length=255, blank=True, null=True)
    banner = models.FileField(upload_to='profiles/', max_length=255, blank=True, null=True)
    total_plays = models.PositiveIntegerField(default=0)
    slug = models.SlugField(unique=True, null=True, blank=True)

    @property
    def name(self):
        return self.user.username

    @property
    def primary_genre(self):
        """Retorna el género principal basado en las tags de las canciones."""
        from django.db.models import Count
        tags = self.songs.values('tags').annotate(count=Count('tags')).order_by('-count')
        if tags:
            from music.models import Tag
            tag_id = tags[0]['tags']
            tag = Tag.objects.get(id=tag_id)
            return tag.name
        return "Nulo"

    @property
    def followers_count(self):
        return self.followers.count()

    def __str__(self):
        return f"Artista: {self.user.username}"


class ListenerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listener_profile'
    )

    avatar = models.FileField(upload_to='profiles/', max_length=255, blank=True, null=True)

    following = models.ManyToManyField(ArtistProfile, blank=True, related_name='followers')
    saved_albums = models.ManyToManyField('music.Album', related_name='saved_by_users', blank=True)

    def __str__(self):
        return f"Oyente: {self.user.username}"
    
    @property
    def playlist_count(self):
        """Retorna el número de playlists públicas del usuario"""
        return self.user.playlists.filter(is_public=True).count()
    
    @property
    def following_count(self):
        """Retorna el número de artistas que sigue el usuario"""
        return self.following.count()


class ListeningHistory(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='listening_history')
    song = models.ForeignKey('music.Song', on_delete=models.CASCADE)
    played_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-played_at']

    def __str__(self):
        return f"{self.user.username} listened to {self.song.title}"


class UserTag(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='user_tags')
    tag = models.ForeignKey('music.Tag', on_delete=models.CASCADE)
    last_listened = models.DateTimeField(auto_now=True)
    listen_count = models.PositiveIntegerField(default=1)

    class Meta:
        unique_together = ('user', 'tag')

    def __str__(self):
        return f"{self.user.username} - {self.tag.name}"


class PlaybackSession(models.Model):
    """
    Modelo para gestionar sesiones activas de reproducción.
    Evita que un usuario esté escuchando en múltiples dispositivos/pestañas simultáneamente.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='playback_sessions'
    )

    # Identificador único de la sesión (generado por el cliente).
    # Único por usuario (no global): distintos usuarios pueden reutilizar el mismo id de cliente.
    session_id = models.CharField(max_length=255)

    # Track actual en reproducción
    track_id = models.IntegerField(null=True, blank=True)
    track_title = models.CharField(max_length=255, blank=True)
    track_artist = models.CharField(max_length=255, blank=True)

    # Información adicional de la canción
    cover_url = models.URLField(blank=True, null=True)

    # Tiempo actual de reproducción
    current_time = models.FloatField(default=0.0)

    # Estado de reproducción
    is_playing = models.BooleanField(default=False)

    # Información de dispositivo
    device_info = models.CharField(max_length=255, blank=True)
    user_agent = models.TextField(blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_activity = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-last_activity']
        verbose_name = 'Sesión de reproducción'
        verbose_name_plural = 'Sesiones de reproducción'
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'session_id'],
                name='unique_user_session_id',
            ),
        ]

    def __str__(self):
        return f"Sesión de {self.user.username} - {self.session_id[:10]}"

    @property
    def is_active(self):
        """Verificar si la sesión está activa (menos de 30 minutos de inactividad)"""
        from datetime import timedelta
        timeout = timedelta(minutes=30)
        return (timezone.now() - self.last_activity) < timeout

    def mark_active(self):
        """Marcar sesión como activa actualizando timestamp"""
        self.last_activity = timezone.now()
        self.save(update_fields=['last_activity'])


class RecentItem(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='recent_items')
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')
    timestamp = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-timestamp']
        unique_together = ('user', 'content_type', 'object_id')

    def __str__(self):
        return f"{self.user.username} - {self.content_object}"


# Modelos de estadísticas de reproducción

class ArtistPlayCount(models.Model):
    """
    Recuento permanente de reproducciones de un artista por usuario.
    Se incrementa cada vez que se reproduce una canción del artista.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='artist_play_counts'
    )
    artist = models.ForeignKey(
        ArtistProfile,
        on_delete=models.CASCADE,
        related_name='play_counts'
    )
    play_count = models.PositiveIntegerField(default=0)
    last_played = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'artist')
        verbose_name = 'Recuento de reproducciones de artista'
        verbose_name_plural = 'Recuentos de reproducciones de artistas'

    def __str__(self):
        return f"{self.user.username} - {self.artist.user.username}: {self.play_count} reproducciones"


class SongPlayCount(models.Model):
    """
    Recuento permanente de reproducciones de una canción por usuario.
    Se incrementa cada vez que se reproduce la canción.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='song_play_counts'
    )
    song = models.ForeignKey(
        'music.Song',
        on_delete=models.CASCADE,
        related_name='play_counts'
    )
    play_count = models.PositiveIntegerField(default=0)
    last_played = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'song')
        verbose_name = 'Recuento de reproducciones de canción'
        verbose_name_plural = 'Recuentos de reproducciones de canciones'

    def __str__(self):
        return f"{self.user.username} - {self.song.title}: {self.play_count} reproducciones"


class MonthlyArtistStats(models.Model):
    """
    Estadísticas mensuales de artistas (últimos 30 días).
    Se crea un registro por mes/usuario/artista.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='monthly_artist_stats'
    )
    artist = models.ForeignKey(
        ArtistProfile,
        on_delete=models.CASCADE,
        related_name='monthly_stats'
    )
    month = models.CharField(max_length=7)  # Formato: YYYY-MM
    play_count = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'artist', 'month')
        verbose_name = 'Estadística mensual de artista'
        verbose_name_plural = 'Estadísticas mensuales de artistas'
        ordering = ['-last_updated']

    def __str__(self):
        return f"{self.user.username} - {self.artist.user.username} ({self.month}): {self.play_count}"


class MonthlySongStats(models.Model):
    """
    Estadísticas mensuales de canciones (últimos 30 días).
    Se crea un registro por mes/usuario/canción.
    """
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='monthly_song_stats'
    )
    song = models.ForeignKey(
        'music.Song',
        on_delete=models.CASCADE,
        related_name='monthly_stats'
    )
    month = models.CharField(max_length=7)  # Formato: YYYY-MM
    play_count = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'song', 'month')
        verbose_name = 'Estadística mensual de canción'
        verbose_name_plural = 'Estadísticas mensuales de canciones'
        ordering = ['-last_updated']

    def __str__(self):
        return f"{self.user.username} - {self.song.title} ({self.month}): {self.play_count}"
