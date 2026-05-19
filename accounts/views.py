from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.views.generic import TemplateView, CreateView
from django.views.decorators.http import require_http_methods
from django.contrib import messages
from django.urls import reverse_lazy
from music.models import Song, Album
from accounts.models import ArtistProfile, User, ListenerProfile, ListeningHistory, UserTag
from django import forms
from accounts.forms import ArtistProfileForm, ListenerProfileForm, ListenerProfileEditForm
from accounts.stats_utils import (
    get_top_songs_this_month, get_top_artists_this_month,
    get_all_top_songs_this_month, get_all_top_artists_this_month
)
from playlists.models import Playlist
from django.utils import timezone
from datetime import timedelta
from django.db.models import Count, Q

def index_view(request):
    if request.user.is_authenticated:
        return redirect('home')
    else:
        return redirect('register')


class ListenerRegistrationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, label="Contraseña")
    password_confirm = forms.CharField(widget=forms.PasswordInput, label="Confirmar contraseña")
    avatar = forms.FileField(required=False, label="Foto de perfil")

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'nickname', 'email', 'password']
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Primer nombre'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Segundo nombre'}),
            'nickname': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre de usuario'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Correo electrónico'}),
        }

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_confirm = cleaned_data.get('password_confirm')

        if password and password_confirm and password != password_confirm:
            raise forms.ValidationError("Las contraseñas no coinciden.")

        # Validar email único
        email = cleaned_data.get('email')
        if email and User.objects.filter(email=email).exists():
            raise forms.ValidationError("Este correo electrónico ya está en uso.")

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = self.cleaned_data.get('email')  # Usar email como username
        user.set_password(self.cleaned_data.get('password'))
        if commit:
            user.save()
            # Crear perfil de oyente automáticamente con avatar
            avatar = self.cleaned_data.get('avatar')
            listener_profile = ListenerProfile.objects.create(user=user)
            if avatar:
                listener_profile.avatar = avatar
                listener_profile.save()
        return user


class ArtistRegistrationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, label="Contraseña")
    password_confirm = forms.CharField(widget=forms.PasswordInput, label="Confirmar contraseña")
    photo = forms.FileField(required=False, label="Foto de perfil")
    banner = forms.FileField(required=False, label="Banner de perfil")

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'nickname', 'email', 'password']
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Primer nombre'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Segundo nombre'}),
            'nickname': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre de usuario'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Correo electrónico'}),
        }

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_confirm = cleaned_data.get('password_confirm')

        if password and password_confirm and password != password_confirm:
            raise forms.ValidationError("Las contraseñas no coinciden.")

        # Validar email único
        email = cleaned_data.get('email')
        if email and User.objects.filter(email=email).exists():
            raise forms.ValidationError("Este correo electrónico ya está en uso.")

        return cleaned_data

    def save(self, commit=True):
        user = super().save(commit=False)
        user.username = self.cleaned_data.get('email')  # Usar email como username
        user.is_artist = True  # Marcar como artista
        user.set_password(self.cleaned_data.get('password'))
        if commit:
            user.save()
            # Crear perfil de artista automáticamente con photo y banner
            photo = self.cleaned_data.get('photo')
            banner = self.cleaned_data.get('banner')
            artist_profile = ArtistProfile.objects.filter(user=user).first()
            if not artist_profile:
                artist_profile = ArtistProfile.objects.create(user=user)
            if photo:
                artist_profile.photo = photo
            if banner:
                artist_profile.banner = banner
            artist_profile.save()
        return user


