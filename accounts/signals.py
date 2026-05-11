"""
Señales para manejar eventos en el modelo de cuentas.
"""
from django.db.models.signals import pre_delete, post_delete
from django.dispatch import receiver
from .models import ArtistProfile, ArtistPlayCount, MonthlyArtistStats
from .stats_utils import handle_artist_deletion


@receiver(pre_delete, sender=ArtistProfile)
def artist_pre_delete(sender, instance, **kwargs):
    """
    Antes de eliminar un artista, eliminar todas sus estadísticas
    """
    handle_artist_deletion(instance)
