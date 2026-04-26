from django.contrib import admin
from .models import Genre, Album, Song


@admin.register(Genre)
class GenreAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)
    ordering = ('name',)


class SongInline(admin.TabularInline):
    model = Song
    extra = 0
    readonly_fields = ('plays',)


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'artist', 'release_date', 'get_song_count')
    list_filter = ('release_date', 'artist')
    search_fields = ('title', 'artist__user__username', 'description')
    ordering = ('-release_date',)
    
    inlines = [SongInline]
    readonly_fields = ('id',)

    def get_song_count(self, obj):
        return obj.songs.count()
    get_song_count.short_description = 'Número de canciones'


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    list_display = ('id', 'title', 'artist', 'album', 'duration', 'plays', 'explicit', 'release_date')
    list_filter = ('explicit', 'release_date', 'artist', 'album', 'genre')
    search_fields = ('title', 'artist__user__username', 'album__title')
    ordering = ('-release_date',)
    
    readonly_fields = ('plays', 'id')  # Solo lectura, se incrementa automáticamente
