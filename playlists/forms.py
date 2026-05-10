from django import forms
from .models import Playlist


class PlaylistForm(forms.ModelForm):
    class Meta:
        model = Playlist
        fields = ['name', 'description', 'cover', 'is_public']
        widgets = {
            'name': forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Nombre de la playlist'}),
            'description': forms.Textarea(attrs={'class': 'form-control', 'placeholder': 'Descripción (opcional)', 'rows': 3}),
            'cover': forms.FileInput(attrs={'class': 'form-control'}),
            'is_public': forms.CheckboxInput(attrs={'class': 'form-check-input'}),
        }
