from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.contrib import messages
from datetime import timedelta
from .models import Song, Album, Tag
from .forms import SingleForm, AlbumPhaseAForm, AlbumPhaseBForm, AlbumEditForm
from .decorators import artist_required
from accounts.models import ArtistProfile
from mutagen.wave import WAVE
from mutagen.flac import FLAC
from mutagen.oggvorbis import OggVorbis
from mutagen.mp3 import MP3
from mutagen.mp4 import MP4


def get_audio_duration(audio_file):
    """
    Extrae la duración real de un archivo de audio.
    Retorna un timedelta con la duración.
    Soporta: MP3, WAV, OGG, FLAC, MP4
    """
    try:
        filename = audio_file.name.lower()

        # Intentar diferentes formatos basados en extensión
        if filename.endswith('.mp3'):
            audio = MP3(audio_file)
        elif filename.endswith('.wav'):
            audio = WAVE(audio_file)
        elif filename.endswith('.ogg'):
            audio = OggVorbis(audio_file)
        elif filename.endswith('.flac'):
            audio = FLAC(audio_file)
        elif filename.endswith(('.mp4', '.m4a')):
            audio = MP4(audio_file)
        else:
            # Si no reconoce el formato, retornar 0
            return timedelta(seconds=0)

        # Obtener duración en segundos
        duration_seconds = int(audio.info.length)
        return timedelta(seconds=duration_seconds)
    except Exception as e:
        # Si hay error al leer la duración, retornar 0
        print(f"Error extrayendo duración de audio: {e}")
        return timedelta(seconds=0)


def update_album_tags(album):
    """Actualiza los tags del álbum basado en las tags de sus canciones."""
    all_tags = set()
    for song in album.songs.all():
        all_tags.update(song.tags.all())
    
    # Remover "Nulo" si hay otros tags
    nulo_tag = Tag.objects.filter(name="Nulo").first()
    if nulo_tag and all_tags:
        album.tags.remove(nulo_tag)
    
    # Actualizar tags
    album.tags.set(all_tags or [nulo_tag] if nulo_tag else [])


@require_GET
def get_track_data(request, track_id):
    """Obtiene datos de una canción en JSON para cargar sin recargar página."""
    try:
        track = get_object_or_404(Song, pk=track_id)
        data = {
            'id': track.id,
            'title': track.title,
            'artist': track.authors_display,
            'artist_id': track.artist.id,
            'album_id': track.album_id,  # None si es single
            'artists': [{'id': track.artist.id, 'name': track.artist.user.username}] + [
                {'id': c.id, 'name': c.user.username} for c in track.collaborators.all()
            ],
            'cover': track.cover.url if track.cover else '/static/img/logo.png',
            'audio_url': track.audio_file.url if track.audio_file else '',
            'related_artist': {
                'id': track.artist.id,
                'name': track.artist.user.username,
                'photo': track.artist.photo.url
            }
        }
        return JsonResponse(data)
    except Song.DoesNotExist:
        return JsonResponse({}, status=404)


@artist_required
@require_http_methods(["GET", "POST"])
def create_single(request):
    if request.method == 'POST':
        form = SingleForm(request.POST, request.FILES)
        if form.is_valid():
            song = form.save(commit=False)
            song.artist = request.user.artist_profile
            song.album = None  # Asegurar que no tenga álbum

            # Extraer duración real del archivo de audio
            if 'audio_file' in request.FILES:
                audio_file = request.FILES['audio_file']
                song.duration = get_audio_duration(audio_file)
            else:
                song.duration = timedelta(seconds=0)

            song.save()
            form.save_m2m()  # Guardar relaciones ManyToMany

            return redirect('music:artist_detail')
    else:
        form = SingleForm()

    return render(request, 'music/create_single.html', {'form': form})


@artist_required
@require_http_methods(["GET", "POST"])
def album_phase_a(request):
    """Vista para la Configuración del Contenedor """
    if request.method == 'POST':
        form = AlbumPhaseAForm(request.POST, request.FILES)
        if form.is_valid():
            album = form.save(commit=False)
            album.artist = request.user.artist_profile
            album.is_draft = True
            album.completed = False
            album.save()
            form.save_m2m()  # Guardar relaciones ManyToMany

            # Asignar tag "Nulo" inicialmente
            nulo_tag, created = Tag.objects.get_or_create(name="Nulo")
            album.tags.add(nulo_tag)

            return redirect('music:album_phase_b', album_id=album.pk)
    else:
        form = AlbumPhaseAForm()

    return render(request, 'music/album_phase_a.html', {'form': form})


@artist_required
@require_http_methods(["GET", "POST"])
def album_phase_b(request, album_id):
    """Vista para la gestión de tracks) FAswe B."""
    album = get_object_or_404(Album, pk=album_id, artist=request.user.artist_profile)

    if request.method == 'POST':
        form = AlbumPhaseBForm(request.POST, request.FILES, artist=request.user.artist_profile)
        if form.is_valid():
            song = form.save(commit=False)
            song.artist = request.user.artist_profile
            song.album = album
            song.release_date = album.release_date

            # Usar portada del álbum si no se especifica
            if not request.FILES.get('cover'):
                song.cover = album.cover

            # Extraer duración real del archivo de audio
            if 'audio_file' in request.FILES:
                audio_file = request.FILES['audio_file']
                song.duration = get_audio_duration(audio_file)
            else:
                song.duration = timedelta(seconds=0)

            song.save()
            form.save_m2m()  # Guardar tags y colaboradores

            # Actualizar tags del álbum basado en las canciones
            update_album_tags(album)

            return redirect('music:album_phase_b', album_id=album.pk)
    else:
        form = AlbumPhaseBForm(artist=request.user.artist_profile)

    songs = album.songs.all()
    return render(request, 'music/album_phase_b.html', {
        'album': album,
        'form': form,
        'songs': songs
    })


