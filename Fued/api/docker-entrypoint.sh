#!/bin/sh
set -e

# Apache escribe los adjuntos del chat en el volumen.
mkdir -p almacenamiento/chat
chown -R www-data:www-data almacenamiento/chat

# Primera vez: crea tablas y datos demo. Si ya existen, instalar.php sólo avisa.
php database/instalar.php || true

exec docker-php-entrypoint "$@"
