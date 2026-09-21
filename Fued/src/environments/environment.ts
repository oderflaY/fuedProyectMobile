// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  // API publicada en XAMPP (/opt/lampp/htdocs/fued-api).
  // Con el servidor de PHP integrado sería 'http://localhost:8080'.
  // En un teléfono físico usa la IP de tu computadora, p. ej. http://192.168.1.50/fued-api
  apiUrl: 'http://localhost/fued-api',
  mostrarCuentasDemo: true,
};
