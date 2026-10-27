// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import { Capacitor } from '@capacitor/core';

// La app nativa de desarrollo usa la API de producción (VPS, ver deploy/README.md).
// Para la API local por cable: 'http://127.0.0.1:8081' con `./telefono-usb.sh` corriendo.
// En el navegador se toma el mismo host desde el que se abrió la app (API local en Docker).
const SERVIDOR_NATIVO = 'https://2.25.68.28:7443';

const servidor = Capacitor.isNativePlatform() ? SERVIDOR_NATIVO : `http://${window.location.hostname}`;

export const environment = {
  production: false,
  // API publicada en XAMPP (/opt/lampp/htdocs/fued-api).
  apiUrl: `${servidor}/fued-api`,
  mostrarCuentasDemo: true,
};
