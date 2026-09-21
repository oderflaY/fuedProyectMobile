<?php
declare(strict_types=1);

function errorCampo(string $codigo, string $campo, string $mensaje, array $extra = []): HttpError
{
    return new HttpError(422, $codigo, $mensaje, ['campo' => $campo] + $extra);
}

function texto(array $datos, string $campo, bool $requerido = true, int $maximo = 255): ?string
{
    $valor = $datos[$campo] ?? null;
    if ($valor === null || (is_string($valor) && trim($valor) === '')) {
        if ($requerido) {
            throw errorCampo('campo_requerido', $campo, "El campo '$campo' es obligatorio.");
        }
        return null;
    }
    if (!is_string($valor) && !is_int($valor) && !is_float($valor)) {
        throw errorCampo('campo_invalido', $campo, "El campo '$campo' debe ser texto.");
    }
    $valor = trim((string) $valor);
    if (mb_strlen($valor) > $maximo) {
        throw errorCampo('campo_muy_largo', $campo, "El campo '$campo' admite máximo $maximo caracteres.", ['maximo' => $maximo]);
    }
    return $valor;
}

function numero(array $datos, string $campo, bool $requerido = true, ?float $minimo = null, ?float $maximo = null): ?float
{
    $valor = $datos[$campo] ?? null;
    if ($valor === null || $valor === '') {
        if ($requerido) {
            throw errorCampo('campo_requerido', $campo, "El campo '$campo' es obligatorio.");
        }
        return null;
    }
    if (!is_numeric($valor)) {
        throw errorCampo('campo_invalido', $campo, "El campo '$campo' debe ser numérico.");
    }
    $valor = (float) $valor;
    if (($minimo !== null && $valor < $minimo) || ($maximo !== null && $valor > $maximo)) {
        throw errorCampo('fuera_de_rango', $campo, "El campo '$campo' está fuera del rango permitido.", ['minimo' => $minimo, 'maximo' => $maximo]);
    }
    return $valor;
}

function entero(array $datos, string $campo, bool $requerido = true, ?int $minimo = null, ?int $maximo = null): ?int
{
    $valor = numero($datos, $campo, $requerido, $minimo, $maximo);
    if ($valor === null) {
        return null;
    }
    if (floor($valor) !== $valor) {
        throw errorCampo('campo_invalido', $campo, "El campo '$campo' debe ser un número entero.");
    }
    return (int) $valor;
}

function booleano(array $datos, string $campo): ?bool
{
    if (!array_key_exists($campo, $datos) || $datos[$campo] === null) {
        return null;
    }
    if (!is_bool($datos[$campo])) {
        throw errorCampo('campo_invalido', $campo, "El campo '$campo' debe ser verdadero o falso.");
    }
    return $datos[$campo];
}

function opcion(array $datos, string $campo, array $opciones, bool $requerido = true): ?string
{
    $valor = texto($datos, $campo, $requerido, 60);
    if ($valor !== null && !in_array($valor, $opciones, true)) {
        throw errorCampo('opcion_invalida', $campo, "Valor no permitido para '$campo'.", ['opciones' => $opciones]);
    }
    return $valor;
}

function correo(array $datos, string $campo): string
{
    $valor = mb_strtolower((string) texto($datos, $campo, true, 160));
    if (filter_var($valor, FILTER_VALIDATE_EMAIL) === false) {
        throw errorCampo('email_invalido', $campo, 'El correo electrónico no es válido.');
    }
    return $valor;
}

/** Fecha de calendario `YYYY-MM-DD`. */
function fecha(array $datos, string $campo, bool $requerido = true): ?string
{
    $valor = texto($datos, $campo, $requerido, 10);
    if ($valor === null) {
        return null;
    }
    $f = DateTimeImmutable::createFromFormat('!Y-m-d', $valor);
    if ($f === false || $f->format('Y-m-d') !== $valor) {
        throw errorCampo('fecha_invalida', $campo, "El campo '$campo' debe tener formato YYYY-MM-DD.");
    }
    return $valor;
}

/** Fecha y hora ISO 8601 con zona; se normaliza a DATETIME UTC `YYYY-MM-DD HH:MM:SS` para MySQL. */
function fechaHoraSql(array $datos, string $campo, bool $requerido = true): ?string
{
    $valor = texto($datos, $campo, $requerido, 40);
    if ($valor === null) {
        return null;
    }
    if (!preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/', $valor)) {
        throw errorCampo('fecha_hora_invalida', $campo, "El campo '$campo' debe ser ISO 8601 con zona horaria.");
    }
    try {
        return sqlUtc(new DateTimeImmutable($valor));
    } catch (Exception) {
        throw errorCampo('fecha_hora_invalida', $campo, "El campo '$campo' debe ser ISO 8601 con zona horaria.");
    }
}

function horaHHMM(string $valor, string $campo): string
{
    if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d$/', $valor)) {
        throw errorCampo('hora_invalida', $campo, 'Las horas deben tener formato HH:MM.');
    }
    return $valor;
}

function fechaDeParametro(string $nombre, string $defecto): string
{
    $valor = parametro($nombre, $defecto);
    return (string) fecha([$nombre => $valor], $nombre);
}
