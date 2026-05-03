from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class User(AbstractUser):
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

    photo = models.FileField(upload_to='profiles/', blank=True, null=True)
    banner = models.FileField(upload_to='profiles/', blank=True, null=True)
    website = models.URLField(blank=True)
    total_plays = models.PositiveIntegerField(default=0)

    @property
    def name(self):
        return self.user.username

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

    avatar = models.FileField(upload_to='profiles/', blank=True, null=True)

    following = models.ManyToManyField(ArtistProfile, blank=True, related_name='followers')

    def __str__(self):
        return f"Oyente: {self.user.username}"


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
