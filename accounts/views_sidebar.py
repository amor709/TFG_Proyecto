from django.contrib.contenttypes.models import ContentType
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.templatetags.static import static
from django.utils import timezone
from accounts.models import RecentItem
from music.models import Album
from playlists.models import Playlist
from accounts.models import ArtistProfile


def _cover_for(obj, model_name):
    """Devuelve siempre una URL válida (con fallback al default correspondiente)."""
    if model_name == 'playlist':
        return obj.cover_url
    if model_name == 'artistprofile':
        return obj.photo_url
    if hasattr(obj, 'cover') and obj.cover:
        return obj.cover.url
    if hasattr(obj, 'photo') and obj.photo:
        return obj.photo.url
    return static('img/logo.png')


@login_required
def add_to_recent(request, content_type, object_id):
    """Añade o mueve un elemento a la lista de recientes."""
    if request.method != 'POST':
        return JsonResponse({'success': False, 'error': 'Método no permitido'}, status=405)

    try:
        # Normalizar el nombre del content_type
        content_type = content_type.lower()

        ct = ContentType.objects.get(model=content_type)
        obj = ct.get_object_for_this_type(pk=object_id)

        recent_item, created = RecentItem.objects.get_or_create(
            user=request.user,
            content_type=ct,
            object_id=object_id,
            defaults={'timestamp': timezone.now()}
        )
        if not created:
            # Si ya existe, actualizar el timestamp para moverlo al top
            recent_item.timestamp = timezone.now()
            recent_item.save()

        # Mantener solo los últimos 20
        RecentItem.objects.filter(user=request.user).order_by('-timestamp')[20:].delete()

        return JsonResponse({'success': True})
    except ContentType.DoesNotExist:
        return JsonResponse({'success': False, 'error': f'Tipo de contenido "{content_type}" no existe'}, status=400)
    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)


@login_required
def get_recent_items(request):
    """Obtiene los elementos recientes del usuario (máximo 20, ordenados por más reciente)."""
    # Obtener max 20 items ordenados por timestamp descendente (más nuevo primero)
    recent_items = RecentItem.objects.filter(user=request.user).order_by('-timestamp')[:20]
    items = []

    for item in recent_items:
        try:
            obj = item.content_object
            # Validar que el objeto aún existe (evitar huérfanos)
            if obj is None:
                item.delete()
                continue

            # Excluir perfiles de usuarios (listeners) - el usuario no quiere que se muestren
            if item.content_type.model == 'user':
                continue

            # Excluir "Mis joyas" (playlist de "Me gusta")
            if item.content_type.model == 'playlist' and hasattr(obj, 'is_liked_playlist') and obj.is_liked_playlist:
                continue

            cover = _cover_for(obj, item.content_type.model)

            # Determinar el campo "artist" según el tipo de objeto
            artist_name = None
            if item.content_type.model == 'album':
                artist_name = obj.artist.user.username if obj.artist else None
            elif item.content_type.model == 'playlist':
                artist_name = obj.user.username  # Creador de la playlist
            elif item.content_type.model == 'artistprofile':
                artist_name = obj.user.username  # El propio artista

            items.append({
                'id': obj.pk,
                'title': getattr(obj, 'title', getattr(obj, 'name', getattr(obj, 'username', str(obj)))),
                'type': item.content_type.model,
                'cover': cover,
                'artist': artist_name,
            })
        except Exception as e:
            # Si hay error al procesar el item, lo ignoramos
            print(f"Error procesando item reciente: {e}")
            continue

    return JsonResponse({'items': items})


@login_required
def get_saved_items(request):
    """Obtiene los elementos guardados del usuario (álbumes, playlists y artistas seguidos) en orden alfabético."""
    # Obtener elementos guardados ordenados alfabéticamente por título.
    # Los artistas no tienen listener_profile: álbumes/seguidos quedan vacíos.
    if hasattr(request.user, 'listener_profile'):
        listener = request.user.listener_profile
        saved_albums = listener.saved_albums.all().order_by('title')
        following_artists = listener.following.all().order_by('user__username')
    else:
        saved_albums = []
        following_artists = []
    saved_playlists = request.user.saved_playlists.all().order_by('name')

    items = []

    # Añadir artistas seguidos
    for artist in following_artists:
        items.append({
            'id': artist.pk,
            'title': artist.user.username,
            'type': 'artistprofile',
            'cover': artist.photo_url,
            'artist': artist.user.username,
        })

    # Añadir álbumes (ordenados por título)
    for album in saved_albums:
        items.append({
            'id': album.pk,
            'title': album.title,
            'type': 'album',
            'cover': album.cover.url if album.cover else static('img/logo.png'),
            'artist': album.artist.user.username,
        })

     # Añadir playlists (ordenadas por nombre) - Excluir "Mis joyas"
    for playlist in saved_playlists:
        # Excluir playlists de "Me gusta"
        if hasattr(playlist, 'is_liked_playlist') and playlist.is_liked_playlist:
            continue
        items.append({
            'id': playlist.pk,
            'title': playlist.name,
            'type': 'playlist',
            'cover': playlist.cover_url,
            'artist': playlist.user.username,
        })

    return JsonResponse({'items': items})