class HomeView(TemplateView):
    template_name = 'home.html'

    def get(self, request, *args, **kwargs):
        print("DEBUG: HomeView.get() llamado")
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        user = self.request.user

        # Artista destacado (el primero disponible o uno aleatorio)
        featured_artist = ArtistProfile.objects.order_by('?').first()
        context['featured_artist'] = featured_artist

        if user.is_authenticated:
            # Escuchadas recientemente: 10 aleatorias de las últimas 30 escuchadas
            recent_history = ListeningHistory.objects.filter(user=user).order_by('-played_at')[:30]
            if recent_history:
                recent_song_ids = [h.song_id for h in recent_history]
                recently_played = Song.objects.filter(id__in=recent_song_ids).order_by('?')[:10]
            else:
                recently_played = []  # Lista vacía cuando no hay historial
            context['recently_played'] = recently_played

            # Artistas que suelen estar contigo: 5 aleatorios de los más escuchados el último mes
            one_month_ago = timezone.now() - timedelta(days=30)
            monthly_history = ListeningHistory.objects.filter(user=user, played_at__gte=one_month_ago)
            if monthly_history:
                artist_counts = {}
                for h in monthly_history:
                    artist_id = h.song.artist_id
                    artist_counts[artist_id] = artist_counts.get(artist_id, 0) + 1
                top_artist_ids = sorted(artist_counts, key=artist_counts.get, reverse=True)[:10]  # top 10, then random 5
                companion_artists = ArtistProfile.objects.filter(id__in=top_artist_ids).order_by('?')[:5]
            else:
                companion_artists = []  # Lista vacía cuando no hay historial
            context['companion_artists'] = companion_artists

            # Recomendaciones para tus oídos: 
            # Si nunca ha escuchado → canciones aleatorias
            # Si ha escuchado algo → álbumes con tags de canciones escuchadas
            user_tags = UserTag.objects.filter(user=user, last_listened__gte=one_month_ago - timedelta(days=30))
            if user_tags:
                # Ha escuchado algo → usar sistema de tags
                tag_ids = [ut.tag_id for ut in user_tags]
                recommended_albums = Album.objects.filter(tags__id__in=tag_ids).distinct().order_by('?')[:5]
            else:
                # Nunca ha escuchado → mostrar álbumes aleatorios
                recommended_albums = Album.objects.all().order_by('?')[:5]
            context['recommended_albums'] = recommended_albums

            # Vuelve a los brazos de tu música: 5 canciones aleatorias de las últimas escuchadas ese mes
            if monthly_history:
                monthly_song_ids = list(set([h.song_id for h in monthly_history]))
                back_to_music = Song.objects.filter(id__in=monthly_song_ids).order_by('?')[:5]
            else:
                back_to_music = []  # Lista vacía cuando no hay historial
            context['back_to_music'] = back_to_music

            # Tus playlists: todas las playlists del usuario
            if user.is_artist:
                context['user_playlists'] = []
            else:
                user_playlists = Playlist.objects.filter(user=user).order_by('-created_at')[:10]
                context['user_playlists'] = user_playlists
        else:
            # Para usuarios no autenticados, mostrar datos por defecto
            context['recently_played'] = Song.objects.all().order_by('-plays')[:10]
            context['companion_artists'] = ArtistProfile.objects.all().order_by('?')[:5]
            context['recommended_albums'] = Album.objects.all().order_by('?')[:5]
            context['back_to_music'] = Song.objects.all().order_by('?')[:5]
            context['user_playlists'] = []

        # Canción actual (si hay alguna)
        current_track = Song.objects.order_by('?').first()
        context['current_track'] = current_track

        # Artista relacionado
        if current_track:
            context['related_artist'] = ArtistProfile.objects.exclude(pk=current_track.artist.pk).order_by('?').first()
        else:
            context['related_artist'] = None

        return context


class RegisterTypeView(TemplateView):
    template_name = 'accounts/register_type.html'


class ListenerRegisterView(CreateView):
    form_class = ListenerRegistrationForm
    template_name = 'accounts/register_listener.html'
    success_url = reverse_lazy('home')

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('home')
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        user = form.save()
        login(self.request, user)
        return super().form_valid(form)


class ArtistRegisterView(CreateView):
    form_class = ArtistRegistrationForm
    template_name = 'accounts/register_artist.html'
    success_url = reverse_lazy('home')

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('home')
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        user = form.save()
        login(self.request, user)
        return super().form_valid(form)


class RegisterView(CreateView):
    form_class = ListenerRegistrationForm
    template_name = 'accounts/register.html'
    success_url = reverse_lazy('home')

    def dispatch(self, request, *args, **kwargs):
        if request.user.is_authenticated:
            return redirect('home')
        return super().dispatch(request, *args, **kwargs)

    def form_valid(self, form):
        user = form.save()
        login(self.request, user)
        return super().form_valid(form)


