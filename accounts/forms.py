from django import forms
from django.core.exceptions import ValidationError
from PIL import Image
from accounts.models import ArtistProfile


class BannerAspectRatioValidator:
    """Validador personalizado para verificar que el banner sea 11:3."""

    def __call__(self, file):
        try:
            image = Image.open(file)
            width, height = image.size
            aspect_ratio = width / height
            target_ratio = 11 / 3
            tolerance = 0.1  # 10% de tolerancia
            if not (target_ratio * (1 - tolerance) <= aspect_ratio <= target_ratio * (1 + tolerance)):
                raise ValidationError(
                    f"El banner debe tener una relación de aspecto 11:3. "
                    f"Dimensiones actuales: {width}x{height} (ratio: {aspect_ratio:.2f}). "
                    f"Ratio esperado: {target_ratio:.2f}",
                    code='aspect_ratio_invalid'
                )
        except (ValueError, OSError) as e:
            raise ValidationError(
                "El archivo debe ser una imagen válida.",
                code='invalid_image'
            )


class ArtistProfileForm(forms.ModelForm):
    banner = forms.FileField(
        required=False,
        label="Banner de perfil",
        validators=[BannerAspectRatioValidator()],
        help_text="La imagen debe tener una relación de aspecto 11:3 (ej: 1100x300 píxeles)"
    )

    class Meta:
        model = ArtistProfile
        fields = ['bio', 'photo', 'banner', 'website']
        widgets = {
            'bio': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'Cuéntanos sobre ti...',
                'rows': 4
            }),
            'photo': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'image/*'
            }),
            'banner': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'image/*'
            }),
            'website': forms.URLInput(attrs={
                'class': 'form-control',
                'placeholder': 'https://tu-sitio-web.com'
            })
        }
        labels = {
            'bio': 'Biografía',
            'photo': 'Foto de perfil',
            'banner': 'Banner de perfil',
            'website': 'Sitio web'
        }


class ArtistRegistrationForm(forms.ModelForm):
    password = forms.CharField(widget=forms.PasswordInput, label="Contraseña")
    password_confirm = forms.CharField(widget=forms.PasswordInput, label="Confirmar contraseña")
    photo = forms.FileField(required=False, label="Foto de perfil")
    banner = forms.FileField(
        required=False,
        label="Banner de perfil",
        validators=[BannerAspectRatioValidator()],
        help_text="La imagen debe tener una relación de aspecto 11:3 (ej: 1100x300 píxeles)"
    )

    class Meta:
        model = ArtistProfile
        fields = ['bio', 'photo', 'banner', 'website', 'password', 'password_confirm']
        widgets = {
            'bio': forms.Textarea(attrs={
                'class': 'form-control',
                'placeholder': 'Cuéntanos sobre ti...',
                'rows': 4
            }),
            'photo': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'image/*'
            }),
            'banner': forms.FileInput(attrs={
                'class': 'form-control',
                'accept': 'image/*'
            }),
            'website': forms.URLInput(attrs={
                'class': 'form-control',
                'placeholder': 'https://tu-sitio-web.com'
            }),
            'password': forms.PasswordInput(attrs={
                'class': 'form-control',
                'placeholder': 'Elige una contraseña segura'
            }),
            'password_confirm': forms.PasswordInput(attrs={
                'class': 'form-control',
                'placeholder': 'Confirma tu contraseña'
            })
        }
        labels = {
            'bio': 'Biografía',
            'photo': 'Foto de perfil',
            'banner': 'Banner de perfil',
            'website': 'Sitio web',
            'password': 'Contraseña',
            'password_confirm': 'Confirmar contraseña'
        }
