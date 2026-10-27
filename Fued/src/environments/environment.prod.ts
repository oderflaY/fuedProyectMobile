import { Capacitor } from '@capacitor/core';

// Producción: el VPS publica la API en https://2.25.68.28:7443/fued-api (Caddy + Docker, ver deploy/).
// Por IP y no por sslip.io: la red de la escuela bloquea sslip.io. La versión web usa su propio origen.
const SERVIDOR = 'https://2.25.68.28:7443';

export const environment = {
  production: true,
  apiUrl: `${Capacitor.isNativePlatform() ? SERVIDOR : window.location.origin}/fued-api`,
  mostrarCuentasDemo: true,
};
