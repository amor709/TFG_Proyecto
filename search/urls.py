from django.urls import path
from . import views

app_name = 'search'

urlpatterns = [
    path('', views.search_view, name='search'),
    path('all/', views.search_all_view, name='all'),
]