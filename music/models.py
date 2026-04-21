from django.db import models


class Genre(models.Model):
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class Album(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey('accounts.ArtistProfile', on_delete=models.CASCADE, related_name='albums')
    cover = models.FileField(upload_to='covers/', blank=True, null=True)
    release_date = models.DateField()
    description = models.TextField(blank=True)

    def __str__(self):
        return f"{self.title} - {self.artist.user.username}"


class Song(models.Model):
    title = models.CharField(max_length=200)
    artist = models.ForeignKey('accounts.ArtistProfile', on_delete=models.CASCADE, related_name='songs')
    album = models.ForeignKey(Album, on_delete=models.SET_NULL, null=True, blank=True, related_name='songs')
    genre = models.ForeignKey(Genre, on_delete=models.SET_NULL, null=True, blank=True)
    duration = models.DurationField()
    audio_file = models.FileField(upload_to='audio/', blank=True, null=True)
    cover = models.FileField(upload_to='covers/', blank=True, null=True)
    plays = models.PositiveIntegerField(default=0)
    explicit = models.BooleanField(default=False)
    release_date = models.DateField()

    def __str__(self):
        return f"{self.title} - {self.artist.user.username}"
