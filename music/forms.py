from django import forms
from django.core.exceptions import ValidationError
from PIL import Image
from .models import Song, Album, Tag
import mimetypes


class ImageAspectRatioValidator:
    """Validador personalizado para verificar que la imagen sea cuadrada (1:1)."""

    def __call__(self, file):
        try:
            image = Image.open(file)
            width, height = image.size
            if width != height:
                raise ValidationError(
                    f"La portada debe tener una relación de aspecto 1:1 (cuadrada). "
                    f"Dimensiones actuales: {width}x{height}",
                    code='aspect_ratio_invalid'
                )
        except (ValueError, OSError) as e:
            raise ValidationError(
                "El archivo debe ser una imagen válida.",
                code='invalid_image'
            )


class AudioFileValidator:
    """Validador personalizado para verificar extensión de archivo de audio."""

    VALID_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/mp4']

    def __call__(self, file):
        file_type, _ = mimetypes.guess_type(file.name)
        if file_type not in self.VALID_FORMATS:
            raise ValidationError(
                f"Formato de audio no válido. Formatos permitidos: MP3, WAV, OGG, FLAC, MP4",
                code='invalid_audio_format'
            )


class SingleForm(forms.ModelForm):
    """Formulario para crear un Sencillo (Single)."""

    tags = forms.ModelMultipleChoiceField(
        queryset=Tag.objects.all(),
        widget=forms.CheckboxSelectMultiple,
        required=True,
        label="Géneros/Tags"
    )
    cover = forms.FileField(
        validators=[ImageAspectRatioValidator()],
        required=True,
        label="Portada (Imagen cuadrada 1:1)",
        help_text="La imagen debe ser cuadrada (mismo ancho y alto)"
    )
    audio_file = forms.FileField(
        validators=[AudioFileValidator()],
        required=True,
        label="Archivo de Audio (MP3, WAV, OGG, FLAC, MP4)",
        help_text="Tamaño máximo recomendado: 100MB"
    )

    class Meta:
        model = Song
        fields = ['title', 'tags', 'release_date', 'cover', 'audio_file', 'explicit']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Título del Sencillo',
                'required': True
            }),
            'release_date': forms.DateInput(attrs={
                'class': 'form-control',
                'type': 'date'
            }),
            'explicit': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            })
        }
        labels = {
            'title': 'Título del Sencillo',
            'release_date': 'Fecha de Lanzamiento',
            'explicit': 'Contenido Explícito'
        }


class AlbumPhaseAForm(forms.ModelForm):
    """Formulario para la Fase A de creación de Álbum (Configuración del Contenedor)."""

    cover = forms.FileField(
        validators=[ImageAspectRatioValidator()],
        required=True,
        label="Portada del Álbum (Imagen cuadrada 1:1)",
        help_text="La imagen debe ser cuadrada (mismo ancho y alto)"
    )

    class Meta:
        model = Album
        fields = ['title', 'description', 'release_date', 'cover']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Título del Álbum',
                'required': True
            }),
            'description': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'Descripción o Bio del Álbum',
                'rows': 5
            }),
            'release_date': forms.DateInput(attrs={
                'class': 'form-control',
                'type': 'date'
            })
        }
        labels = {
            'title': 'Título del Álbum',
            'description': 'Descripción/Bio',
            'release_date': 'Fecha de Lanzamiento'
        }


class AlbumPhaseBForm(forms.ModelForm):
    """Formulario para la Fase B de creación de Álbum (Gestión de Tracks)."""

    tags = forms.ModelMultipleChoiceField(
        queryset=Tag.objects.all(),
        widget=forms.CheckboxSelectMultiple,
        required=True,
        label="Géneros/Tags de esta Canción"
    )
    collaborators = forms.ModelMultipleChoiceField(
        queryset=None,  # Se establece en __init__
        widget=forms.CheckboxSelectMultiple,
        required=False,
        label="Artistas Colaboradores"
    )
    audio_file = forms.FileField(
        validators=[AudioFileValidator()],
        required=True,
        label="Archivo de Audio"
    )

    class Meta:
        model = Song
        fields = ['title', 'tags', 'collaborators', 'audio_file', 'explicit']
        widgets = {
            'title': forms.TextInput(attrs={
                'class': 'form-control',
                'placeholder': 'Título de la Canción',
                'required': True
            }),
            'explicit': forms.CheckboxInput(attrs={
                'class': 'form-check-input'
            })
        }
        labels = {
            'title': 'Título de la Canción',
            'explicit': 'Contenido Explícito'
        }

    def __init__(self, *args, artist=None, **kwargs):
        super().__init__(*args, **kwargs)
        # Configurar los colaboradores disponibles (otros artistas)
        if artist:
                self.fields['collaborators'].queryset = (
                __import__('accounts.models', fromlist=['ArtistProfile']).ArtistProfile.objects
                .exclude(pk=artist.pk)
            )
        else:
            self.fields['collaborators'].queryset = (
                __import__('accounts.models', fromlist=['ArtistProfile']).ArtistProfile.objects.all()
            )


