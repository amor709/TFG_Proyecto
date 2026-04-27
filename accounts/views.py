from django.shortcuts import render, redirect
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.views.generic import TemplateView, CreateView
from django.views.decorators.http import require_http_methods
from django.contrib import messages
from django.urls import reverse_lazy
from music.models import Song
from accounts.models import ArtistProfile, User, ListenerProfile
from django import forms


class CustomUserCreationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, label="Contraseña")
    password_confirm = forms.CharField(widget=forms.PasswordInput, label="Confirmar contraseña")
    avatar = forms.FileField(required=False, label="Foto de perfil")

    class Meta:
        model = User
        fields = ['first_name', 'last_name', 'nickname', 'email', 'password']
        widgets = {
            'first_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Primer nombre'}),
            'last_name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Segundo nombre'}),
            'nickname': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre de usuario (puede repe tirse)'}),
            'email': forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'Correo electrónico'}),
        }

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        password_confirm = cleaned_data.get('password_confirm')

        if password and password_confirm and password != password_confirm:
            raise forms.ValidationError("Las contraseñas no coinciden.")

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


class HomeView(TemplateView):
    template_name = 'home.html'

    def get(self, request, *args, **kwargs):
        print("DEBUG: HomeView.get() llamado")
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        print("DEBUG: HomeView.get_context_data() llamado")
        context = super().get_context_data(**kwargs)

        # Artista destacado (el primero disponible o uno aleatorio)
        featured_artist = ArtistProfile.objects.first()
        print(f"DEBUG: featured_artist = {featured_artist}")
        context['featured_artist'] = featured_artist

        # Canciones escuchadas recientemente (las más populares por ahora)
        recently_played = Song.objects.all().order_by('-plays')[:6]
        print(f"DEBUG: recently_played = {list(recently_played)}")
        context['recently_played'] = recently_played

        # Artistas relacionados (todos disponibles)
        companion_artists = ArtistProfile.objects.all()[:5]
        print(f"DEBUG: companion_artists = {list(companion_artists)}")
        context['companion_artists'] = companion_artists

        # Canción actual (si hay alguna)
        current_track = Song.objects.first()
        context['current_track'] = current_track

        # Artista relacionado
        if current_track:
            context['related_artist'] = ArtistProfile.objects.exclude(
                pk=current_track.artist.pk
            ).first()
        else:
            context['related_artist'] = None

        # Items de biblioteca del usuario
        if hasattr(self, 'request') and self.request.user.is_authenticated:
            # Aquí se cargaría la biblioteca real del usuario
            context['library_items'] = []
        else:
            context['library_items'] = []

        print(f"DEBUG: Context keys = {list(context.keys())}")
        return context


class RegisterView(CreateView):
    form_class = CustomUserCreationForm
    template_name = 'accounts/register.html'
    success_url = reverse_lazy('home')

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
            messages.success(request, f"¡Bienvenido {user.first_name or user.username}!")
            return redirect('home')
        else:
            messages.error(request, "Usuario o contraseña incorrectos.")

    return render(request, 'accounts/login.html')


@login_required(login_url='login')
def logout_view(request):
    logout(request)
    messages.success(request, "Has cerrado sesión exitosamente.")
    return redirect('home')

