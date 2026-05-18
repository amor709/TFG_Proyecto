from django.shortcuts import render
from django.db.models import Q
from music.models import Song, Album
from accounts.models import ArtistProfile
from playlists.models import Playlist

def search_view(request):
    query = request.GET.get('q', '').strip()
    if not query:
        return render(request, 'search_results.html', {
            'query': query,
            'artists': [],
            'songs': [],
            'albums': [],
            'playlists': [],
        })

    # Canciones: título o artista coincide
    songs = Song.objects.filter(
        Q(title__icontains=query) | Q(artist__user__username__icontains=query)
    ).select_related('artist', 'album').order_by('-plays')[:50]

    # Playlists: título coincide
    if request.user.is_authenticated and not request.user.is_artist:
        playlists = Playlist.objects.filter(
            Q(name__icontains=query)
        ).select_related('user').order_by('-created_at')[:50]
    else:
        playlists = []

    # Álbumes: título, título canción asociada o nombre artista asociado
    albums = Album.objects.filter(
        Q(title__icontains=query) |
        Q(songs__title__icontains=query) |
        Q(artist__user__username__icontains=query)
    ).distinct().select_related('artist').order_by('-release_date')[:50]

    # Artistas: nombre del artista, álbum asociado o canción asociada
    artists = ArtistProfile.objects.filter(
        Q(user__username__icontains=query) |
        Q(albums__title__icontains=query) |
        Q(songs__title__icontains=query)
    ).distinct().order_by('user__username')[:50]

    context = {
        'query': query,
        'artists': artists,
        'songs': songs,
        'albums': albums,
        'playlists': playlists,
    }
    return render(request, 'search_results.html', context)

def search_all_view(request):
    # Vista para "Ver todo" de cada tipo
    query = request.GET.get('q', '').strip()
    type_filter = request.GET.get('type', 'all')

    if type_filter == 'songs':
        songs = Song.objects.filter(
            Q(title__icontains=query) | Q(artist__user__username__icontains=query)
        ).select_related('artist', 'album').order_by('-plays')
        context = {'query': query, 'songs': songs, 'type': 'songs'}
        return render(request, 'search_all.html', context)
    elif type_filter == 'albums':
        albums = Album.objects.filter(
            Q(title__icontains=query) |
            Q(songs__title__icontains=query) |
            Q(artist__user__username__icontains=query)
        ).distinct().select_related('artist').order_by('-release_date')
        context = {'query': query, 'albums': albums, 'type': 'albums'}
        return render(request, 'search_all.html', context)
    elif type_filter == 'artists':
        artists = ArtistProfile.objects.filter(
            Q(user__username__icontains=query) |
            Q(albums__title__icontains=query) |
            Q(songs__title__icontains=query)
        ).distinct().order_by('user__username')
        context = {'query': query, 'artists': artists, 'type': 'artists'}
        return render(request, 'search_all.html', context)
    elif type_filter == 'playlists':
        if request.user.is_authenticated and not request.user.is_artist:
            playlists = Playlist.objects.filter(
                Q(name__icontains=query)
            ).select_related('user').order_by('-created_at')
        else:
            playlists = []
        context = {'query': query, 'playlists': playlists, 'type': 'playlists'}
        return render(request, 'search_all.html', context)
    else:
        # Default to main search
        return search_view(request)