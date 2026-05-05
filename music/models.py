from django.db import models
from django.utils import timezone


GENEROS_MUSICALES = [
    "Pop", "Rock", "Hip-Hop", "Rap", "R&B",
    "Reggaeton", "K-Pop", "Electronic", "EDM", "Jazz",
    "Blues", "Country", "Folk", "Música Clásica", "Soul",
    "Funk", "Salsa", "Bachata", "Cumbia", "Bossa Nova",
    "Merengue", "Tango", "Heavy Metal", "Punk", "Ska",
    "Reggae", "Synthwave", "Lo-fi", "Trap", "Afrobeats",
    "Hyperpop", "Nulo"
]


class Tag(models.Model):
    name = models.CharField(max_length=50, unique=True, choices=[(g, g) for g in GENEROS_MUSICALES])

    def __str__(self):
        return self.name


class Album(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey('accounts.ArtistProfile', on_delete=models.CASCADE, related_name='albums')
    cover = models.FileField(upload_to='covers/', blank=True, null=True)
    release_date = models.DateField()
    description = models.TextField(blank=True)
    tags = models.ManyToManyField(Tag, related_name='albums', blank=True)
    is_draft = models.BooleanField(default=True)
    completed = models.BooleanField(default=False)

    def get_type_display(self):
        return "Álbum"

    def mark_completed(self):
        """Marca el álbum como completado y no borrador."""
        self.is_draft = False
        self.completed = True
        self.save()

    @property
    def track_count(self):
        """Retorna el número de canciones en el álbum."""
        return self.songs.count()

    @property
    def total_duration_display(self):
        """Retorna la duración total del álbum en formato legible."""
        total_seconds = sum(
            int(song.duration.total_seconds())
            for song in self.songs.all()
        )
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60

        if hours > 0:
            return f"{hours}h {minutes}m"
        else:
            return f"{minutes}m"

    def __str__(self):
        return f"{self.title} - {self.artist.user.username}"


class Song(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey('accounts.ArtistProfile', on_delete=models.CASCADE, related_name='songs')
    album = models.ForeignKey(Album, on_delete=models.SET_NULL, null=True, blank=True, related_name='songs')
    tags = models.ManyToManyField(Tag, related_name='songs', blank=False)
    duration = models.DurationField(default=timezone.timedelta(seconds=0))
    audio_file = models.FileField(upload_to='audio/', blank=True, null=True)
    cover = models.FileField(upload_to='covers/', blank=True, null=True)
    plays = models.PositiveIntegerField(default=0)
    release_date = models.DateField()
    collaborators = models.ManyToManyField('accounts.ArtistProfile', related_name='collaborations', blank=True)

    def get_type_display(self):
        if self.album:
            return "Canción"
        else:
            return "Single"

    @property
    def duration_display(self):
        """Retorna la duración en formato mm:ss"""
        total_seconds = int(self.duration.total_seconds())
        minutes = total_seconds // 60
        seconds = total_seconds % 60
        return f"{minutes}:{seconds:02d}"

    @property
    def is_liked(self):
        """Retorna True si la canción tiene like (placeholder para futuro)."""
        # TODO: Implementar sistema de likes cuando exista el modelo
        return False

    @property
    def featured_artists(self):
        """Retorna los artistas colaboradores (excluding the main artist)"""
        # Para compatibilidad, retornar los colaboradores
        return self.collaborators

    def __str__(self):
        return f"{self.title} - {self.artist.user.username}"
