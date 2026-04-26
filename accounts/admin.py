from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import User, ArtistProfile, ListenerProfile


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('username', 'email', 'is_artist', 'is_premium', 'is_staff', 'is_active')
    list_filter = ('is_artist', 'is_premium', 'is_staff', 'is_active', 'date_joined')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-date_joined',)

    fieldsets = UserAdmin.fieldsets + (
        ('Información adicional', {
            'fields': ('is_artist', 'is_premium', 'language', 'birth_date')
        }),
    )


@admin.register(ArtistProfile)
class ArtistProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'website', 'total_plays')
    list_filter = ('total_plays',)
    search_fields = ('user__username', 'user__email', 'bio')
    ordering = ('-total_plays',)

    readonly_fields = ('total_plays', 'id')


@admin.register(ListenerProfile)
class ListenerProfileAdmin(admin.ModelAdmin):
    list_display = ('id', 'user', 'block_explicit')
    list_filter = ('block_explicit',)
    search_fields = ('user__username', 'user__email')
    ordering = ('user__username',)
    readonly_fields = ('id',)
