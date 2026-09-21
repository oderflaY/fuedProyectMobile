#!/usr/bin/env bash
#
# Publica la API en XAMPP. El código fuente sigue viviendo en el repositorio
# (api/) y este script copia una versión lista para Apache.
#
#   sudo ./api/desplegar.sh                      -> /opt/lampp/htdocs/fued-api
#   sudo ./api/desplegar.sh /otra/ruta           -> destino a la medida
#   sudo ./api/desplegar.sh --con-base           -> además crea la base y los datos demo
#
# Los adjuntos del chat ya subidos NO se borran al volver a publicar.

set -euo pipefail

ORIGEN="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESTINO="/opt/lampp/htdocs/fued-api"
USUARIO_APACHE="${USUARIO_APACHE:-daemon}"
PHP_XAMPP="${PHP_XAMPP:-/opt/lampp/bin/php}"
CON_BASE=0

for argumento in "$@"; do
    case "$argumento" in
        --con-base) CON_BASE=1 ;;
        -*) echo "Opción desconocida: $argumento" >&2; exit 1 ;;
        *) DESTINO="$argumento" ;;
    esac
done

if [ ! -w "$(dirname "$DESTINO")" ]; then
    echo "No tienes permiso de escritura en $(dirname "$DESTINO")." >&2
    echo "Vuelve a ejecutarlo así:  sudo $0 $*" >&2
    exit 1
fi

echo "Publicando la API"
echo "  origen:  $ORIGEN"
echo "  destino: $DESTINO"

mkdir -p "$DESTINO"
rsync -a --delete \
    --exclude 'tests/' \
    --exclude 'desplegar.sh' \
    --exclude 'almacenamiento/chat/*' \
    "$ORIGEN"/ "$DESTINO"/

# Apache es quien escribe los adjuntos del chat.
mkdir -p "$DESTINO/almacenamiento/chat"
if [ "$(id -u)" -eq 0 ] && id "$USUARIO_APACHE" > /dev/null 2>&1; then
    chown -R "$USUARIO_APACHE":"$USUARIO_APACHE" "$DESTINO/almacenamiento"
    chmod -R 775 "$DESTINO/almacenamiento"
else
    echo "  aviso: no se pudo cambiar el dueño de almacenamiento/ (ejecuta con sudo)"
fi

if [ "$CON_BASE" -eq 1 ]; then
    echo "Instalando la base de datos con $PHP_XAMPP"
    "$PHP_XAMPP" "$DESTINO/database/instalar.php" || true
fi

echo
echo "Listo. La API queda en:  http://localhost/$(basename "$DESTINO")"
echo "Compruébalo con:         curl http://localhost/$(basename "$DESTINO")/"
if [ "$CON_BASE" -eq 0 ]; then
    echo "Falta crear la base:     sudo $PHP_XAMPP $DESTINO/database/instalar.php"
fi
