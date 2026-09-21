<?php
declare(strict_types=1);

// Crea la base de datos MySQL, sus tablas y (opcionalmente) los datos demo.
//
//   php database/instalar.php              instala esquema + datos demo
//   php database/instalar.php --sin-demo   instala sólo el esquema
//   php database/instalar.php --reiniciar  BORRA la base y la vuelve a crear

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Este script sólo puede ejecutarse desde la terminal.');
}

require __DIR__ . '/../lib/bootstrap.php';
require __DIR__ . '/seed.php';

$opciones = getopt('', ['sin-demo', 'reiniciar']);
$cfg = config('db');
$nombre = str_replace('`', '', (string) $cfg['nombre']);

try {
    $servidor = conectarMysql(false);
} catch (PDOException $e) {
    fwrite(STDERR, "No se pudo conectar a MySQL en {$cfg['host']}:{$cfg['puerto']} como {$cfg['usuario']}.\n{$e->getMessage()}\n");
    exit(1);
}

if (isset($opciones['reiniciar'])) {
    $servidor->exec("DROP DATABASE IF EXISTS `$nombre`");
    echo "Base de datos `$nombre` eliminada.\n";
}
$servidor->exec("CREATE DATABASE IF NOT EXISTS `$nombre` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");

$pdo = db();
$yaInstalada = (int) valor(
    "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = ? AND table_name = 'cuentas'",
    [$nombre]
);
if ($yaInstalada > 0) {
    fwrite(STDERR, "La base `$nombre` ya tiene tablas. Usa --reiniciar para borrarla y crearla de nuevo.\n");
    exit(1);
}

$sql = (string) file_get_contents(__DIR__ . '/schema.sql');
$sql = (string) preg_replace('/^\s*--.*$/m', '', $sql);
foreach (preg_split('/;\s*$/m', $sql) ?: [] as $sentencia) {
    if (trim($sentencia) !== '') {
        $pdo->exec($sentencia);
    }
}
echo "Tablas creadas en `$nombre`.\n";

if (!isset($opciones['sin-demo'])) {
    enTransaccion(fn () => sembrarDatosDemo());
    echo "Datos demo cargados. Contraseña de todas las cuentas: Fued12345\n";
    echo "  Paciente: juan.perez@correo.com\n";
    echo "  Paciente: maria.lopez@correo.com\n";
    echo "  Médico:   dr.elena.ruiz@hospital.com\n";
    echo "  Médico:   dr.carlos.mendez@hospital.com\n";
}
