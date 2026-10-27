<?php
declare(strict_types=1);

// Punto de entrada único de la API.
//   Desarrollo: php -S 0.0.0.0:8080 index.php   (desde la carpeta api/)
//   Apache:     el .htaccess redirige todas las rutas a este archivo.

require __DIR__ . '/lib/bootstrap.php';

set_error_handler(static function (int $nivel, string $mensaje, string $archivo, int $linea): bool {
    throw new ErrorException($mensaje, 0, $nivel, $archivo, $linea);
});

set_exception_handler(static function (Throwable $e): void {
    if ($e instanceof HttpError) {
        responderError($e);
    }
    if ($e instanceof PDOException && $e->getCode() === '42S02') {
        responderError(new HttpError(503, 'base_de_datos_no_instalada', 'Ejecuta php database/instalar.php para crear las tablas.'));
    }
    error_log((string) $e);
    responderError(new HttpError(500, 'error_interno', 'Ocurrió un error inesperado.'));
});

aplicarCors((array) config('origenes_permitidos'), (string) config('origenes_patron'));

$router = new Router();
$router->get('/', fn () => responder(['nombre' => 'Fued API', 'version' => '1.0.0', 'estado' => 'ok']));

foreach (['auth', 'pacientes', 'privacidad', 'segmentacion', 'alertas', 'medicos', 'tratamientos', 'adherencia', 'metricas', 'citas', 'chat', 'documentos', 'emergencia', 'graphql'] as $modulo) {
    (require __DIR__ . "/routes/$modulo.php")($router);
}

$router->despachar($_SERVER['REQUEST_METHOD'] ?? 'GET', rutaSolicitada());
