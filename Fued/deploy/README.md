# Fued en producción

Corre en el VPS de RutaCree (`root@82.21.72.68`), como un stack de Docker aparte en `/root/fued`:

| Servicio | Qué es |
|---|---|
| `fued-app-1` | Apache + PHP: la app web en `/` y la API en `/fued-api/` |
| `fued-db-1` | MariaDB (volumen `fued_db`); los adjuntos del chat van en `fued_adjuntos` |

- App web: https://fued.82-21-72-68.sslip.io
- API: https://fued.82-21-72-68.sslip.io/fued-api/
- APK: https://fued.82-21-72-68.sslip.io/fued.apk (se copia a mano al contenedor; se pierde al republicar)

No publica puertos. El Caddy de RutaCree tiene un bloque `fued.{$DOMAIN}` en su `Caddyfile`
(en el repo de RutaCree) que le da HTTPS y le pasa el tráfico a `fued-app` por la red `rutacree_edge`.

## Publicar una versión nueva

```sh
./deploy/publicar.sh
```

Compila la web de producción, sube `api/`, `www/` y `deploy/`, y corre `deploy/instalar.sh` en el VPS.
La primera vez genera los secretos en `/root/fued/deploy/.env`. La base y los adjuntos se conservan.

Para el APK: `npx ng build --configuration production && npx cap sync android && (cd android && ./gradlew assembleDebug)`.
`environment.prod.ts` ya apunta al servidor.

## Ojo

- El `Caddyfile` está montado como archivo: si un despliegue de RutaCree lo reemplaza, Caddy sigue viendo
  la copia vieja hasta que se reinicia el contenedor. Para aplicar cambios sin reiniciar:
  `docker cp /root/rutacree/Caddyfile rutacree-caddy-1:/tmp/Caddyfile && docker exec rutacree-caddy-1 caddy reload --config /tmp/Caddyfile --adapter caddyfile`
- Las cuentas demo (`Fued12345`) existen en producción y la pantalla de login las muestra.
- `FUED_AUTO_VERIFICAR=1`: los médicos nuevos quedan verificados sin revisar la cédula.