@require_http_methods(["GET", "POST"])
def login_view(request):
    if request.user.is_authenticated:
        return redirect('home')

    if request.method == 'POST':
        email = request.POST.get('email')
        password = request.POST.get('password')

        user = authenticate(request, username=email, password=password)

        if user is not None:
            login(request, user)
            return redirect('home')
        else:
            messages.error(request, "Usuario o contraseña incorrectos.")

    return render(request, 'accounts/login.html')


@login_required(login_url='login')
def logout_view(request):
    logout(request)
    return redirect('register')


@login_required(login_url='login')
def edit_artist_profile(request):
    if not request.user.is_artist:
        return redirect('home')

    artist_profile = request.user.artist_profile

    if request.method == 'POST':
        form = ArtistProfileForm(request.POST, request.FILES, instance=artist_profile)
        if form.is_valid():
            form.save()
            return redirect('music:artist_detail_public', artist_id=artist_profile.pk)
    else:
        form = ArtistProfileForm(instance=artist_profile)

    return render(request, 'accounts/edit_artist_profile.html', {'form': form})


def not_found_view(request, exception=None):
    print("DEBUG: not_found_view called")
    return render(request, 'errors/404.html', status=404)


def forbidden_view(request, exception=None):
    return render(request, 'errors/403.html', status=403)


@login_required(login_url='login')
def listener_profile_view(request, user_id):
    """Vista del perfil del oyente"""
    profile_user = get_object_or_404(User, id=user_id, is_artist=False)
    listener_profile = profile_user.listener_profile

    # Verificar si es perfil propio
    is_own_profile = request.user.id == profile_user.id

    # Obtener canciones más escuchadas este mes
    top_songs = get_top_songs_this_month(profile_user, limit=5)

    # Obtener artistas más escuchados este mes
    top_artists = get_top_artists_this_month(profile_user, limit=5)

    # Obtener playlists públicas del usuario
    playlists = Playlist.objects.filter(user=profile_user, is_public=True).select_related('user')

    # Obtener artistas que sigue
    following = listener_profile.following.all().select_related('user')

    context = {
        'profile_user': profile_user,
        'top_songs': top_songs,
        'top_artists': top_artists,
        'playlists': playlists,
        'following': following,
        'is_own_profile': is_own_profile,
    }

    return render(request, 'accounts/user_profile.html', context)


@login_required(login_url='login')
def listener_profile_songs_view(request, user_id):
    """Vista con todas las canciones más escuchadas este mes"""
    profile_user = get_object_or_404(User, id=user_id, is_artist=False)

    # Obtener todas las canciones más escuchadas este mes
    top_songs = get_all_top_songs_this_month(profile_user)

    context = {
        'profile_user': profile_user,
        'top_songs': top_songs,
        'is_own_profile': request.user.id == profile_user.id,
    }

    return render(request, 'accounts/user_profile_songs.html', context)


@login_required(login_url='login')
def listener_profile_following_view(request, user_id):
    """Vista con todos los artistas que sigue"""
    profile_user = get_object_or_404(User, id=user_id, is_artist=False)
    listener_profile = profile_user.listener_profile

    # Obtener todos los artistas que sigue
    following = listener_profile.following.all().select_related('user')

    context = {
        'profile_user': profile_user,
        'following': following,
        'is_own_profile': request.user.id == profile_user.id,
    }

    return render(request, 'accounts/user_profile_following.html', context)


@login_required(login_url='login')
def edit_listener_profile(request):
    """Vista para editar el perfil del oyente"""
    if request.user.is_artist:
        return redirect('home')

    listener_profile = request.user.listener_profile

    if request.method == 'POST':
        form = ListenerProfileEditForm(request.POST, request.FILES, instance=listener_profile)
        if form.is_valid():
            form.save()
            return redirect('listener_profile', user_id=request.user.id)
    else:
        form = ListenerProfileEditForm(instance=listener_profile)

    context = {
        'form': form,
        'user': request.user,
    }

    return render(request, 'accounts/edit_listener_profile.html', context)
