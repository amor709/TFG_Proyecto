from django.db import models
from django.contrib.auth.models import AbstractUser
from django.conf import settings


class User(AbstractUser):
    email = models.EmailField(unique=True)
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
    website = models.URLField(blank=True)
    total_plays = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"Artista: {self.user.username}"


class ListenerProfile(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='listener_profile'
    )

    avatar = models.FileField(upload_to='profiles/', blank=True, null=True)
    block_explicit = models.BooleanField(default=False)

    following = models.ManyToManyField(ArtistProfile, blank=True, related_name='followers')

    def __str__(self):
        return f"Oyente: {self.user.username}"