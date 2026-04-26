from django.contrib import admin
from .models import Playlist, PlaylistSong


class PlaylistSongInline(admin.TabularInline):
    model = PlaylistSong
    extra = 0
    ordering = ('order',)


@admin.register(Playlist)
class PlaylistAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'user', 'is_public', 'created_at', 'get_song_count')
    list_filter = ('is_public', 'created_at', 'user')
    search_fields = ('name', 'description', 'user__username')
    ordering = ('-created_at',)
    readonly_fields = ('id',)

    inlines = [PlaylistSongInline]
    
    def get_song_count(self, obj):
        return obj.songs.count()
    get_song_count.short_description = 'Número de canciones'


@admin.register(PlaylistSong)
class PlaylistSongAdmin(admin.ModelAdmin):
    list_display = ('id', 'playlist', 'song', 'order')
    list_filter = ('playlist__user', 'playlist')
    search_fields = ('playlist__name', 'song__title')
    ordering = ('playlist', 'order')
    readonly_fields = ('id',)
