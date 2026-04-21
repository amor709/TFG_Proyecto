from django.db import models


class Playlist(models.Model):
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='playlists')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_public = models.BooleanField(default=False)
    songs = models.ManyToManyField('music.Song', through='PlaylistSong', related_name='playlists')

    def __str__(self):
        return f"{self.name} - {self.user.username}"


class PlaylistSong(models.Model):
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)
    song = models.ForeignKey('music.Song', on_delete=models.CASCADE)
    order = models.PositiveIntegerField()

    class Meta:
        ordering = ['order']
        unique_together = ('playlist', 'order')

    def __str__(self):
        return f"{self.playlist.name} - {self.song.title}"
