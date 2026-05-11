from django.contrib.contenttypes.models import ContentType
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db.models import Q
from django.utils import timezone
from accounts.models import RecentItem
from music.models import Album
from playlists.models import Playlist
from accounts.models import ArtistProfile


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

            if hasattr(obj, 'cover'):
                cover = obj.cover.url if obj.cover else None
            else:
                cover = obj.photo.url if hasattr(obj, 'photo') and obj.photo else None

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
    """Obtiene los elementos guardados del usuario (álbumes y playlists) en orden alfabético."""
    # Obtener elementos guardados ordenados alfabéticamente por título
    saved_albums = request.user.listener_profile.saved_albums.all().order_by('title')
    saved_playlists = request.user.saved_playlists.all().order_by('name')

    items = []

    # Añadir álbumes (ordenados por título)
    for album in saved_albums:
        items.append({
            'id': album.pk,
            'title': album.title,
            'type': 'album',
            'cover': album.cover.url if album.cover else None,
            'artist': album.artist.user.username,
        })

    # Añadir playlists (ordenadas por nombre)
    for playlist in saved_playlists:
        items.append({
            'id': playlist.pk,
            'title': playlist.name,
            'type': 'playlist',
            'cover': playlist.cover.url if playlist.cover else None,
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

                # Verificar si el query coincide con el título u otro atributo
                if query.lower() in title.lower():
                    if hasattr(obj, 'cover'):
                        cover = obj.cover.url if obj.cover else None
                    else:
                        cover = obj.photo.url if hasattr(obj, 'photo') and obj.photo else None

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
        # Búsqueda solo dentro de "Guardados"
        saved_albums = request.user.listener_profile.saved_albums.all()

        # Buscar en álbumes guardados
        for album in saved_albums:
            if query.lower() in album.title.lower() or query.lower() in album.artist.user.username.lower():
                results.append({
                    'id': album.pk,
                    'title': album.title,
                    'type': 'album',
                    'cover': album.cover.url if album.cover else None,
                    'artist': album.artist.user.username,
                })

        # Buscar en playlists guardados (solo si el usuario es oyente)
        if not request.user.is_artist:
            saved_playlists = request.user.saved_playlists.all()
            for playlist in saved_playlists:
                if query.lower() in playlist.name.lower() or query.lower() in playlist.user.username.lower():
                    results.append({
                        'id': playlist.pk,
                        'title': playlist.name,
                        'type': 'playlist',
                        'cover': playlist.cover.url if playlist.cover else None,
                        'artist': playlist.user.username,
                    })

        # Limitar resultados
        results = results[:limit]


    return JsonResponse({'items': results})

