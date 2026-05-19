from django.shortcuts import render, get_object_or_404, redirect
from django.contrib import messages
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from .models import Playlist, PlaylistSong
from .forms import PlaylistForm
from music.models import Song


def playlist_detail(request, pk):
    playlist = get_object_or_404(Playlist, pk=pk)
    
    # "Mis Joyas" solo es accesible para el dueño
    if playlist.is_liked_playlist and playlist.user != request.user:
        return redirect('home')

    # Check privacy: if private and not owner, deny access
    if not playlist.is_public and playlist.user != request.user:
        return redirect('home')
    # Obtener las canciones ordenadas
    if playlist.is_liked_playlist:
        # Para "Mis joyas", aplicar el ordenamiento especificado
        if playlist.order_by_field == 'name':
            songs = playlist.songs.all().order_by('title')
        else:
            songs = playlist.songs.all().order_by('-playlistsong__id')
    else:
        songs = playlist.songs.all().order_by('playlistsong__order')

    is_saved = request.user.is_authenticated and request.user.saved_playlists.filter(pk=pk).exists()
    context = {
        'playlist': playlist,
        'songs': songs,
        'is_saved': is_saved,
    }
    return render(request, 'playlists/playlist_detail.html', context)


@login_required
def create_playlist(request):
    if request.method == 'POST':
        form = PlaylistForm(request.POST, request.FILES)
        if form.is_valid():
            playlist = form.save(commit=False)
            playlist.user = request.user
            playlist.save()
            # Automatically save to user's saved playlists
            request.user.saved_playlists.add(playlist)
            return redirect('playlists:detail', pk=playlist.pk)
    else:
        form = PlaylistForm()
    return render(request, 'playlists/create_playlist.html', {'form': form})


@login_required
def edit_playlist(request, pk):
    playlist = get_object_or_404(Playlist, pk=pk, user=request.user)
    if playlist.is_liked_playlist:
        return redirect('playlists:detail', pk=playlist.pk)

    if request.method == 'POST':
        form = PlaylistForm(request.POST, request.FILES, instance=playlist)
        if form.is_valid():
            form.save()
            messages.success(request, "Playlist actualizada correctamente.")
            return redirect('playlists:detail', pk=playlist.pk)
    else:
        form = PlaylistForm(instance=playlist)
    return render(request, 'playlists/edit_playlist.html', {'form': form, 'playlist': playlist})


@login_required
def add_song_to_playlist(request, playlist_id, song_id):
    playlist = get_object_or_404(Playlist, pk=playlist_id, user=request.user)
    song = get_object_or_404(Song, pk=song_id)
    if not playlist.songs.filter(pk=song_id).exists():
        # Get next order
        next_order = playlist.playlistsong_set.count() + 1
        PlaylistSong.objects.create(playlist=playlist, song=song, order=next_order)
        return JsonResponse({'success': True})
    return JsonResponse({'success': False})


@login_required
def remove_song_from_playlist(request, playlist_id, song_id):
    playlist = get_object_or_404(Playlist, pk=playlist_id, user=request.user)
    song = get_object_or_404(Song, pk=song_id)
    PlaylistSong.objects.filter(playlist=playlist, song=song).delete()
    # Reorder remaining songs
    songs = playlist.playlistsong_set.order_by('order')
    for i, ps in enumerate(songs, 1):
        ps.order = i
        ps.save()
    return JsonResponse({'success': True})


@login_required
def save_playlist(request, pk):
    playlist = get_object_or_404(Playlist, pk=pk)
    if playlist.is_public or playlist.user == request.user:
        request.user.saved_playlists.add(playlist)
        return JsonResponse({'success': True, 'saved': True})
    return JsonResponse({'success': False})


@login_required
def unsave_playlist(request, pk):
    playlist = get_object_or_404(Playlist, pk=pk)
    if playlist.user != request.user:  # Can't unsave own playlists
        request.user.saved_playlists.remove(playlist)
        return JsonResponse({'success': True, 'saved': False})
    return JsonResponse({'success': False})

@login_required
def user_playlists(request):
    playlists = request.user.playlists.all()
    data = [{'id': p.pk, 'name': p.name} for p in playlists]
    return JsonResponse(data, safe=False)
