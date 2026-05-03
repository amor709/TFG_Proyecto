from django.contrib import admin
from django import forms
from .models import Tag, Album, Song


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('id', 'name')
    search_fields = ('name',)
    ordering = ('name',)


class AlbumForm(forms.ModelForm):
    class Meta:
        model = Album
        fields = '__all__'

    def clean_tags(self):
        tags = self.cleaned_data.get('tags')
        if not tags:
            raise forms.ValidationError("Debe seleccionar al menos un tag.")
        return tags


class SongForm(forms.ModelForm):
    class Meta:
        model = Song
        fields = '__all__'

    def clean_tags(self):
        tags = self.cleaned_data.get('tags')
        if not tags:
            raise forms.ValidationError("Debe seleccionar al menos un tag.")
        return tags


class SongInline(admin.TabularInline):
    model = Song
    extra = 0
    readonly_fields = ('plays',)
    form = SongForm


@admin.register(Album)
class AlbumAdmin(admin.ModelAdmin):
    form = AlbumForm
    list_display = ('id', 'title', 'artist', 'release_date', 'get_song_count')
    list_filter = ('release_date', 'artist')
    search_fields = ('title', 'artist__user__username', 'description')
    ordering = ('-release_date',)
    
    inlines = [SongInline]
    readonly_fields = ('id',)
    filter_horizontal = ('tags',)  # Para ManyToMany

    def get_song_count(self, obj):
        return obj.songs.count()
    get_song_count.short_description = 'Número de canciones'


@admin.register(Song)
class SongAdmin(admin.ModelAdmin):
    form = SongForm
    list_display = ('id', 'title', 'artist', 'album', 'duration', 'plays', 'release_date')
    list_filter = ('release_date', 'artist', 'album')
    search_fields = ('title', 'artist__user__username', 'album__title')
    ordering = ('-release_date',)
    
    readonly_fields = ('plays', 'id')  # Solo lectura, se incrementa automáticamente
    filter_horizontal = ('tags',)  # Para ManyToMany
