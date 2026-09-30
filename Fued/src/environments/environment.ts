// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.
import { Capacitor } from '@capacitor/core';

// La app nativa instalada en el teléfono llega a la API por el cable USB:
// `./telefono-usb.sh` redirige 127.0.0.1:8081 del teléfono al puerto 80 de la compu,
// así funciona aunque el teléfono y la compu estén en redes distintas.
// En el navegador se toma el mismo host desde el que se abrió la app.
const HOST_NATIVO = '127.0.0.1:8081';

const host = Capacitor.isNativePlatform() ? HOST_NATIVO : window.location.hostname;

export const environment = {
  production: false,
  // API publicada en XAMPP (/opt/lampp/htdocs/fued-api).
  apiUrl: `http://${host}/fued-api`,
  mostrarCuentasDemo: true,
};