@artist_required
@require_http_methods(["GET"])
def publish_album(request, album_id):
    """Vista para publicar un álbum (pasar de borrador a publicado)."""
    album = get_object_or_404(Album, pk=album_id, artist=request.user.artist_profile)

    if not album.songs.exists():
        messages.error(request, "El álbum debe tener al menos una canción para publicarse.")
        return redirect('music:album_phase_b', album_id=album.pk)

    album.mark_completed()
    return redirect('music:album_detail', album_id=album.pk)


def song_list(request):
    songs = Song.objects.all().order_by('-release_date')
    return render(request, 'music/song_list.html', {'songs': songs})


@artist_required
@require_http_methods(["POST"])
def delete_song(request, song_id):
    """Elimina una canción del álbum."""
    song = get_object_or_404(Song, pk=song_id, artist=request.user.artist_profile)
    album = song.album

    if album:
        song.delete()
        # Actualizar tags del álbum
        update_album_tags(album)
        return JsonResponse({'success': True})
    else:
        return JsonResponse({'success': False}, status=400)


def artist_detail(request, artist_id=None):
    # Si no se pasa artist_id, usar el propio si es artista
    if artist_id is None:
        if not request.user.is_authenticated or not request.user.is_artist:
            return redirect('home')
        artist = request.user.artist_profile
    else:
        artist = get_object_or_404(ArtistProfile, pk=artist_id)

    # Datos básicos para mostrar la página
    top_songs = artist.songs.all().order_by('-plays')[:6]  # Ordenar por plays
    releases = list(artist.albums.all()) + list(artist.songs.filter(album__isnull=True))  # Combinar para releases
    releases.sort(key=lambda x: x.release_date, reverse=True)  # Ordenar por fecha reciente
    # Marcar cada lanzamiento: el single (Song suelto) se reproduce; el álbum lleva a su página
    for item in releases:
        item.is_single = isinstance(item, Song)
    albums = artist.albums.all()
    singles = artist.songs.filter(album__isnull=True)
    # Features: canciones donde el artista es colaborador
    features = Song.objects.filter(collaborators=artist).distinct()[:10]

    # Verificar si el usuario sigue al artista
    is_followed = False
    if request.user.is_authenticated and hasattr(request.user, 'listener_profile'):
        is_followed = request.user.listener_profile.following.filter(pk=artist.pk).exists()

    # Verificar si es el propio perfil (para mostrar botones de edición)
    is_own_profile = request.user.is_authenticated and request.user.is_artist and artist == request.user.artist_profile

    context = {
        'artist': artist,
        'top_songs': top_songs,
        'releases': releases[:10],  # Limitar a 10 para el carrusel
        'albums': albums,
        'singles': singles,
        'features': features,
        'is_followed': is_followed,
        'is_own_profile': is_own_profile,
    }
    return render(request, 'music/artist_detail.html', context)


def artist_albums(request, artist_id):
    """Listado completo de álbumes de un artista (botón 'Ver más')."""
    artist = get_object_or_404(ArtistProfile, pk=artist_id)
    albums = artist.albums.all().order_by('-release_date')
    return render(request, 'music/artist_albums.html', {'artist': artist, 'albums': albums})


def artist_singles(request, artist_id):
    """Listado completo de singles (canciones sueltas) de un artista (botón 'Ver más')."""
    artist = get_object_or_404(ArtistProfile, pk=artist_id)
    singles = artist.songs.filter(album__isnull=True).order_by('-release_date')
    return render(request, 'music/artist_singles.html', {'artist': artist, 'singles': singles})


def album_detail(request, album_id):
    """
    Vista para mostrar los detalles de un álbum con su lista de canciones
    y recomendaciones de otros álbumes del mismo artista.
    """
    album = get_object_or_404(Album, pk=album_id)

    # Obtener todas las canciones del álbum ordenadas por ID (orden de creación)
    songs = album.songs.all().order_by('id')

    # Recomendaciones aleatorias: 5 canciones del mismo artista excluyendo el álbum actual
    recommended = Song.objects.filter(
        artist=album.artist
    ).exclude(album=album).select_related('album').order_by('?')[:5]

    # ¿Es el usuario actual el dueño del álbum? (para mostrar el botón Editar)
    is_owner = (
        request.user.is_authenticated
        and getattr(request.user, 'is_artist', False)
        and hasattr(request.user, 'artist_profile')
        and album.artist_id == request.user.artist_profile.id
    )

    context = {
        'album': album,
        'songs': songs,
        'recommended': recommended,
        'is_owner': is_owner,
    }
    return render(request, 'music/album_detail.html', context)


@artist_required
@require_http_methods(["GET", "POST"])
def edit_album(request, album_id):
    """Editar los datos de un álbum propio (título, descripción, fecha, portada)."""
    album = get_object_or_404(Album, pk=album_id, artist=request.user.artist_profile)

    if request.method == 'POST':
        form = AlbumEditForm(request.POST, request.FILES, instance=album)
        if form.is_valid():
            form.save()
            return redirect('music:album_detail', album_id=album.pk)
    else:
        form = AlbumEditForm(instance=album)

    return render(request, 'music/edit_album.html', {'form': form, 'album': album})


@artist_required
@require_http_methods(["POST"])
def delete_album(request, album_id):
    """Borra un álbum propio y, en cascada, todas sus canciones de la BD."""
    album = get_object_or_404(Album, pk=album_id, artist=request.user.artist_profile)

    # Song.album usa SET_NULL, así que borramos las canciones explícitamente.
    album.songs.all().delete()
    album.delete()

    return redirect('music:artist_detail')

