#!/bin/sh
set -e

# Apache escribe los adjuntos del chat y los documentos del expediente en sus volúmenes.
mkdir -p almacenamiento/chat almacenamiento/documentos
chown -R www-data:www-data almacenamiento/chat almacenamiento/documentos

# Primera vez: crea tablas y datos demo. Si ya existen, instalar.php sólo avisa.
php database/instalar.php || true
# Bases ya instaladas: agrega lo que traigan las migraciones nuevas.
php database/migrar.php || true

exec docker-php-entrypoint "$@"
