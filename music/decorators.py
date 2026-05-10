from functools import wraps
from django.shortcuts import redirect
from django.contrib import messages


def artist_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.error(request, "Debes iniciar sesión para crear lanzamientos.")
            return redirect('login')

        if not request.user.is_artist:
            messages.error(request, "Debes ser un artista para crear lanzamientos.")
            return redirect('artist_verify')  # Puedes cambiar esto a la página de inicio o a un perfil

        return view_func(request, *args, **kwargs)

    return wrapper


def listener_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            messages.error(request, "Debes iniciar sesión para acceder a esta función.")
            return redirect('login')

        if not hasattr(request.user, 'listener_profile'):
            messages.error(request, "Debes ser un listener para acceder a esta función.")
            return redirect('home')  # O alguna página apropiada

        return view_func(request, *args, **kwargs)

    return wrapper
