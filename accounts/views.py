from django.shortcuts import render
from django.views.generic import TemplateView
from music.models import Song, Album
from accounts.models import ArtistProfile


class HomeView(TemplateView):
    """Vista de inicio con contenido dinámico"""
    template_name = 'home.html'

    def get(self, request, *args, **kwargs):
        print("DEBUG: HomeView.get() llamado")
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        print("DEBUG: HomeView.get_context_data() llamado")
        context = super().get_context_data(**kwargs)

        # Artista destacado (el primero disponible o uno aleatorio)
        featured_artist = ArtistProfile.objects.first()
        print(f"DEBUG: featured_artist = {featured_artist}")
        context['featured_artist'] = featured_artist

        # Canciones escuchadas recientemente (las más populares por ahora)
        recently_played = Song.objects.all().order_by('-plays')[:6]
        print(f"DEBUG: recently_played = {list(recently_played)}")
        context['recently_played'] = recently_played

        # Artistas relacionados (todos disponibles)
        companion_artists = ArtistProfile.objects.all()[:5]
        print(f"DEBUG: companion_artists = {list(companion_artists)}")
        context['companion_artists'] = companion_artists

        # Canción actual (si hay alguna)
        current_track = Song.objects.first()
        context['current_track'] = current_track

        # Artista relacionado
        if current_track:
            context['related_artist'] = ArtistProfile.objects.exclude(
                pk=current_track.artist.pk
            ).first()
        else:
            context['related_artist'] = None

        # Items de biblioteca del usuario (playlists/álbumes)
        if hasattr(self, 'request') and self.request.user.is_authenticated:
            # Aquí se cargaría la biblioteca real del usuario
            context['library_items'] = []
        else:
            context['library_items'] = []

        print(f"DEBUG: Context keys = {list(context.keys())}")
        return context
