"""
Señales para manejar eventos en el modelo de cuentas.
"""
from django.db.models.signals import pre_delete, post_delete, post_save
from django.dispatch import receiver
from .models import ArtistProfile, ArtistPlayCount, MonthlyArtistStats, ListenerProfile
from .stats_utils import handle_artist_deletion


@receiver(pre_delete, sender=ArtistProfile)
def artist_pre_delete(sender, instance, **kwargs):
    """
    Antes de eliminar un artista, eliminar todas sus estadísticas
    """
    handle_artist_deletion(instance)


@receiver(post_save, sender=ListenerProfile)
def create_liked_playlist(sender, instance, created, **kwargs):
    """
    Crear la playlist "Mis joyas" cuando se crea un nuevo perfil de listener.
    """
    if created:
        from playlists.models import Playlist
        from django.core.files.base import ContentFile
        from django.contrib.staticfiles import finders

        # Crear playlist "Mis joyas" si no existe
        if not Playlist.objects.filter(user=instance.user, is_liked_playlist=True).exists():
            playlist = Playlist.objects.create(
                user=instance.user,
                name="Mis joyas",
                description="Tus canciones favoritas",
                is_public=False,
                is_liked_playlist=True,
            )

            # Intentar asignar la imagen mis-joyas.png como cover.
            # finders.find() funciona tanto en dev (STATICFILES_DIRS) como en
            # producción (STATIC_ROOT tras collectstatic).
            try:
                static_path = finders.find('img/mis-joyas.png')
                if static_path:
                    with open(static_path, 'rb') as f:
                        playlist.cover.save(
                            'mis-joyas.png',
                            ContentFile(f.read()),
                            save=True
                        )
            except Exception as e:
                print(f"Error asignando cover a Mis joyas: {e}")

