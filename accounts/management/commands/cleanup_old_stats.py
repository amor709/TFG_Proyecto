"""
Management command para limpiar estadísticas mensuales antiguas.
Debe ejecutarse periódicamente (diariamente o semanalmente)
"""
from django.core.management.base import BaseCommand
from accounts.stats_utils import cleanup_old_monthly_stats


class Command(BaseCommand):
    help = 'Limpia las estadísticas mensuales más antiguas de 30 días'

    def add_arguments(self, parser):
        parser.add_argument(
            '--days',
            type=int,
            default=30,
            help='Número de días a mantener de estadísticas (por defecto: 30)'
        )
        parser.add_argument(
            '--user-id',
            type=int,
            default=None,
            help='ID del usuario para limpiar (si no se especifica, limpia todos)'
        )

    def handle(self, *args, **options):
        days = options['days']
        user_id = options['user_id']

        if user_id:
            from django.contrib.auth import get_user_model
            User = get_user_model()
            try:
                user = User.objects.get(id=user_id)
                cleanup_old_monthly_stats(user, days)
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Estadísticas más antiguas de {days} días eliminadas para usuario: {user.username}'
                    )
                )
            except User.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'Usuario con ID {user_id} no encontrado')
                )
        else:
            cleanup_old_monthly_stats(None, days)
            self.stdout.write(
                self.style.SUCCESS(
                    f'Estadísticas más antiguas de {days} días eliminadas para todos los usuarios'
                )
            )
