#!/usr/bin/env bash
# Corre en el VPS (lo llama publicar.sh): genera los secretos la primera vez y levanta el stack.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

if [ ! -f .env ]; then
    echo "Generando secretos en deploy/.env"
    umask 077
    {
        echo "FUED_DB_ROOT_PASS=$(openssl rand -hex 24)"
        echo "FUED_DB_PASS=$(openssl rand -hex 24)"
        echo "FUED_JWT_SECRET=$(openssl rand -hex 48)"
        echo "FUED_AUTO_VERIFICAR=1"
    } > .env
fi

docker network inspect rutacree_edge > /dev/null 2>&1 || {
    echo "Falta la red rutacree_edge: Fued se publica detrás del Caddy compartido (proxy de Salud+)." >&2
    exit 1
}

docker compose up -d --build --remove-orphans
docker image prune -f > /dev/null

echo "Esperando a la API..."
for _ in $(seq 30); do
    if docker compose exec -T app curl -fsS http://localhost/fued-api/ > /dev/null 2>&1; then
        echo "Fued arriba: https://2.25.68.28:7443 (y https://fued.2-25-68-28.sslip.io)"
        exit 0
    fi
    sleep 2
done
echo "La API no respondió; revisa: docker compose -f /root/fued/deploy/docker-compose.yml logs app" >&2
exit 1
