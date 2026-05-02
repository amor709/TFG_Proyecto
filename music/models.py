from django.db import models


GENEROS_MUSICALES = [
    "Pop", "Rock", "Hip-Hop", "Rap", "R&B",
    "Reggaeton", "K-Pop", "Electronic", "EDM", "Jazz",
    "Blues", "Country", "Folk", "Música Clásica", "Soul",
    "Funk", "Salsa", "Bachata", "Cumbia", "Bossa Nova",
    "Merengue", "Tango", "Heavy Metal", "Punk", "Ska",
    "Reggae", "Synthwave", "Lo-fi", "Trap", "Afrobeats",
    "Hyperpop"
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
    tags = models.ManyToManyField(Tag, related_name='albums', blank=False)
    is_draft = models.BooleanField(default=True)
    completed = models.BooleanField(default=False)

    def get_type_display(self):
        return "Álbum"

    def mark_completed(self):
        """Marca el álbum como completado y no borrador."""
        self.is_draft = False
        self.completed = True
        self.save()

    def __str__(self):
        return f"{self.title} - {self.artist.user.username}"


class Song(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey('accounts.ArtistProfile', on_delete=models.CASCADE, related_name='songs')
    album = models.ForeignKey(Album, on_delete=models.SET_NULL, null=True, blank=True, related_name='songs')
    tags = models.ManyToManyField(Tag, related_name='songs', blank=False)
    duration = models.DurationField(default='00:00:00')
    audio_file = models.FileField(upload_to='audio/', blank=True, null=True)
    cover = models.FileField(upload_to='covers/', blank=True, null=True)
    plays = models.PositiveIntegerField(default=0)
    explicit = models.BooleanField(default=False)
    release_date = models.DateField()

    def get_type_display(self):
        if self.album:
            return "Canción"
        else:
            return "Single"

    @property
    def is_explicit(self):
        """Alias para el campo explicit para manener compatibilidad."""
        return self.explicit

    def __str__(self):
        return f"{self.title} - {self.artist.user.username}"
