from django.urls import path
from . import views

urlpatterns = [
    path('', views.index_view, name='index'),
    path('home/', views.HomeView.as_view(), name='home'),
    path('register/', views.RegisterTypeView.as_view(), name='register'),
    path('register/listener/', views.ListenerRegisterView.as_view(), name='register_listener'),
    path('register/artist/', views.ArtistRegisterView.as_view(), name='register_artist'),
    path('login/', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
]
