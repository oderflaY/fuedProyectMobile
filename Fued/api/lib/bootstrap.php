<?php
declare(strict_types=1);

// Todas las operaciones de fecha del servidor se hacen en UTC; la zona local sólo
// se usa para interpretar horarios (08:00, 20:00) que envía el cliente.
date_default_timezone_set('UTC');
mb_internal_encoding('UTF-8');

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/validacion.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/jwt.php';
require_once __DIR__ . '/orm/Modelo.php';
require_once __DIR__ . '/orm/Consulta.php';
require_once __DIR__ . '/auth.php';

// Autocarga de los modelos del ORM (api/modelos/Paciente.php => class Paciente).
spl_autoload_register(static function (string $clase): void {
    $ruta = __DIR__ . '/../modelos/' . $clase . '.php';
    if (is_file($ruta)) {
        require_once $ruta;
    }
});
