"""
Comando de gestión para crear automáticamente "Mis joyas" para todos los usuarios listener.
"""
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.conf import settings
from playlists.models import Playlist
from accounts.models import ListenerProfile
import os

User = get_user_model()


class Command(BaseCommand):

    def handle(self, *args, **options):
        # Obtener todos los usuarios que tienen un ListenerProfile
        listener_users = User.objects.filter(listener_profile__isnull=False)

        created_count = 0
        already_exists_count = 0

        # Ruta de la imagen mis-joyas.png
        mis_joyas_img_path = os.path.join(settings.STATIC_ROOT, 'img', 'mis-joyas.png')

        for user in listener_users:
            # Verificar si el usuario ya tiene una playlist "Mis joyas"
            liked_playlist = Playlist.objects.filter(user=user, is_liked_playlist=True)

            if liked_playlist.exists():
                already_exists_count += 1
                self.stdout.write(
                    self.style.WARNING(f'  ⚪ {user.username} ya tiene Mis joyas')
                )
            else:
                # Crear la playlist
                playlist = Playlist.objects.create(
                    user=user,
                    name="Mis joyas",
                    description="Tus canciones favoritas",
                    is_public=False,
                    is_liked_playlist=True
                )

                # Intentar agregar la imagen si existe
                if os.path.exists(mis_joyas_img_path):
                    try:
                        with open(mis_joyas_img_path, 'rb') as img_file:
                            playlist.cover.save('mis-joyas.png', ContentFile(img_file.read()), save=True)
                        self.stdout.write(
                            self.style.SUCCESS(f'  ✅ Creada Mis joyas para {user.username} (con imagen)')
                        )
                    except Exception as e:
                        self.stdout.write(
                            self.style.WARNING(f'  ⚠️  Creada Mis joyas para {user.username} (sin imagen: {str(e)})')
                        )
                else:
                    self.stdout.write(
                        self.style.WARNING(f'  ⚠️  Creada Mis joyas para {user.username} (imagen no encontrada)')
                    )

                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'\n✅ Completado!\n'
                f'   - Creadas: {created_count}\n'
                f'   - Ya existían: {already_exists_count}\n'
            )
        )


