#!/usr/bin/env bash
#
# Publica Fued en el VPS: compila la app web de producción, empaqueta API + web + deploy/,
# lo sube y lo levanta con Docker en /root/fued.
#
#   ./deploy/publicar.sh                    -> root@2.25.68.28
#   ./deploy/publicar.sh usuario@otro-vps
#
# Los datos (base y adjuntos del chat) viven en volúmenes de Docker y no se tocan al volver a publicar.

set -euo pipefail

VPS="${1:-root@2.25.68.28}"
RAIZ="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAQUETE="$(mktemp -d)/fued.tar.gz"
trap 'rm -rf "$(dirname "$PAQUETE")"' EXIT

cd "$RAIZ"
echo "==> Compilando la app web de producción"
npx ng build --configuration production

echo "==> Empaquetando"
tar -czf "$PAQUETE" \
    --exclude='api/tests' --exclude='api/desplegar.sh' --exclude='api/almacenamiento/chat/*' --exclude='api/almacenamiento/documentos/*' \
    --exclude='deploy/.env' \
    api www deploy

echo "==> Subiendo a $VPS"
scp -q "$PAQUETE" "$VPS:/tmp/fued.tar.gz"

echo "==> Instalando en el VPS"
ssh "$VPS" 'set -e
    mkdir -p /root/fued
    # api/ y www/ se reemplazan completos; deploy/.env (secretos) se conserva.
    rm -rf /root/fued/api /root/fued/www
    tar -xzf /tmp/fued.tar.gz -C /root/fued
    rm /tmp/fued.tar.gz
    /root/fued/deploy/instalar.sh'
