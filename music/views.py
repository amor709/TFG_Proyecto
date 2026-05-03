from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_http_methods
from django.contrib.auth.decorators import login_required
from django.contrib import messages
from django.utils import timezone
from .models import Song, Album, Tag
from .forms import SingleForm, AlbumPhaseAForm, AlbumPhaseBForm
from .decorators import artist_required
from accounts.models import ArtistProfile


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
            'artist': track.artist.user.username,
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
        return JsonResponse({'error': 'Canción no encontrada'}, status=404)


@artist_required
@require_http_methods(["GET", "POST"])
def create_single(request):
    if request.method == 'POST':
        form = SingleForm(request.POST, request.FILES)
        if form.is_valid():
            song = form.save(commit=False)
            song.artist = request.user.artist_profile
            song.album = None  # Asegurar que no tenga álbum
            song.duration = timezone.timedelta(seconds=0)

            song.save()
            form.save_m2m()  # Guardar relaciones ManyToMany

            messages.success(request, f"¡Sencillo '{song.title}' creado exitosamente!")
            return redirect('music:song_list')
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

            messages.success(request, f"¡Álbum '{album.title}' creado! Ahora agrega tus canciones.")
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

            song.save()
            form.save_m2m()  # Guardar tags y colaboradores

            # Actualizar tags del álbum basado en las canciones
            update_album_tags(album)

            messages.success(request, f"¡Canción '{song.title}' agregada al álbum!")
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
    messages.success(request, f"¡Álbum '{album.title}' publicado exitosamente!")
    return redirect('music:song_list')


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
        return JsonResponse({'success': True, 'message': 'Canción eliminada exitosamente'})
    else:
        return JsonResponse({'success': False, 'message': 'Esta canción no pertenece a ningún álbum'}, status=400)


def artist_detail(request, artist_id=None):
    # Si no se pasa artist_id, usar el propio si es artista
    if artist_id is None:
        if not request.user.is_authenticated or not request.user.is_artist:
            messages.error(request, "No tienes acceso a esta página.")
            return redirect('music:song_list')
        artist = request.user.artist_profile
    else:
        artist = get_object_or_404(ArtistProfile, pk=artist_id)

    # Datos básicos para mostrar la página
    top_songs = artist.songs.all().order_by('-plays')[:6]  # Ordenar por plays
    releases = list(artist.albums.all()) + list(artist.songs.filter(album__isnull=True))  # Combinar para releases
    releases.sort(key=lambda x: x.release_date, reverse=True)  # Ordenar por fecha reciente
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