@login_required
def sidebar_search(request):
    """Búsqueda en tiempo real para el sidebar solo dentro de la sección seleccionada (Recientes o Guardados)."""
    query = request.GET.get('q', '').strip()
    section = request.GET.get('section', 'recent').strip()  # 'recent' o 'saved'

    if not query or len(query) < 2:  # Requerir mínimo 2 caracteres
        return JsonResponse({'items': []})

    results = []
    limit = 15  # Limitar a 15 resultados

    if section == 'recent':
        # Búsqueda solo dentro de "Recientes"
        recent_items = RecentItem.objects.filter(user=request.user).order_by('-timestamp')[:20]

        for item in recent_items:
            try:
                obj = item.content_object
                if obj is None:
                    continue

                # Obtener título y verificar si coincide con la búsqueda
                title = getattr(obj, 'title', getattr(obj, 'name', str(obj)))

                # Excluir "Mis joyas"
                if item.content_type.model == 'playlist' and hasattr(obj, 'is_liked_playlist') and obj.is_liked_playlist:
                    continue

                # Verificar si el query coincide con el título u otro atributo
                if query.lower() in title.lower():
                    cover = _cover_for(obj, item.content_type.model)

                    # Determinar el campo "artist" según el tipo de objeto para búsqueda
                    artist_name = None
                    if item.content_type.model == 'album':
                        artist_name = obj.artist.user.username if obj.artist else None
                    elif item.content_type.model == 'playlist':
                        artist_name = obj.user.username  # Creador de la playlist
                    elif item.content_type.model == 'artistprofile':
                        artist_name = obj.user.username  # El propio artista

                    results.append({
                        'id': obj.pk,
                        'title': title,
                        'type': item.content_type.model,
                        'cover': cover,
                        'artist': artist_name,
                    })
            except Exception as e:
                continue

    elif section == 'saved':
        # Búsqueda solo dentro de "Guardados".
        # Los artistas no tienen listener_profile: álbumes/seguidos quedan vacíos.
        if hasattr(request.user, 'listener_profile'):
            saved_albums = request.user.listener_profile.saved_albums.all()
            following_artists = request.user.listener_profile.following.all()
        else:
            saved_albums = []
            following_artists = []

        # Buscar en artistas seguidos
        for artist in following_artists:
            if query.lower() in artist.user.username.lower():
                results.append({
                    'id': artist.pk,
                    'title': artist.user.username,
                    'type': 'artistprofile',
                    'cover': artist.photo_url,
                    'artist': artist.user.username,
                })

        # Buscar en álbumes guardados
        for album in saved_albums:
            if query.lower() in album.title.lower() or query.lower() in album.artist.user.username.lower():
                results.append({
                    'id': album.pk,
                    'title': album.title,
                    'type': 'album',
                    'cover': album.cover.url if album.cover else static('img/logo.png'),
                    'artist': album.artist.user.username,
                })

        # Buscar en playlists guardados (solo si el usuario es oyente)
        if not request.user.is_artist:
            saved_playlists = request.user.saved_playlists.all()
            for playlist in saved_playlists:
                # Excluir "Mis joyas"
                if hasattr(playlist, 'is_liked_playlist') and playlist.is_liked_playlist:
                    continue
                if query.lower() in playlist.name.lower() or query.lower() in playlist.user.username.lower():
                    results.append({
                        'id': playlist.pk,
                        'title': playlist.name,
                        'type': 'playlist',
                        'cover': playlist.cover_url,
                        'artist': playlist.user.username,
                    })

        # Limitar resultados
        results = results[:limit]


    return JsonResponse({'items': results})

