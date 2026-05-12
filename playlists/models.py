from django.db import models


class Playlist(models.Model):
    user = models.ForeignKey('accounts.User', on_delete=models.CASCADE, related_name='playlists')
    name = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_public = models.BooleanField(default=False)
    songs = models.ManyToManyField('music.Song', through='PlaylistSong', related_name='playlists')
    cover = models.FileField(upload_to='covers/', blank=True, null=True)
    saved_by = models.ManyToManyField('accounts.User', related_name='saved_playlists', blank=True)
    is_liked_playlist = models.BooleanField(default=False)  # Para marcar "Mis joyas"
    order_by_field = models.CharField(max_length=20, default='added', choices=[('added', 'Añadida'), ('name', 'Nombre')])
    liked_playlist_cover = models.ImageField(upload_to='liked_playlist_covers/', blank=True, null=True)  # Cover personalizado para Mis Joyas

    @property
    def owner(self):
        return self.user

    @property
    def track_count(self):
        return self.songs.count()

    @property
    def save_count(self):
        return self.saved_by.count()

    @property
    def get_cover(self):
        """Retorna el cover apropiado: personalizado para Mis Joyas, o el cover normal"""
        if self.is_liked_playlist and self.liked_playlist_cover:
            return self.liked_playlist_cover
        return self.cover

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