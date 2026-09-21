<?php
declare(strict_types=1);

function emitirToken(string $id, string $rol): string
{
    $ahora = time();
    return jwtFirmar([
        'sub' => $id,
        'rol' => $rol,
        'iat' => $ahora,
        'exp' => $ahora + (int) config('jwt_duracion_segundos'),
    ]);
}

function tokenDePeticion(): ?string
{
    $cabecera = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
    if ($cabecera === '' && function_exists('getallheaders')) {
        foreach (getallheaders() as $nombre => $valor) {
            if (strcasecmp((string) $nombre, 'Authorization') === 0) {
                $cabecera = (string) $valor;
            }
        }
    }
    return preg_match('/^Bearer\s+(\S+)$/i', $cabecera, $m) ? $m[1] : null;
}

/**
 * Devuelve la cuenta autenticada (`id`, `rol`, `email`) o responde 401/403.
 */
function sesion(?string $rolRequerido = null): array
{
    $token = tokenDePeticion();
    $payload = $token !== null ? jwtVerificar($token) : null;
    if ($payload === null) {
        throw new HttpError(401, 'no_autenticado', 'Inicia sesión para continuar.');
    }
    $cuenta = Cuenta::buscar((string) $payload['sub']);
    if ($cuenta === null) {
        throw new HttpError(401, 'no_autenticado', 'La sesión ya no es válida.');
    }
    if ($rolRequerido !== null && $cuenta->rol !== $rolRequerido) {
        throw new HttpError(403, 'rol_no_permitido', 'Tu tipo de cuenta no puede realizar esta acción.');
    }
    return ['id' => (string) $cuenta->id, 'rol' => (string) $cuenta->rol, 'email' => (string) $cuenta->email];
}

/**
 * Un paciente sólo accede a su propio expediente. Un médico necesita estar
 * verificado y tener un acceso vigente otorgado por el paciente.
 */
function autorizarPaciente(array $sesion, string $idPaciente, bool $escritura = false): void
{
    if ($sesion['rol'] === 'paciente') {
        if ($sesion['id'] !== $idPaciente) {
            throw new HttpError(403, 'acceso_denegado', 'No tienes acceso a este expediente.');
        }
        return;
    }
    if (Medico::verificado($sesion['id']) === null) {
        throw new HttpError(403, 'medico_no_verificado', 'Tu cédula profesional aún no ha sido verificada.');
    }
    $acceso = AccesoMedico::entre($idPaciente, $sesion['id']);
    if ($acceso === null) {
        throw new HttpError(403, 'acceso_denegado', 'El paciente no te ha otorgado acceso a su expediente.');
    }
    if ($escritura && !$acceso->permiteEscritura()) {
        throw new HttpError(403, 'acceso_solo_lectura', 'Tu acceso a este expediente es de solo lectura.');
    }
}

/** El paciente autorizado por la sesión, listo para consultar su expediente. */
function pacienteAutorizado(array $sesion, string $idPaciente, bool $escritura = false): Paciente
{
    autorizarPaciente($sesion, $idPaciente, $escritura);
    return Paciente::buscarOFallar($idPaciente, 'paciente_no_encontrado', 'El paciente no existe.');
}

/** Paciente y médico pueden conversar si hay un acceso vigente o una cita no cancelada. */
function puedenComunicarse(string $idPaciente, string $idMedico): bool
{
    if (AccesoMedico::entre($idPaciente, $idMedico) !== null) {
        return true;
    }
    return Cita::donde('id_paciente', $idPaciente)
        ->donde('id_medico', $idMedico)
        ->donde('estado', '<>', 'cancelada')
        ->existe();
}

function usuarioResumen(string $id): array
{
    $cuenta = Cuenta::buscarOFallar($id, 'cuenta_no_encontrada', 'La cuenta no existe.');
    return $cuenta->aDto();
}
