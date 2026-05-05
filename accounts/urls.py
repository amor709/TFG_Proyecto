from django.urls import path
from . import views, api_views

urlpatterns = [
    path('', views.index_view, name='index'),
    path('home/', views.HomeView.as_view(), name='home'),
    path('register/', views.RegisterTypeView.as_view(), name='register'),
    path('register/listener/', views.ListenerRegisterView.as_view(), name='register_listener'),
    path('register/artist/', views.ArtistRegisterView.as_view(), name='register_artist'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('edit-artist-profile/', views.edit_artist_profile, name='edit_artist_profile'),

    # API endpoints para sincronización de reproducción
    path('api/playback/state/', api_views.save_playback_state, name='api_save_playback_state'),
    path('api/playback/get/', api_views.get_playback_state, name='api_get_playback_state'),
    path('api/playback/check-concurrent/', api_views.check_concurrent_session, name='api_check_concurrent'),
    path('api/playback/stop/', api_views.stop_playback_session, name='api_stop_playback_session'),
]
