from django.urls import path
from . import views, api_views, views_sidebar

urlpatterns = [
    path('', views.index_view, name='index'),
    path('home/', views.HomeView.as_view(), name='home'),
    path('register/', views.RegisterTypeView.as_view(), name='register'),
    path('register/listener/', views.ListenerRegisterView.as_view(), name='register_listener'),
    path('register/artist/', views.ArtistRegisterView.as_view(), name='register_artist'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('edit-artist-profile/', views.edit_artist_profile, name='edit_artist_profile'),

    # Sidebar endpoints
    path('sidebar/recent/', views_sidebar.get_recent_items, name='sidebar_recent'),
    path('sidebar/saved/', views_sidebar.get_saved_items, name='sidebar_saved'),
    path('sidebar/search/', views_sidebar.sidebar_search, name='sidebar_search'),
    path('sidebar/add-recent/<str:content_type>/<int:object_id>/', views_sidebar.add_to_recent, name='add_to_recent'),

    # API endpoints para sincronización de reproducción
    path('api/playback/state/', api_views.save_playback_state, name='api_save_playback_state'),
    path('api/playback/get/', api_views.get_playback_state, name='api_get_playback_state'),
    path('api/playback/check-concurrent/', api_views.check_concurrent_session, name='api_check_concurrent'),
    path('api/playback/stop/', api_views.stop_playback_session, name='api_stop_playback_session'),
    path('api/add-to-history/', api_views.add_to_listening_history, name='api_add_to_history'),

    # Perfil del oyente
    path('profile/<int:user_id>/', views.listener_profile_view, name='listener_profile'),
    path('profile/<int:user_id>/songs/', views.listener_profile_songs_view, name='listener_profile_songs'),
    path('profile/<int:user_id>/following/', views.listener_profile_following_view, name='listener_profile_following'),
    path('edit-profile/', views.edit_listener_profile, name='edit_listener_profile'),
]
