<?php
declare(strict_types=1);

function conectarMysql(bool $conBaseDeDatos = true): PDO
{
    $cfg = config('db');
    $dsn = sprintf('mysql:host=%s;port=%d;charset=utf8mb4', $cfg['host'], $cfg['puerto']);
    if ($conBaseDeDatos) {
        $dsn .= ';dbname=' . $cfg['nombre'];
    }
    $pdo = new PDO($dsn, $cfg['usuario'], $cfg['password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }
    try {
        return $pdo = conectarMysql();
    } catch (PDOException $e) {
        error_log('Conexión MySQL fallida: ' . $e->getMessage());
        throw new HttpError(503, 'base_de_datos_no_disponible', 'No se pudo conectar a la base de datos MySQL.');
    }
}

function consultar(string $sql, array $parametros = []): array
{
    $sentencia = db()->prepare($sql);
    $sentencia->execute($parametros);
    return $sentencia->fetchAll();
}

function consultarUno(string $sql, array $parametros = []): ?array
{
    $sentencia = db()->prepare($sql);
    $sentencia->execute($parametros);
    $fila = $sentencia->fetch();
    return $fila === false ? null : $fila;
}

function valor(string $sql, array $parametros = []): mixed
{
    $sentencia = db()->prepare($sql);
    $sentencia->execute($parametros);
    return $sentencia->fetchColumn();
}

function ejecutar(string $sql, array $parametros = []): int
{
    $sentencia = db()->prepare($sql);
    $sentencia->execute($parametros);
    return $sentencia->rowCount();
}

function enTransaccion(callable $trabajo): mixed
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $resultado = $trabajo();
        $pdo->commit();
        return $resultado;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}
