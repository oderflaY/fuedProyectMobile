<?php
declare(strict_types=1);

// Aplica las migraciones de database/migraciones/ sobre una base ya instalada.
// Se puede correr siempre (lo hace el contenedor al arrancar): lo que ya existe se salta.
//
//   php database/migrar.php

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit('Este script sólo puede ejecutarse desde la terminal.');
}

require __DIR__ . '/../lib/bootstrap.php';

// Columna, tabla, llave o índice que ya existen: la migración ya se había aplicado.
const ERRORES_YA_APLICADA = [1050, 1060, 1061, 1826];

$pdo = db();
$archivos = glob(__DIR__ . '/migraciones/*.sql') ?: [];
sort($archivos);
foreach ($archivos as $archivo) {
    $sql = (string) preg_replace('/^\s*--.*$/m', '', (string) file_get_contents($archivo));
    foreach (preg_split('/;\s*$/m', $sql) ?: [] as $sentencia) {
        if (trim($sentencia) === '') {
            continue;
        }
        try {
            $pdo->exec($sentencia);
        } catch (PDOException $e) {
            if (!in_array((int) ($e->errorInfo[1] ?? 0), ERRORES_YA_APLICADA, true)) {
                throw $e;
            }
        }
    }
    echo 'Migración revisada: ' . basename($archivo) . "\n";
}
