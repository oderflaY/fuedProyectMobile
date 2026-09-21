<?php
declare(strict_types=1);

function config(string $clave): mixed
{
    static $config = null;
    $config ??= require __DIR__ . '/../config.php';
    return $config[$clave] ?? null;
}

/** Genera un identificador con prefijo semántico, p. ej. `pac_01H8X9A2KQ`. */
function nuevoId(string $prefijo): string
{
    $alfabeto = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
    $bytes = random_bytes(10);
    $id = '';
    for ($i = 0; $i < 10; $i++) {
        $id .= $alfabeto[ord($bytes[$i]) % 32];
    }
    return $prefijo . '_' . $id;
}

// MySQL guarda DATETIME en UTC con formato `Y-m-d H:i:s`; la API expone ISO 8601 (`Y-m-d\TH:i:s\Z`).

function sqlUtc(DateTimeInterface $fecha): string
{
    return DateTimeImmutable::createFromInterface($fecha)
        ->setTimezone(new DateTimeZone('UTC'))
        ->format('Y-m-d H:i:s');
}

function ahoraSql(): string
{
    return gmdate('Y-m-d H:i:s');
}

function iso(?string $fechaSql): ?string
{
    if ($fechaSql === null || $fechaSql === '') {
        return null;
    }
    return (new DateTimeImmutable($fechaSql, new DateTimeZone('UTC')))->format('Y-m-d\TH:i:s\Z');
}

function isoUtc(DateTimeInterface $fecha): string
{
    return DateTimeImmutable::createFromInterface($fecha)
        ->setTimezone(new DateTimeZone('UTC'))
        ->format('Y-m-d\TH:i:s\Z');
}

function zonaHoraria(?string $nombre): DateTimeZone
{
    try {
        return new DateTimeZone($nombre ?: (string) config('zona_horaria'));
    } catch (Exception) {
        return new DateTimeZone((string) config('zona_horaria'));
    }
}

function fechaHoyLocal(DateTimeZone $tz): string
{
    return (new DateTimeImmutable('now', $tz))->format('Y-m-d');
}

function nombreCompleto(array $fila, string $prefijo = ''): string
{
    return trim(($fila[$prefijo . 'nombre'] ?? '') . ' ' . ($fila[$prefijo . 'apellidos'] ?? ''));
}
