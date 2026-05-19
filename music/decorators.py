from functools import wraps
from django.shortcuts import redirect


def artist_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')

        if not request.user.is_artist:
            return redirect('artist_verify')

        return view_func(request, *args, **kwargs)

    return wrapper


def listener_required(view_func):
    @wraps(view_func)
    def wrapper(request, *args, **kwargs):
        if not request.user.is_authenticated:
            return redirect('login')

        if not hasattr(request.user, 'listener_profile'):
            return redirect('home')

        return view_func(request, *args, **kwargs)

    return wrapper
