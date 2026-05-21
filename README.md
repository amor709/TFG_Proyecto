# SoundMusik: Documentación

SoundMusik es una aplicación web de streaming musical desarrollada con Django. Ofrece dos tipos de cuenta: **oyentes**, que escuchan música, crean playlists, guardan favoritos ("Mis joyas") y siguen a sus artistas; y **artistas**, que publican singles y álbumes y disponen de un perfil público con estadísticas. Incluye un reproductor persistente con cola dinámica, buscador, recomendaciones por géneros, historial de escucha y estadísticas mensuales. La aplicación está dockerizada (Django + PostgreSQL + Caddy) y se sirve con HTTPS automático.

## Instalación

**No usar ninguna de las credenciales de ejemplo en producción.**

### Paso 1 - Revisar la instalación de Docker en tu sistema
```
docker --version
docker compose version
```

### Paso 2 - Crear un archivo `.env` con las variables de entorno

En la raíz del proyecto (junto a `docker-compose.yml`). Valores de ejemplo para desarrollo local:

```
# --- Django ---
SECRET_KEY=pon-aqui-una-clave-larga-y-aleatoria
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CSRF_TRUSTED_ORIGINS=http://localhost:8000,http://127.0.0.1:8000
SECURE_SSL=False

# --- Base de datos (PostgreSQL) ---
DB_ENGINE=django.db.backends.postgresql
DB_NAME=soundmusik
DB_USER=soundmusik
DB_PASSWORD=1234
DB_HOST=db
DB_PORT=5432

# --- Caddy / HTTPS ---
DOMAIN=:80
```

