#!/bin/sh
set -e

# Esperar a que PostgreSQL acepte conexiones antes de arrancar
echo "Esperando a PostgreSQL en ${DB_HOST}:${DB_PORT}..."
while ! nc -z "${DB_HOST}" "${DB_PORT}"; do
  sleep 0.5
done
echo "PostgreSQL disponible."

# Migraciones y recopilación de estáticos.
# (collectstatic en el arranque resuelve de raíz el problema de caché de estáticos JS/CSS.)
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# Arrancar el servidor de aplicaciones
exec gunicorn config.wsgi:application --bind 0.0.0.0:8000 --workers 3
