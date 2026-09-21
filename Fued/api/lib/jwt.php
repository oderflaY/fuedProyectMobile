<?php
declare(strict_types=1);

function base64Url(string $datos): string
{
    return rtrim(strtr(base64_encode($datos), '+/', '-_'), '=');
}

function base64UrlDecodificar(string $datos): string|false
{
    $relleno = str_repeat('=', (4 - strlen($datos) % 4) % 4);
    return base64_decode(strtr($datos, '-_', '+/') . $relleno, true);
}

function jwtFirmar(array $payload): string
{
    $cabecera = base64Url((string) json_encode(['alg' => 'HS256', 'typ' => 'JWT']));
    $cuerpo = base64Url((string) json_encode($payload));
    $firma = base64Url(hash_hmac('sha256', "$cabecera.$cuerpo", (string) config('jwt_secreto'), true));
    return "$cabecera.$cuerpo.$firma";
}

function jwtVerificar(string $token): ?array
{
    $partes = explode('.', $token);
    if (count($partes) !== 3) {
        return null;
    }
    [$cabecera, $cuerpo, $firma] = $partes;
    $esperada = base64Url(hash_hmac('sha256', "$cabecera.$cuerpo", (string) config('jwt_secreto'), true));
    if (!hash_equals($esperada, $firma)) {
        return null;
    }
    $datosCabecera = json_decode((string) base64UrlDecodificar($cabecera), true);
    $payload = json_decode((string) base64UrlDecodificar($cuerpo), true);
    if (($datosCabecera['alg'] ?? '') !== 'HS256' || !is_array($payload)) {
        return null;
    }
    if (!isset($payload['exp'], $payload['sub']) || $payload['exp'] < time()) {
        return null;
    }
    return $payload;
}