> **Producción:** poner `DEBUG=False`, `SECURE_SSL=True`, el dominio real en `ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS` y `DOMAIN`, y una `DB_PASSWORD` segura. Con un dominio real, Caddy obtiene y renueva el certificado HTTPS (Let's Encrypt) automáticamente.

### Paso 3 - Construir y levantar los contenedores
```
docker compose up --build -d
```

Se levantan tres servicios: **db** (PostgreSQL), **web** (Django con Gunicorn) y **caddy** (proxy inverso + HTTPS, sirve `/media` directamente). El `entrypoint.sh` espera a la base de datos y ejecuta automáticamente `migrate` y `collectstatic` en cada arranque.

### Paso 4 - Acceder a la aplicación
```
http://localhost:8000
```

(En producción, mediante el dominio configurado en `DOMAIN`, por HTTPS.)

Para crear un superusuario y acceder al panel de administración:
```
docker compose exec web python manage.py createsuperuser
```

## Documentación del código

El proyecto se organiza en cuatro aplicaciones Django (`accounts`, `music`, `playlists`, `search`) más el paquete de configuración `config`. Usa un modelo de usuario personalizado (`accounts.User`) y autenticación por email.

### Aplicación `accounts`

#### Modelos `models.py`

**`User`** — Modelo de usuario personalizado que extiende `AbstractUser`. Reemplaza el validador de `username` por uno que permite espacios (regex `[\w\s.@+-]+`). Campos adicionales: `email` (único), `is_artist` (bool), `is_premium` (bool), `language` (str, defecto `'es'`), `birth_date` (date, opcional).

**`ArtistProfile`** — Perfil público de un artista. Relación `OneToOneField` con `User` (`on_delete=CASCADE`, `related_name='artist_profile'`). Campos: `bio` (texto, max 500), `photo` y `banner` (ambos `FileField`, `upload_to='profiles/'`), `total_plays` (entero positivo, defecto 0), `slug` (único, nullable). Propiedades:
- `name` — devuelve `user.username`.
- `photo_url` — URL del `photo` o fallback a `img/pfp_default.jpg`.
- `banner_url` — URL del `banner` o fallback a `img/banner_default.png`.
- `primary_genre` — género más frecuente entre los tags de las canciones del artista (consulta de agregación sobre `self.songs`).
- `followers_count` — `self.followers.count()`.

**`ListenerProfile`** — Perfil del oyente. Relación `OneToOneField` con `User` (`on_delete=CASCADE`, `related_name='listener_profile'`). Campos: `avatar` (`FileField`, `upload_to='profiles/'`), `following` (`ManyToManyField` → `ArtistProfile`, `related_name='followers'`), `saved_albums` (`ManyToManyField` → `music.Album`, `related_name='saved_by_users'`). Propiedades: `avatar_url` (URL o fallback), `playlist_count` (playlists públicas del usuario), `following_count` (número de artistas seguidos).

**`ListeningHistory`** — Registro de escuchas. `ForeignKey` a `User` (`CASCADE`, `related_name='listening_history'`), `ForeignKey` a `music.Song` (`CASCADE`). Campo `played_at` (`auto_now_add`). Ordenado por `-played_at`.

**`UserTag`** — Preferencia de género musical del usuario, usada para recomendaciones. `ForeignKey` a `User` (`CASCADE`, `related_name='user_tags'`), `ForeignKey` a `music.Tag` (`CASCADE`). Campos: `last_listened` (`auto_now`), `listen_count` (entero positivo). `unique_together = ('user', 'tag')`. Caducidad gestionada externamente (eliminación de registros con más de 30 días).

**`PlaybackSession`** — Estado de reproducción activo del usuario. `ForeignKey` a `User` (`CASCADE`, `related_name='playback_sessions'`). Campos: `session_id` (str, generado por el cliente), `track_id` (int, nullable), `track_title`, `track_artist`, `cover_url` (URL, nullable), `current_time` (float), `is_playing` (bool), `device_info`, `user_agent`, `created_at`, `updated_at`, `last_activity`. Constraint: `UniqueConstraint(fields=['user', 'session_id'], name='unique_user_session_id')` — unicidad por usuario (no global). Propiedad `is_active`: devuelve `True` si `last_activity` fue hace menos de 30 minutos. Método `mark_active()`: actualiza `last_activity` con `update_fields`.

**`RecentItem`** — Elemento visitado recientemente (relación genérica). `ForeignKey` a `User` (`CASCADE`, `related_name='recent_items'`), `ForeignKey` a `ContentType` (`CASCADE`), `object_id` (entero positivo), `content_object` (`GenericForeignKey`). `timestamp` (defecto `timezone.now`). `unique_together = ('user', 'content_type', 'object_id')`. Ordenado por `-timestamp`. Se mantienen los últimos 20 por usuario.

**`ArtistPlayCount`** — Contador permanente de reproducciones de un artista por usuario. `ForeignKey` a `User` (`CASCADE`, `related_name='artist_play_counts'`), `ForeignKey` a `ArtistProfile` (`CASCADE`, `related_name='play_counts'`). Campos: `play_count`, `last_played` (`auto_now`). `unique_together = ('user', 'artist')`.

**`SongPlayCount`** — Contador permanente de reproducciones de una canción por usuario. `ForeignKey` a `User` (`CASCADE`, `related_name='song_play_counts'`), `ForeignKey` a `music.Song` (`CASCADE`, `related_name='play_counts'`). Campos: `play_count`, `last_played` (`auto_now`). `unique_together = ('user', 'song')`.

**`MonthlyArtistStats`** — Estadísticas mensuales de reproducciones por usuario y artista. `ForeignKey` a `User` y a `ArtistProfile`. `month` (str, formato `YYYY-MM`), `play_count`, `last_updated` (`auto_now`). `unique_together = ('user', 'artist', 'month')`. Ordenado por `-last_updated`.

**`MonthlySongStats`** — Estadísticas mensuales de reproducciones por usuario y canción. `ForeignKey` a `User` y a `music.Song`. Misma estructura que `MonthlyArtistStats`. `unique_together = ('user', 'song', 'month')`.

#### Panel de administración `admin.py`

Todos los modelos están registrados con clases `ModelAdmin` personalizadas:

- **`CustomUserAdmin`** (hereda `UserAdmin`): `list_display` = username, email, is_artist, is_premium, is_staff, is_active; `search_fields` = username, email, first_name, last_name; `list_filter` = is_artist, is_premium, is_staff, is_active, date_joined; `ordering` = -date_joined. Añade `fieldsets` extra con `is_artist`, `is_premium`, `language`, `birth_date`.
- **`ArtistProfileAdmin`**: `list_display` = id, user, total_plays; `search_fields` = user__username, user__email, bio; `ordering` = -total_plays; `readonly_fields` = total_plays, id.
- **`ListenerProfileAdmin`**: `list_display` = id, user; `search_fields` = user__username, user__email; `ordering` = user__username; `readonly_fields` = id.
- **`PlaybackSessionAdmin`**: `list_display` = id, user, session_id, track_title, is_playing, is_active, last_activity; `list_filter` = is_playing, created_at, updated_at; `readonly_fields` = created_at, updated_at, session_id, id.
- **`ArtistPlayCountAdmin`** y **`SongPlayCountAdmin`**: listado con play_count y last_played; `ordering` = -play_count, -last_played.
- **`MonthlyArtistStatsAdmin`** y **`MonthlySongStatsAdmin`**: listado con month, play_count, last_updated; `list_filter` = month, play_count, last_updated.

#### Formularios `forms.py`

**`BannerAspectRatioValidator`** — Validador callable. Abre la imagen con Pillow y comprueba que la relación de aspecto sea 11:3 (tolerancia del 10%). Lanza `ValidationError` si el ratio no es válido o el archivo no es una imagen.

**`ArtistProfileForm`** — `ModelForm` sobre `ArtistProfile`. Campos: `bio`, `photo`, `banner`. El campo `banner` incluye `BannerAspectRatioValidator`. Widgets: `Textarea` para bio, `FileInput` para photo y banner.

**`ListenerProfileForm`** — `ModelForm` sobre `ListenerProfile`. Campo único: `avatar` (`FileInput`, `accept="image/*"`).

**`UserEditForm`** — `ModelForm` sobre `User`. Campos: `first_name`, `last_name`, `username`, `email`. Validación `clean_email()`: comprueba unicidad de email excluyendo la instancia actual.

Los formularios de registro (`ListenerRegistrationForm` y `ArtistRegistrationForm`) están definidos en `views.py`: son `ModelForm` sobre `User` con campos `first_name`, `last_name`, `username`, `email`, `password`, más `password_confirm` y el campo de imagen correspondiente. Ambos implementan `clean()` (contraseñas coincidentes), `clean_email()` (unicidad) y `save()` con `transaction.atomic()` que crea el perfil asociado. `ArtistRegistrationForm.save()` además fija `user.is_artist = True`.

#### Vistas `views.py`

`def index_view(request)` | <small>`/`</small>

**Función:** Redirige al usuario autenticado a `home` y al anónimo a `register`.

**Devuelve:** `redirect('home')` o `redirect('register')`.

`class RegisterTypeView` | <small>`/register/`</small>

**Función:** Muestra la pantalla de selección de tipo de cuenta (oyente o artista).

**Devuelve:** `accounts/register_type.html`.

`class ListenerRegisterView(CreateView)` | <small>`/register/listener/`</small>

**Función:** Registro de oyente. `dispatch` redirige a `home` si ya está autenticado. `form_class = ListenerRegistrationForm`. `form_valid` guarda, añade mensaje de éxito y redirige al login (sin auto-login).

**Devuelve:** `accounts/register_listener.html` (GET) o `redirect('login')` (POST válido).

`class ArtistRegisterView(CreateView)` | <small>`/register/artist/`</small>

**Función:** Registro de artista. Lógica equivalente usando `ArtistRegistrationForm`.

**Devuelve:** `accounts/register_artist.html` (GET) o `redirect('login')` (POST válido).

`def login_view(request)` | <small>`/login/`</small>

**Función:** Autenticación mediante email y contraseña. Redirige a `home` si ya está autenticado. En POST llama a `authenticate(request, username=email, password=password)` (el `EmailBackend` resuelve el email).

**Devuelve:** `accounts/login.html` (GET o credenciales incorrectas) o `redirect('home')` (éxito).

`def logout_view(request)` | <small>`/logout/`</small>

**Función:** Cierra la sesión del usuario.

**Devuelve:** `redirect('register')`.

`def edit_artist_profile(request)` | <small>`/edit-artist-profile/`</small>

**Función:** Edición del perfil de artista (`login_required`). Redirige a `home` si no es artista. En POST valida y guarda `ArtistProfileForm` + `UserEditForm`.

**Devuelve:** `accounts/edit_artist_profile.html` o `redirect('music:artist_detail_public', ...)`.

`def edit_listener_profile(request)` | <small>`/edit-profile/`</small>

**Función:** Edición del perfil de oyente (`login_required`). Redirige a `home` si es artista. En POST valida y guarda `ListenerProfileForm` + `UserEditForm`.

**Devuelve:** `accounts/edit_listener_profile.html` o `redirect('listener_profile', ...)`.

`def listener_profile_view(request, user_id)` | <small>`/profile/<int:user_id>/`</small>

**Función:** Perfil público del oyente. Recupera top 5 canciones y artistas del mes (vía `stats_utils`), playlists públicas y artistas seguidos. Determina `is_own_profile`.

**Devuelve:** `accounts/user_profile.html`.

`def listener_profile_songs_view(request, user_id)` | <small>`/profile/<int:user_id>/songs/`</small>

**Función:** Lista completa de canciones más escuchadas en el mes por el oyente.

**Devuelve:** `accounts/user_profile_songs.html`.

`def listener_profile_following_view(request, user_id)` | <small>`/profile/<int:user_id>/following/`</small>

**Función:** Lista completa de artistas que sigue el oyente.

**Devuelve:** `accounts/user_profile_following.html`.

`def not_found_view(request, exception=None)` y `def forbidden_view(request, exception=None)` — Vistas de error 404 y 403, asignadas como `handler404` y `handler403` a nivel de proyecto.

#### Vistas `api_views.py`

`def save_playback_state(request)` | <small>`/api/playback/state/`</small>

**Función:** `POST`. Guarda/actualiza el estado de reproducción del usuario. Mantiene una sola `PlaybackSession` por usuario (reutiliza o crea, elimina duplicados).

**Devuelve:** `JsonResponse` con `status`, `session_id` e `is_active`.

`def get_playback_state(request)` | <small>`/api/playback/get/`</small>

**Función:** `GET`. Recupera el estado de reproducción activo (sesión más reciente).

**Devuelve:** `JsonResponse` con `session` (dict) o `{'session': None}`.

`def add_to_listening_history(request)` | <small>`/api/add-to-history/`</small>

**Función:** `POST`. Añade/actualiza una entrada en `ListeningHistory` y llama a `record_play()` para actualizar contadores. Mantiene máximo 100 entradas por usuario.

**Devuelve:** `JsonResponse` con `status` y `created`.

`def toggle_follow_artist(request, artist_id)` | <small>`/api/follow-artist/<int:artist_id>/`</small>

**Función:** `POST`. Alterna el seguimiento de un artista por el oyente.

**Devuelve:** `JsonResponse` con `status`, `action` e `is_following`.

`def check_following_artist(request, artist_id)` | <small>`/api/check-following/<int:artist_id>/`</small>

**Función:** `GET`. Comprueba si el usuario sigue al artista.

**Devuelve:** `JsonResponse` con `is_following`.

`def get_following_artists(request)` | <small>`/api/following-artists/`</small>

**Función:** `GET`. Devuelve los artistas que sigue el usuario (param `limit`, defecto 5).

**Devuelve:** `JsonResponse` con `artists` y `total_count`.

#### Vistas `views_sidebar.py`

`def get_recent_items(request)` | <small>`/sidebar/recent/`</small>

**Función:** `GET`. Últimos 20 `RecentItem` del usuario; filtra huérfanos, perfiles y "Mis joyas".

**Devuelve:** `JsonResponse({'items': [...]})`.

`def get_saved_items(request)` | <small>`/sidebar/saved/`</small>

**Función:** `GET`. Álbumes guardados, artistas seguidos y playlists guardadas, en orden alfabético.

**Devuelve:** `JsonResponse({'items': [...]})`.

`def sidebar_search(request)` | <small>`/sidebar/search/`</small>

**Función:** `GET`. Búsqueda en tiempo real dentro de la sección (`recent` o `saved`); mínimo 2 caracteres, límite 15.

**Devuelve:** `JsonResponse({'items': [...]})`.

`def add_to_recent(request, content_type, object_id)` | <small>`/sidebar/add-recent/<str:content_type>/<int:object_id>/`</small>

**Función:** `POST`. Crea/actualiza un `RecentItem` genérico; mantiene máximo 20 por usuario.

**Devuelve:** `JsonResponse({'success': True})`.

#### Autenticación y otros

**`backends.py` — `EmailBackend`**: extiende `ModelBackend` y permite login por email (`email__iexact`). Ejecuta un `set_password` dummy para mitigar timing attacks y devuelve `None` si hay emails duplicados. Se activa vía `AUTHENTICATION_BACKENDS`.

**`context_processors.py`**: `liked_songs_context` inyecta `liked_song_ids` (IDs en "Mis joyas"); `player_context` inyecta `songs`, `current_track` (desde `PlaybackSession`), `related_artist`, `library_items` y `liked_playlist_obj` en todas las plantillas.

**`signals.py`**: `artist_pre_delete` limpia estadísticas al borrar un artista; `create_liked_playlist` crea automáticamente la playlist "Mis joyas" al crear un `ListenerProfile`.

**`stats_utils.py`**: módulo auxiliar con `record_play()` (núcleo de estadísticas: actualiza contadores por usuario, mensuales, `Song.plays`, `ArtistProfile.total_plays` con `F()`, y `UserTag`), `get_top_songs_this_month` / `get_top_artists_this_month` (+ variantes `get_all_*`), `cleanup_old_monthly_stats()` y `handle_artist_deletion()`.

**`management/commands/cleanup_old_stats.py`** — comando `cleanup_old_stats` que purga estadísticas mensuales obsoletas (`--days`, `--user-id`).

### Aplicación `music`

#### Modelos `models.py`

**`Tag`** — Género musical. Campo `name` (`unique=True`) con choices fijos de la constante `GENEROS_MUSICALES` (32 géneros, incluido "Nulo"). Usado como ManyToMany desde `Album` y `Song`.

**`Album`** — Contenedor de canciones publicado por un artista.
- `title` — CharField(200).
- `artist` — `ForeignKey` → `accounts.ArtistProfile`, `on_delete=CASCADE`, `related_name='albums'`.
- `cover` — FileField(`upload_to='covers/'`), nullable.
- `release_date` — DateField.
- `description` — TextField, opcional.
- `tags` — ManyToManyField → `Tag`, `related_name='albums'`.
- `is_draft` (defecto `True`) / `completed` (defecto `False`) — control de publicación.
- `is_explicit` — BooleanField.

Métodos: `mark_completed()` (publica el álbum), `get_type_display()` (`"Álbum"`), `@property track_count`, `@property total_duration_display` (formato `Xh Ym`).

**`Song`** — Canción individual; puede pertenecer a un álbum o ser single.
- `title` — CharField(200).
- `artist` — `ForeignKey` → `accounts.ArtistProfile`, `CASCADE`, `related_name='songs'`.
- `album` — `ForeignKey` → `Album`, `SET_NULL`, nullable, `related_name='songs'`. Si es `None`, es un single.
- `tags` — ManyToManyField → `Tag`, `related_name='songs'`, **requerido**.
- `duration` — DurationField.
- `audio_file` — FileField(`upload_to='audio/'`), nullable.
- `cover` — FileField(`upload_to='covers/'`), nullable.
- `plays` — PositiveIntegerField, defecto 0.
- `release_date` — DateField.
- `collaborators` — ManyToManyField → `accounts.ArtistProfile`, `related_name='collaborations'`, opcional.
- `is_explicit` — BooleanField.

Propiedades: `get_type_display()` (`"Canción"`/`"Single"`), `@property duration_display` (`mm:ss`), `@property featured_artists` (alias de colaboradores), `@property featured_context` (`"feat. ..."`), `@property authors_display` (artista principal + colaboradores; usado en el reproductor y la API).

#### Panel de administración `admin.py`

- **`TagAdmin`**: `list_display` = id, name; `search_fields` = name; `ordering` = name.
- **`AlbumAdmin`**: formulario `AlbumForm` (valida ≥1 tag). Columnas: id, title, artist, release_date, nº de canciones. Filtros por fecha y artista; búsqueda por título/artista/descripción. Inline `SongInline` (`extra=0`, `plays` readonly). `filter_horizontal` para `tags`.
- **`SongAdmin`**: formulario `SongForm` (valida ≥1 tag). Columnas: id, title, artist, album, duration, plays, release_date. `plays` e `id` readonly. `filter_horizontal` para `tags`.

#### Formularios `forms.py`

**`ImageAspectRatioValidator`** — Valida con Pillow que la imagen sea cuadrada (1:1). **`AudioFileValidator`** — Valida el MIME del audio (`mpeg/wav/ogg/flac/mp4`).

**`SingleForm`** — modelo `Song`; campos `title`, `tags` (checkbox, requerido), `collaborators` (checkbox, opcional, excluye al propio artista), `release_date`, `cover` (1:1, requerido), `audio_file` (validado, requerido).

**`AlbumPhaseAForm`** — modelo `Album`; campos `title`, `description`, `release_date`, `cover` (1:1, requerido). Fase A (contenedor del álbum).

**`AlbumEditForm`** — igual que `AlbumPhaseAForm` pero `cover` opcional; widget de fecha con formato precargable.

**`AlbumPhaseBForm`** — modelo `Song`; campos `title`, `tags`, `collaborators`, `audio_file`. Sin `cover` (hereda la del álbum). Recibe `artist` para filtrar colaboradores.

#### Vistas `views.py`

`def get_track_data(request, track_id)` | <small>`api/track/<int:track_id>/`</small>

**Función:** Devuelve en JSON los datos de una canción (título, `authors_display`, ids de artista/álbum, lista de artistas, portada, audio y `related_artist`). Solo GET.

**Devuelve:** `JsonResponse` con los datos o `{}` (404).

`def create_single(request)` | <small>`create/single/`</small>

**Función:** Crea un single. Valida `SingleForm`, asigna el artista, fuerza `album=None`, extrae la duración real con Mutagen.

**Devuelve:** `music/create_single.html` o `redirect('music:artist_detail')`. `@artist_required`.

`def album_phase_a(request)` | <small>`create/album/phase-a/`</small>

**Función:** Fase A de creación de álbum: crea el álbum (`is_draft=True`) y le asigna el tag "Nulo" como placeholder.

**Devuelve:** `music/album_phase_a.html` o `redirect('music:album_phase_b', ...)`. `@artist_required`.

`def album_phase_b(request, album_id)` | <small>`create/album/<int:album_id>/phase-b/`</small>

**Función:** Fase B: añade canciones al álbum (hereda portada/fecha, extrae duración, recalcula tags con `update_album_tags()`). Permite añadir varias.

**Devuelve:** `music/album_phase_b.html` con álbum, formulario y canciones añadidas. `@artist_required`.

`def publish_album(request, album_id)` | <small>`album/<int:album_id>/publish/`</small>

**Función:** Publica un álbum en borrador (exige ≥1 canción; si no, mensaje de error y vuelta a fase B).

**Devuelve:** `redirect('music:album_detail')` en éxito. `@artist_required`.

`def song_list(request)` | <small>`/music/`</small>

**Función:** Lista todas las canciones por fecha de lanzamiento descendente.

**Devuelve:** `music/song_list.html`.

`def delete_song(request, song_id)` | <small>`song/<int:song_id>/delete/`</small>

**Función:** Elimina una canción del álbum (solo POST, propietario). Recalcula tags del álbum. Las singles no se borran por esta vía.

**Devuelve:** `JsonResponse({'success': ...})`. `@artist_required`.

`def artist_detail(request, artist_id=None)` | <small>`artist/` y `artist/<int:artist_id>/`</small>

**Función:** Perfil de artista (propio o público). Construye top 6 canciones por plays, lanzamientos (álbumes + singles), álbumes, singles, colaboraciones, `is_followed` e `is_own_profile`.

**Devuelve:** `music/artist_detail.html`.

`def artist_albums(request, artist_id)` | <small>`artist/<int:artist_id>/albums/`</small> y `def artist_singles(request, artist_id)` | <small>`artist/<int:artist_id>/singles/`</small>

**Función:** Listados completos de álbumes / singles de un artista ("Ver más").

**Devuelve:** `music/artist_albums.html` / `music/artist_singles.html`.

`def album_detail(request, album_id)` | <small>`album/<int:album_id>/`</small>

**Función:** Detalle de álbum con tracklist, 5 recomendaciones aleatorias del mismo artista e `is_owner`.

**Devuelve:** `music/album_detail.html`.

`def edit_album(request, album_id)` | <small>`album/<int:album_id>/edit/`</small>

**Función:** Edita los metadatos de un álbum propio (`AlbumEditForm`).

**Devuelve:** `music/edit_album.html` o `redirect('music:album_detail')`. `@artist_required`.

`def delete_album(request, album_id)` | <small>`album/<int:album_id>/delete/`</small>

**Función:** Elimina un álbum propio (solo POST). Como `Song.album` usa `SET_NULL`, borra primero sus canciones explícitamente.

**Devuelve:** `redirect('music:artist_detail')`. `@artist_required`.

#### Vistas `api_views.py`

Todas con `@csrf_exempt` y `@require_http_methods(["GET"])`.

`def queue_html(request)` | <small>`api/queue-html/`</small> — Genera el HTML de los elementos de la cola a partir de `?ids=1,2,3` (manteniendo el orden).

`def album_tracks(request, album_id, track_id)` | <small>`api/album-tracks/<int:album_id>/<int:track_id>/`</small> — Devuelve los ids de las canciones restantes del álbum desde la posición indicada (encolar el resto del álbum).

`def suggested_tracks(request, track_id)` | <small>`api/suggested-tracks/<int:track_id>/`</small> — Sugerencias para una canción con fallback en cascada (Mis Joyas con tags comunes → tags comunes → aleatorio → cualquiera); excluye `?exclude=`.

`def album_suggested_tracks(request, album_id)` | <small>`api/album-suggested-tracks/<int:album_id>/`</small> — Igual a nivel de álbum, usando sus tags.

`def artist_tracks(request, artist_id)` | <small>`api/artist-tracks/<int:artist_id>/`</small> — Todos los ids de canciones de un artista (reproducción aleatoria del perfil).

#### Decoradores y helpers

- **`artist_required`** (`decorators.py`): redirige a `login` si no autenticado y a `artist_verify` si no es artista. Usado en las vistas de creación/edición/borrado.
- **`listener_required`** (`decorators.py`): exige `listener_profile`; disponible para otras apps.
- **`get_audio_duration(audio_file)`** (`views.py`): extrae la duración real con Mutagen (MP3/WAV/OGG/FLAC/M4A); devuelve `timedelta`.
- **`update_album_tags(album)`** (`views.py`): recalcula los tags del álbum como unión de los de sus canciones (mantiene "Nulo" si quedara vacío).

### Aplicación `playlists`

#### Modelos `models.py`

**`Playlist`** — Lista de reproducción del usuario; soporta playlists normales y la especial "Mis joyas".
- `user` — `ForeignKey` a `accounts.User`, `CASCADE`, `related_name='playlists'`.
- `name`, `description`, `created_at` (`auto_now_add`), `is_public` (defecto `False`).
- `songs` — `ManyToManyField` a `music.Song` a través de `PlaylistSong`, `related_name='playlists'`.
- `cover` — `FileField(upload_to='covers/')`.
- `saved_by` — `ManyToManyField` a `accounts.User`, `related_name='saved_playlists'`.
- `is_liked_playlist` (defecto `False`) — marca "Mis joyas".
- `order_by_field` — choices `[('added','Añadida'), ('name','Nombre')]`, criterio de orden de "Mis joyas".
- `liked_playlist_cover` — `ImageField` exclusivo de "Mis joyas".

Propiedades: `owner` (alias de `user`), `track_count`, `save_count`, `get_cover`, `cover_url` (prioridad `liked_playlist_cover` > `cover` > estático por defecto).

**`PlaylistSong`** — Tabla intermedia entre `Playlist` y `music.Song`.
- `playlist` / `song` — `ForeignKey` (`CASCADE`).
- `order` — `PositiveIntegerField`. Posición.
- `Meta`: `ordering = ['order']`, `unique_together = ('playlist', 'order')` (no hay dos canciones en la misma posición de una playlist).

#### Panel de administración `admin.py`

- **`PlaylistAdmin`**: `list_display` = id, name, user, is_public, created_at, nº de canciones; `list_filter` = is_public, created_at, user; `search_fields` = name, description, user__username; `ordering` = -created_at; inline `PlaylistSongInline`.
- **`PlaylistSongAdmin`**: `list_display` = id, playlist, song, order; `list_filter` = playlist__user, playlist; `search_fields` = playlist__name, song__title.

#### Formularios `forms.py`

**`PlaylistForm`** — `ModelForm` sobre `Playlist`; campos `name`, `description`, `cover`, `is_public`. No expone `is_liked_playlist` ni `order_by_field` (la edición de "Mis joyas" se bloquea en la vista).

#### Vistas `views.py`

`def playlist_detail(request, pk)` | <small>`playlists/<int:pk>/`</small>

**Función:** Detalle de una playlist. Si es "Mis joyas" o privada y no es el propietario, redirige a `home`. Ordena según `order_by_field` (Mis joyas) o `playlistsong__order` (normales). Incluye `is_saved`.

**Devuelve:** `playlists/playlist_detail.html` o `redirect('home')`.

`def create_playlist(request)` | <small>`playlists/create/`</small>

**Función:** Crea una playlist; asigna `user` y la añade a `saved_playlists`.

**Devuelve:** `redirect('playlists:detail')` o `playlists/create_playlist.html`.

`def edit_playlist(request, pk)` | <small>`playlists/<int:pk>/edit/`</small>

**Función:** Edita una playlist propia. Si es "Mis joyas", redirige al detalle sin permitir edición.

**Devuelve:** `redirect('playlists:detail')` o `playlists/edit_playlist.html`.

`def delete_playlist(request, pk)` | <small>`playlists/<int:pk>/delete/`</small>

**Función:** Borra una playlist propia (solo POST). No permite borrar "Mis joyas".

**Devuelve:** `redirect('home')` o `redirect('playlists:detail')`.

`def add_song_to_playlist(request, playlist_id, song_id)` | <small>`playlists/<int:playlist_id>/add/<int:song_id>/`</small>

**Función:** Añade una canción si no estaba. Calcula `order = MAX(order) + 1`.

**Devuelve:** `JsonResponse({'success': True|False})`.

`def remove_song_from_playlist(request, playlist_id, song_id)` | <small>`playlists/<int:playlist_id>/remove/<int:song_id>/`</small>

**Función:** Elimina el `PlaylistSong` y renumera `order` desde 1.

**Devuelve:** `JsonResponse({'success': True})`.

`def save_playlist(request, pk)` | <small>`playlists/<int:pk>/save/`</small> y `def unsave_playlist(request, pk)` | <small>`playlists/<int:pk>/unsave/`</small>

**Función:** Guardar / dejar de guardar una playlist en `saved_playlists` (un propietario no puede "desguardar" la suya).

**Devuelve:** `JsonResponse({'success': ..., 'saved': ...})`.

`def user_playlists(request)` | <small>`playlists/user-playlists/`</small>

**Función:** Devuelve las playlists del usuario (id, name) en JSON; usado por el menú "Añadir a playlist".

**Devuelve:** `JsonResponse` (lista).

#### Vistas `api_views.py`

`def get_liked_playlist(request)` | <small>`playlists/api/liked/info/`</small> — Metadatos de "Mis joyas". GET.

`def toggle_liked_song(request, song_id)` | <small>`playlists/api/liked/<int:song_id>/toggle/`</small> — Añade/quita una canción de "Mis joyas" (crea la playlist si no existe; calcula `order` y reordena). POST.

`def check_if_liked(request, song_id)` | <small>`playlists/api/liked/<int:song_id>/check/`</small> — Comprueba si una canción está en "Mis joyas". GET.

`def set_liked_playlist_order(request, order_by)` | <small>`playlists/api/liked/order/<str:order_by>/`</small> — Cambia `order_by_field` a `added` o `name`. POST.

`def get_liked_songs(request)` | <small>`playlists/api/liked/songs/`</small> — Lista completa de "Mis joyas" en JSON (id, title, artista, duración, cover, álbum), según orden. GET.

#### Comando de gestión `create_liked_playlists.py`

`manage.py create_liked_playlists` — crea la playlist "Mis joyas" para todos los oyentes que aún no la tengan (e intenta asignar `img/mis-joyas.png` como portada).

### Aplicación `search`

#### Modelos / admin / forms

La aplicación no define modelos propios ni formularios; `admin.py` no tiene personalizaciones. La búsqueda se realiza por parámetros GET.

#### Vistas `views.py`

`def search_view(request)` | <small>`search/`</small>

**Función:** Búsqueda principal por el parámetro `q`. Ejecuta cuatro consultas con `icontains` y `Q` (límite 50 cada una):
- **Canciones**: por título o `artist__user__username`, orden `-plays`.
- **Playlists**: solo oyentes autenticados; por nombre, excluye "Mis joyas".
- **Álbumes**: por título, canciones o artista, `distinct()`, orden `-release_date`.
- **Artistas**: por username, álbumes o canciones, `distinct()`.

**Devuelve:** `search_results.html` con `{query, artists, songs, albums, playlists}`.

`def search_all_view(request)` | <small>`search/all/`</small>

**Función:** Vista "Ver todo" para un único tipo (`?type=songs|albums|artists|playlists`). Misma lógica de filtrado **sin límite de 50**. Si el tipo es desconocido, delega en `search_view`.

**Devuelve:** `search_all.html` con la colección del tipo, o `search_view`.

## Dependencias

- **Django 6.0.4** – Framework web principal.
- **asgiref 3.11.1** – Soporte ASGI para Django.
- **gunicorn 23.0.0** – Servidor de aplicaciones WSGI (producción).
- **mutagen 1.47.0** – Lectura de metadatos de audio (duración real de las canciones).
- **pillow 12.2.0** – Procesamiento de imágenes (validación de ratio de portadas y banners).
- **psycopg2-binary 2.9.12** – Conector para PostgreSQL.
- **python-dotenv 1.2.2** – Manejo de variables de entorno.
- **sqlparse 0.5.5** – Procesamiento de consultas SQL (dependencia de Django).
- **whitenoise 6.12.0** – Servir archivos estáticos en producción.

## Estructura del proyecto
```
accounts
├─ migrations/
├─ __init__.py
├─ admin.py
├─ api_views.py
├─ apps.py
├─ backends.py
├─ context_processors.py
├─ forms.py
├─ models.py
├─ signals.py
├─ stats_utils.py
├─ urls.py
├─ views.py
└─ views_sidebar.py

music
├─ migrations/
├─ __init__.py
├─ admin.py
├─ api_views.py
├─ apps.py
├─ decorators.py
├─ forms.py
├─ models.py
├─ tests.py
├─ urls.py
└─ views.py

playlists
├─ management/commands
│  └─ create_liked_playlists.py
├─ migrations/
├─ __init__.py
├─ admin.py
├─ api_views.py
├─ apps.py
├─ forms.py
├─ models.py
├─ tests.py
├─ urls.py
└─ views.py

search
├─ migrations/
├─ __init__.py
├─ admin.py
├─ apps.py
├─ models.py
├─ tests.py
├─ urls.py
└─ views.py

config
├─ __init__.py
├─ asgi.py
├─ settings.py
├─ urls.py
└─ wsgi.py

templates
├─ accounts
│  ├─ edit_artist_profile.html
│  ├─ edit_listener_profile.html
│  ├─ login.html
│  ├─ register_artist.html
│  ├─ register_listener.html
│  ├─ register_type.html
│  ├─ user_profile.html
│  ├─ user_profile_following.html
│  └─ user_profile_songs.html
├─ music
│  ├─ album_detail.html
│  ├─ album_phase_a.html
│  ├─ album_phase_b.html
│  ├─ artist_albums.html
│  ├─ artist_detail.html
│  ├─ artist_singles.html
│  ├─ create_single.html
│  ├─ edit_album.html
│  └─ song_list.html
├─ playlists
│  ├─ create_playlist.html
│  ├─ edit_playlist.html
│  └─ playlist_detail.html
├─ errors
│  ├─ 403.html
│  └─ 404.html
├─ base.html
├─ home.html
├─ queue_panel.html
├─ search_all.html
└─ search_results.html

static
├─ css   (soundmusik.css, home.css, album_detail.css, artist_detail.css, auth.css, ...)
├─ img   (logo.png, logo2.png, diamond-*.png, headphones.png, microphone.png, ...)
└─ js    (ajax-player.js, queue-system.js, audio-player-sync.js, sidebar.js, ...)

Raíz del proyecto
├─ .dockerignore
├─ .gitignore
├─ Caddyfile
├─ docker-compose.yml
├─ Dockerfile
├─ entrypoint.sh
├─ manage.py
├─ README.md
└─ requirements.txt
```
