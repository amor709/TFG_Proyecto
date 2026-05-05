from django.core.management.base import BaseCommand
from django.db.models import Q
from datetime import timedelta
from music.models import Song
from music.views import get_audio_duration


class Command(BaseCommand):
    help = 'Corrige las duraciones de canciones que tienen 0 minutos extrayendo la duración real del archivo de audio'

    def add_arguments(self, parser):
        parser.add_argument(
            '--all',
            action='store_true',
            help='Recalcular duración para TODAS las canciones (incluso si no es 0)',
        )

    def handle(self, *args, **options):
        if options['all']:
            # Obtener todas las canciones
            songs = Song.objects.all()
            self.stdout.write(self.style.WARNING(f'Recalculando duración para TODAS las {songs.count()} canciones...'))
        else:
            # Obtener solo las canciones con duración 0
            songs = Song.objects.filter(duration=timedelta(seconds=0))
            self.stdout.write(self.style.WARNING(f'Corrigiendo {songs.count()} canciones con duración 0...'))

        fixed_count = 0
        error_count = 0

        for song in songs:
            try:
                if not song.audio_file:
                    self.stdout.write(self.style.ERROR(f'[SKIP] {song.pk} - {song.title}: Sin archivo de audio'))
                    continue

                # Extraer duración real
                new_duration = get_audio_duration(song.audio_file)

                if new_duration and new_duration != song.duration:
                    old_duration = song.duration_display if hasattr(song, 'duration_display') else str(song.duration)
                    song.duration = new_duration
                    song.save(update_fields=['duration'])

                    new_duration_display = song.duration_display if hasattr(song, 'duration_display') else str(new_duration)
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'[FIXED] {song.pk} - {song.title}: {old_duration} → {new_duration_display}'
                        )
                    )
                    fixed_count += 1
                else:
                    self.stdout.write(f'[OK] {song.pk} - {song.title}: Duración correcta ({song.duration_display})')

            except Exception as e:
                error_count += 1
                self.stdout.write(self.style.ERROR(f'[ERROR] {song.pk} - {song.title}: {str(e)}'))

        # Resumen
        self.stdout.write(self.style.SUCCESS('═' * 60))
        self.stdout.write(self.style.SUCCESS(f' Proceso completado'))
        self.stdout.write(f'   • Corregidas: {fixed_count}')
        self.stdout.write(f'   • Errores: {error_count}')
        self.stdout.write(self.style.SUCCESS('═' * 60))

