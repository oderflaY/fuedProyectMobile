<?php
declare(strict_types=1);

// Pruebas de integración de la API contra una base MySQL de pruebas.
// ADVERTENCIA: borra y recrea la base indicada en FUED_DB_NAME (por defecto `fued_test`).
//
//   FUED_DB_NAME=fued_test php tests/api_test.php

if (PHP_SAPI !== 'cli') {
    exit(1);
}

putenv('FUED_DB_NAME=' . (getenv('FUED_DB_NAME') ?: 'fued_test'));
if (getenv('FUED_DB_NAME') === 'fued') {
    fwrite(STDERR, "Por seguridad las pruebas no corren sobre la base `fued`.\n");
    exit(1);
}

$raiz = dirname(__DIR__);
passthru(escapeshellarg(PHP_BINARY) . ' ' . escapeshellarg("$raiz/database/instalar.php") . ' --reiniciar > /dev/null', $codigo);
if ($codigo !== 0) {
    fwrite(STDERR, "No se pudo preparar la base de pruebas.\n");
    exit(1);
}

$puerto = random_int(20000, 40000);
$servidor = proc_open(
    [PHP_BINARY, '-d', 'upload_max_filesize=10M', '-d', 'post_max_size=12M', '-S', "127.0.0.1:$puerto", 'index.php'],
    [1 => ['file', '/dev/null', 'w'], 2 => ['file', '/dev/null', 'w']],
    $tuberias,
    $raiz
);
register_shutdown_function(fn () => proc_terminate($servidor));
for ($i = 0; $i < 50 && @fsockopen('127.0.0.1', $puerto) === false; $i++) {
    usleep(100_000);
}

function http(string $metodo, string $ruta, ?array $cuerpo = null, ?string $token = null): array
{
    global $puerto;
    $cabeceras = ['Content-Type: application/json'];
    if ($token !== null) {
        $cabeceras[] = "Authorization: Bearer $token";
    }
    $contexto = stream_context_create(['http' => [
        'method' => $metodo,
        'header' => implode("\r\n", $cabeceras),
        'content' => $cuerpo !== null ? json_encode($cuerpo) : '',
        'ignore_errors' => true,
    ]]);
    $respuesta = file_get_contents("http://127.0.0.1:$puerto$ruta", false, $contexto);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $m);
    return [(int) ($m[1] ?? 0), json_decode((string) $respuesta, true)];
}

/** Envía un archivo por multipart/form-data. */
function subir(string $ruta, string $nombre, string $mime, string $contenido, ?string $token, array $campos = []): array
{
    global $puerto;
    $limite = '----fued' . bin2hex(random_bytes(6));
    $cuerpo = '';
    foreach ($campos as $clave => $valor) {
        $cuerpo .= "--$limite\r\nContent-Disposition: form-data; name=\"$clave\"\r\n\r\n$valor\r\n";
    }
    $cuerpo .= "--$limite\r\nContent-Disposition: form-data; name=\"archivo\"; filename=\"$nombre\"\r\n"
        . "Content-Type: $mime\r\n\r\n$contenido\r\n--$limite--\r\n";
    $cabeceras = ["Content-Type: multipart/form-data; boundary=$limite"];
    if ($token !== null) {
        $cabeceras[] = "Authorization: Bearer $token";
    }
    $contexto = stream_context_create(['http' => [
        'method' => 'POST', 'header' => implode("\r\n", $cabeceras), 'content' => $cuerpo, 'ignore_errors' => true,
    ]]);
    $respuesta = file_get_contents("http://127.0.0.1:$puerto$ruta", false, $contexto);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $m);
    return [(int) ($m[1] ?? 0), json_decode((string) $respuesta, true)];
}

/** Descarga binaria: devuelve [estado, cabeceras, contenido]. */
function descargar(string $ruta, ?string $token): array
{
    global $puerto;
    $cabeceras = $token !== null ? ["Authorization: Bearer $token"] : [];
    $contexto = stream_context_create(['http' => ['method' => 'GET', 'header' => implode("\r\n", $cabeceras), 'ignore_errors' => true]]);
    $contenido = file_get_contents("http://127.0.0.1:$puerto$ruta", false, $contexto);
    preg_match('/\s(\d{3})\s/', $http_response_header[0] ?? '', $m);
    return [(int) ($m[1] ?? 0), $http_response_header ?? [], (string) $contenido];
}

/** WAV de silencio para probar notas de voz. */
function wavDePrueba(int $muestras = 800): string
{
    $datos = str_repeat("\x00\x00", $muestras);
    $tamanoDatos = strlen($datos);
    return 'RIFF' . pack('V', 36 + $tamanoDatos) . 'WAVEfmt ' . pack('VvvVVvv', 16, 1, 1, 8000, 16000, 2, 16)
        . 'data' . pack('V', $tamanoDatos) . $datos;
}

$fallos = 0;
$total = 0;
function afirmar(bool $condicion, string $descripcion, mixed $contexto = null): void
{
    global $fallos, $total;
    $total++;
    if ($condicion) {
        echo "  ok   $descripcion\n";
        return;
    }
    $fallos++;
    echo "  FALLO $descripcion\n";
    if ($contexto !== null) {
        echo '        ' . json_encode($contexto, JSON_UNESCAPED_UNICODE) . "\n";
    }
}

function login(string $email): string
{
    [, $r] = http('POST', '/auth/login', ['email' => $email, 'password' => 'Fued12345']);
    return $r['token'] ?? '';
}

$tz = new DateTimeZone('America/Mexico_City');
$hoy = (new DateTimeImmutable('now', $tz))->format('Y-m-d');
$q = '&tz=America/Mexico_City';

echo "Autenticación\n";
[$estado] = http('GET', '/');
afirmar($estado === 200, 'la raíz responde');
[$estado, $r] = http('POST', '/auth/login', ['email' => 'juan.perez@correo.com', 'password' => 'mala-clave']);
afirmar($estado === 401 && $r['error']['codigo'] === 'credenciales_invalidas', 'rechaza contraseña incorrecta', $r);
$juan = login('juan.perez@correo.com');
$maria = login('maria.lopez@correo.com');
$elena = login('dr.elena.ruiz@hospital.com');
$carlos = login('dr.carlos.mendez@hospital.com');
afirmar($juan !== '' && $elena !== '', 'inicia sesión paciente y médico');
[$estado, $r] = http('GET', '/auth/yo', null, $juan);
afirmar($estado === 200 && $r['rol'] === 'paciente' && $r['id'] === 'pac_01H8X9A', 'devuelve la sesión actual', $r);
[$estado] = http('GET', '/auth/yo', null, 'token.falso.x');
afirmar($estado === 401, 'rechaza un token inválido');

echo "Expediente y permisos\n";
[$estado, $r] = http('GET', '/pacientes/pac_01H8X9A', null, $juan);
afirmar($estado === 200 && $r['perfilEmergenciaReducido']['tipoSangre'] === 'O+', 'el paciente ve su expediente', $r);
afirmar(count($r['tratamientosActivos'] ?? []) === 2 && $r['historialClinico']['cirugias'][0]['procedimiento'] === 'Apendicectomía', 'el expediente sigue el DTO');
afirmar(preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/', (string) $r['dispositivosRfid'][0]['fechaAsignacion']) === 1, 'las fechas salen en ISO 8601 UTC', $r['dispositivosRfid']);
[$estado] = http('GET', '/pacientes/pac_02J9Y8B', null, $juan);
afirmar($estado === 403, 'un paciente no ve expedientes ajenos');
[$estado, $r] = http('GET', '/medicos/yo', null, $elena);
afirmar($estado === 200 && count($r['pacientesVinculados']) === 2 && isset($r['pacientesVinculados'][0]['estadoRiesgo']), 'el médico ve su cartera con semáforo', $r);
[$estado] = http('GET', '/pacientes/pac_02J9Y8B', null, $elena);
afirmar($estado === 200, 'el médico con acceso de lectura ve el expediente');
[$estado, $r] = http('POST', '/pacientes/pac_02J9Y8B/cirugias', ['procedimiento' => 'Prueba', 'fecha' => '2020-01-01'], $elena);
afirmar($estado === 403 && $r['error']['codigo'] === 'acceso_solo_lectura', 'acceso de lectura no permite escribir', $r);
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/alergias', ['alergeno' => 'Sulfas', 'severidad' => 'Moderada'], $elena);
afirmar($estado === 201 && str_starts_with($r['id'], 'ale_'), 'el médico con escritura agrega una alergia', $r);
[$estado] = http('DELETE', '/pacientes/pac_01H8X9A/alergias/' . $r['id'], null, $elena);
afirmar($estado === 204, 'y la puede eliminar');
[$estado, $r] = http('PUT', '/pacientes/pac_01H8X9A', ['datosPersonales' => ['telefono' => '+526180000000']], $juan);
afirmar($estado === 200 && $r['datosPersonales']['telefono'] === '+526180000000', 'el paciente actualiza sus datos', $r);

echo "RFID de emergencia\n";
[$estado, $r] = http('GET', '/emergencia/rfid/rfid_hash_abc123');
afirmar($estado === 200 && array_keys($r) === ['perfilEmergenciaReducido'], 'sólo expone el perfil de emergencia', $r);
[$estado] = http('GET', '/emergencia/rfid/no-existe');
afirmar($estado === 404, 'tarjeta desconocida responde 404');
[$estado] = http('PUT', '/pacientes/pac_01H8X9A/rfid/rfid_hash_abc123', ['estado' => 'extraviada'], $juan);
afirmar($estado === 200, 'el paciente reporta su tarjeta extraviada');
[$estado, $r] = http('GET', '/emergencia/rfid/rfid_hash_abc123');
afirmar($estado === 410, 'una tarjeta extraviada queda revocada (baja lógica)', $r);

echo "Tomas diarias de medicamentos\n";
[$estado, $r] = http('GET', "/pacientes/pac_01H8X9A/tomas?fecha=$hoy$q", null, $juan);
afirmar($estado === 200 && array_column($r['tomas'], 'horario') === ['08:00', '14:00', '20:00'], 'arma la agenda del día', $r);
$toma = $r['tomas'][0];
$inventarioInicial = $toma['inventario']['cantidadRestante'];
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/tomas', ['idTratamiento' => $toma['idTratamiento'], 'fechaHoraProgramada' => $toma['fechaHoraProgramada'], 'estado' => 'tomado'], $juan);
afirmar($estado === 201 && in_array($r['registro']['estado'], ['tomado', 'tomado_tarde'], true), 'registra una toma', $r);
afirmar($r['inventario']['cantidadRestante'] === $inventarioInicial - 1, 'descuenta el inventario', $r);
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/tomas', ['idTratamiento' => $toma['idTratamiento'], 'fechaHoraProgramada' => $toma['fechaHoraProgramada'], 'estado' => 'omitido', 'sintomasAsociados' => 'Náusea'], $juan);
afirmar($estado === 201 && $r['registro']['estado'] === 'omitido' && $r['inventario']['cantidadRestante'] === $inventarioInicial, 'corregir a omitido devuelve la pastilla al inventario', $r);
[$estado, $r] = http('GET', "/pacientes/pac_01H8X9A/adherencia?hasta=$hoy$q", null, $elena);
afirmar($estado === 200 && $r['resumen']['total'] >= 11, 'el médico consulta el historial de adherencia', $r['resumen'] ?? $r);
[$estado] = http('POST', '/pacientes/pac_01H8X9A/tomas', ['idTratamiento' => 'trt_001', 'fechaHoraProgramada' => $toma['fechaHoraProgramada'], 'estado' => 'tomado'], $elena);
afirmar($estado === 403, 'sólo el paciente marca sus tomas');

echo "Tratamientos\n";
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/tratamientos', ['medicamento' => 'Amlodipino', 'dosis' => '5mg', 'frecuenciaHoras' => 8, 'inventario' => ['cantidadRestante' => 30]], $elena);
afirmar($estado === 201 && $r['horariosSugeridos'] === ['00:00', '08:00', '16:00'] && $r['idMedicoReceta'] === 'doc_889900A', 'el médico receta y se calculan horarios', $r);
$idTrt = $r['idTratamiento'];
[$estado, $r] = http('PUT', "/tratamientos/$idTrt", ['dosis' => '10mg'], $juan);
afirmar($estado === 403 && $r['error']['codigo'] === 'solo_inventario', 'el paciente no cambia la dosis recetada', $r);
[$estado, $r] = http('PUT', "/tratamientos/$idTrt", ['inventario' => ['cantidadRestante' => 60]], $juan);
afirmar($estado === 200 && $r['inventario']['cantidadRestante'] === 60, 'pero sí actualiza su inventario', $r);
[$estado] = http('DELETE', "/tratamientos/$idTrt", null, $elena);
[, $r] = http('GET', '/pacientes/pac_01H8X9A/tratamientos', null, $juan);
afirmar($estado === 204 && !in_array($idTrt, array_column($r, 'idTratamiento'), true), 'suspender es una baja lógica');

echo "Métricas vitales\n";
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/metricas', ['pesoKg' => 80, 'presionArterial' => '118/79', 'glucosaMgDl' => 99], $juan);
afirmar($estado === 201 && $r['imc'] === 26.1, 'calcula el IMC con la última altura', $r);
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/metricas', ['presionArterial' => '80/120'], $juan);
afirmar($estado === 422 && $r['error']['codigo'] === 'presion_invalida', 'valida la presión arterial', $r);
[$estado] = http('POST', '/pacientes/pac_01H8X9A/metricas', ['notas' => 'sin datos'], $juan);
afirmar($estado === 422, 'exige al menos una medición');

echo "Citas\n";
$lunes = (new DateTimeImmutable('next monday', $tz))->modify('+7 days')->format('Y-m-d');
[$estado, $r] = http('GET', "/citas/disponibilidad?idMedico=doc_889900A&fecha=$lunes$q", null, $juan);
$libres = array_values(array_filter($r['horarios'] ?? [], fn ($h) => $h['disponible']));
afirmar($estado === 200 && count($r['horarios']) === 16 && $libres !== [], 'calcula horarios disponibles', $r);
$slot = $libres[0]['fechaHora'];
[$estado, $r] = http('POST', '/citas', ['idMedico' => 'doc_889900A', 'fechaHora' => $slot, 'motivo' => 'Dolor de pecho leve'], $juan);
afirmar($estado === 201 && $r['estado'] === 'pendiente' && $r['fechaHora'] === $slot, 'el paciente solicita una cita', $r);
$idCita = $r['idCita'];
[$estado, $r] = http('POST', '/citas', ['idMedico' => 'doc_889900A', 'fechaHora' => $slot, 'motivo' => 'Otra'], $maria);
afirmar($estado === 409 && $r['error']['codigo'] === 'horario_ocupado', 'no permite empalmar citas', $r);
[, $r] = http('GET', "/citas/disponibilidad?idMedico=doc_889900A&fecha=$lunes$q", null, $juan);
afirmar($r['horarios'][0]['disponible'] === false, 'el horario ocupado deja de estar disponible');
[$estado, $r] = http('PUT', "/citas/$idCita", ['estado' => 'confirmada'], $elena);
afirmar($estado === 200 && $r['estado'] === 'confirmada', 'el médico confirma', $r);
[$estado, $r] = http('PUT', "/citas/$idCita", ['estado' => 'completada'], $juan);
afirmar($estado === 422 && $r['error']['codigo'] === 'transicion_invalida', 'el paciente no puede completar la cita', $r);
[$estado] = http('GET', "/citas/$idCita", null, $carlos);
afirmar($estado === 404, 'otro médico no ve la cita');
[$estado, $r] = http('PUT', "/citas/$idCita", ['estado' => 'cancelada'], $juan);
afirmar($estado === 200 && $r['estado'] === 'cancelada', 'el paciente cancela', $r);
[$estado, $r] = http('GET', '/citas?proximas=1', null, $elena);
afirmar($estado === 200 && !in_array($idCita, array_column($r, 'idCita'), true), 'las canceladas no aparecen en próximas', $r);

echo "Chat\n";
[$estado, $r] = http('GET', '/chat/conversaciones', null, $juan);
afirmar($estado === 200 && in_array('doc_889900A', array_column($r, 'idContraparte'), true), 'el paciente ve sus conversaciones', $r);
[$estado, $r] = http('POST', '/chat/doc_889900A/mensajes', ['contenido' => 'Hola doctora, ¿puedo tomar paracetamol?'], $juan);
afirmar($estado === 201 && $r['propio'] === true, 'el paciente envía un mensaje', $r);
$idMensaje = $r['idMensaje'];
[, $r] = http('GET', '/chat/conversaciones', null, $elena);
$conv = array_values(array_filter($r, fn ($c) => $c['idContraparte'] === 'pac_01H8X9A'))[0] ?? [];
afirmar(($conv['noLeidos'] ?? 0) >= 1 && ($conv['ultimoMensaje'] ?? '') === 'Hola doctora, ¿puedo tomar paracetamol?', 'el médico ve el mensaje no leído', $conv);
[$estado, $r] = http('GET', '/chat/pac_01H8X9A/mensajes', null, $elena);
afirmar($estado === 200 && end($r)['idMensaje'] === $idMensaje && end($r)['propio'] === false, 'el médico lee la conversación', $r);
[, $r] = http('GET', "/chat/pac_01H8X9A/mensajes?despuesDe=$idMensaje", null, $elena);
afirmar($r === [], 'despuesDe sólo trae mensajes nuevos', $r);
[$estado] = http('POST', '/chat/doc_112233/mensajes', ['contenido' => 'Hola'], $maria);
afirmar($estado === 403, 'no se puede escribir a un médico sin vínculo');

echo "Adjuntos del chat (audios, PDF y archivos)\n";
$pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n";
[$estado, $r] = subir('/chat/doc_889900A/adjuntos', 'estudios.pdf', 'application/pdf', $pdf, $juan, ['contenido' => 'Mis estudios']);
afirmar($estado === 201 && $r['tipo'] === 'archivo' && $r['adjunto']['nombre'] === 'estudios.pdf', 'el paciente envía un PDF', $r);
afirmar(($r['contenido'] ?? '') === 'Mis estudios' && $r['adjunto']['mime'] === 'application/pdf', 'guarda el texto y el tipo real del archivo', $r);
$idPdf = $r['idMensaje'];
[$estado, $cabeceras, $binario] = descargar("/chat/adjuntos/$idPdf", $elena);
afirmar($estado === 200 && $binario === $pdf, 'el médico descarga el adjunto intacto', $estado);
afirmar((bool) preg_grep('#Content-Type: application/pdf#i', $cabeceras), 'lo sirve con su tipo de contenido', $cabeceras);
[$estado] = descargar("/chat/adjuntos/$idPdf", $carlos);
afirmar($estado === 404, 'un tercero no puede descargar el adjunto');
[$estado] = descargar("/chat/adjuntos/$idPdf", null);
afirmar($estado === 401, 'sin sesión tampoco');

[$estado, $r] = subir('/chat/pac_01H8X9A/adjuntos', 'nota-de-voz.wav', 'audio/wav', wavDePrueba(), $elena, ['duracionSeg' => '7']);
afirmar($estado === 201 && $r['tipo'] === 'audio' && $r['adjunto']['duracionSeg'] === 7, 'el médico envía una nota de voz', $r);
[, $r] = http('GET', '/chat/doc_889900A/mensajes', null, $juan);
$ultimo = end($r);
afirmar($ultimo['tipo'] === 'audio' && $ultimo['propio'] === false && str_starts_with((string) $ultimo['adjunto']['url'], '/chat/adjuntos/'), 'el paciente recibe la nota de voz', $ultimo);
[, $r] = http('GET', '/chat/conversaciones', null, $juan);
$conv = array_values(array_filter($r, fn ($c) => $c['idContraparte'] === 'doc_889900A'))[0] ?? [];
afirmar(($conv['tipoUltimoMensaje'] ?? '') === 'audio', 'la lista de chats indica que el último mensaje es una nota de voz', $conv);

[$estado, $r] = subir('/chat/doc_889900A/adjuntos', 'virus.exe', 'application/pdf', "MZ\x90\x00\x03" . str_repeat("\x00", 200), $juan);
afirmar($estado === 415 && $r['error']['codigo'] === 'tipo_no_permitido', 'rechaza tipos no permitidos aunque mientan en el encabezado', $r);
[$estado, $r] = subir('/chat/doc_889900A/adjuntos', 'enorme.pdf', 'application/pdf', $pdf . str_repeat('A', 9 * 1024 * 1024), $juan);
afirmar($estado === 413 && $r['error']['codigo'] === 'archivo_muy_grande', 'rechaza archivos de más de 8 MB', $r['error']['codigo'] ?? $estado);
[$estado, $r] = subir('/chat/doc_112233/adjuntos', 'estudios.pdf', 'application/pdf', $pdf, $maria);
afirmar($estado === 403, 'no se pueden enviar archivos a un médico sin vínculo');

echo "Registro y control de accesos\n";
[$estado, $r] = http('POST', '/auth/registro', ['rol' => 'paciente', 'email' => 'nuevo@correo.com', 'password' => 'Segura123', 'nombre' => 'Ana', 'apellidos' => 'Torres'], null);
afirmar($estado === 201 && str_starts_with($r['usuario']['id'], 'pac_'), 'registra un paciente nuevo', $r);
$ana = $r['token'];
$idAna = $r['usuario']['id'];
[$estado] = http('POST', '/auth/registro', ['rol' => 'paciente', 'email' => 'NUEVO@correo.com', 'password' => 'Segura123', 'nombre' => 'X', 'apellidos' => 'Y'], null);
afirmar($estado === 409, 'no permite correos duplicados');
[$estado] = http('GET', "/pacientes/$idAna", null, $carlos);
afirmar($estado === 403, 'el médico no ve pacientes que no lo autorizaron');
[$estado, $r] = http('POST', "/pacientes/$idAna/accesos", ['idMedico' => 'doc_112233', 'nivelAcceso' => 'lectura'], $ana);
afirmar($estado === 201 && $r[0]['idMedico'] === 'doc_112233', 'la paciente otorga acceso', $r);
[$estado] = http('GET', "/pacientes/$idAna", null, $carlos);
afirmar($estado === 200, 'el médico ya puede ver el expediente');
[$estado] = http('DELETE', "/pacientes/$idAna/accesos/doc_112233", null, $ana);
[$estado2] = http('GET', "/pacientes/$idAna", null, $carlos);
afirmar($estado === 204 && $estado2 === 403, 'revocar el acceso lo corta de inmediato');
[$estado, $r] = http('POST', '/auth/registro', ['rol' => 'medico', 'email' => 'dra.nueva@hospital.com', 'password' => 'Segura123', 'nombre' => 'Laura', 'apellidos' => 'Díaz', 'cedulaProfesional' => '99887766', 'especialidad' => 'Pediatría'], null);
afirmar($estado === 201 && $r['usuario']['rol'] === 'medico', 'registra un médico nuevo', $r);

echo "Privacidad selectiva del expediente\n";
[$estado, $r] = http('GET', '/pacientes/pac_01H8X9A/privacidad', null, $juan);
$secciones = array_column($r['secciones'] ?? [], null, 'seccion');
afirmar(
    $estado === 200 && $secciones['alergias']['audiencias']['emergencia']['regla'] === 'siempre',
    'las alergias no son ocultables en una urgencia',
    $r
);
afirmar(
    !isset($secciones['adherencia']['audiencias']['emergencia']),
    'la adherencia nunca viaja en el escaneo RFID'
);
[$estado] = http('GET', '/pacientes/pac_01H8X9A/privacidad', null, $elena);
afirmar($estado === 403, 'el médico no puede leer las preferencias de privacidad del paciente');

[$estado, $r] = http('PUT', '/pacientes/pac_01H8X9A/privacidad', ['audiencia' => 'emergencia', 'secciones' => ['alergias' => false]], $juan);
afirmar($estado === 422 && $r['error']['codigo'] === 'seccion_no_configurable', 'y nadie puede ocultar las alergias al paramédico', $r);

[$estado] = http('PUT', '/pacientes/pac_01H8X9A/privacidad', ['audiencia' => 'medico', 'secciones' => ['adherencia' => false]], $juan);
[$estado2, $r] = http('GET', '/pacientes/pac_01H8X9A', null, $elena);
afirmar(
    $estado === 200 && $estado2 === 200 && $r['registroAdherencia'] === []
        && in_array('adherencia', $r['privacidad']['seccionesOmitidas'], true),
    'el paciente oculta su adherencia y el médico recibe el expediente sin ella',
    $r['privacidad'] ?? $r
);
[$estado, $r] = http('GET', '/pacientes/pac_01H8X9A', null, $juan);
afirmar($estado === 200 && $r['registroAdherencia'] !== [], 'pero el paciente sigue viendo su historial completo');
http('PUT', '/pacientes/pac_01H8X9A/privacidad', ['audiencia' => 'medico', 'secciones' => ['adherencia' => true]], $juan);

[$estado, $r] = http('GET', '/pacientes/pac_01H8X9A/exportacion', null, $juan);
afirmar(
    $estado === 200 && $r['expediente']['identificaciones']['curp'] === null,
    'la copia para compartir respeta la audiencia exportacion',
    $r['expediente']['identificaciones'] ?? $r
);

echo "Segmentación por enfermedad crónica\n";
[$estado, $r] = http('GET', '/segmentacion/catalogo', null, $juan);
afirmar($estado === 200 && count($r) === 5, 'el catálogo trae las cinco condiciones', $estado);

[$estado, $r] = http('GET', '/pacientes/pac_01H8X9A/cronicas/hipertension/cuestionario', null, $juan);
$ids = array_column($r['preguntas'] ?? [], 'id');
afirmar(
    $estado === 200 && in_array('ctx_reposo', $ids, true) && in_array('presion_2', $ids, true),
    'el cuestionario de hipertensión pide contexto y una segunda toma',
    $ids
);

// Dos tomas altas en buenas condiciones: riesgo confirmado y alerta al médico.
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/cronicas/hipertension/evaluaciones', ['respuestas' => [
    'ctx_reposo' => true, 'ctx_estimulante' => false, 'ctx_malestar' => false,
    'presion_1' => '156/96', 'presion_2' => '152/94', 'sintomas' => ['ninguno'], 'olvido_dosis' => 0,
]], $juan);
afirmar(
    $estado === 201 && $r['evaluacion']['segmento'] === 'riesgo' && $r['evaluacion']['severidad'] === 'atencion'
        && $r['alertasEnviadas'] >= 1,
    'presión alta confirmada en dos tomas segmenta en riesgo y alerta al médico',
    $r
);

// Una sola toma alta, la segunda normal: no basta para clasificar en riesgo.
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/cronicas/hipertension/evaluaciones', ['respuestas' => [
    'ctx_reposo' => true, 'ctx_estimulante' => false, 'ctx_malestar' => false,
    'presion_1' => '148/92', 'presion_2' => '124/78', 'sintomas' => ['ninguno'], 'olvido_dosis' => 0,
]], $juan);
afirmar(
    $estado === 201 && $r['evaluacion']['segmento'] === 'seguimiento' && $r['alertasEnviadas'] === 0,
    'una sola lectura alta sin confirmar no genera alerta',
    $r['evaluacion'] ?? $r
);

// Mismo valor alto, pero medido tras café y sin reposo: se degrada y pide repetir.
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/cronicas/hipertension/evaluaciones', ['respuestas' => [
    'ctx_reposo' => false, 'ctx_estimulante' => true, 'ctx_malestar' => false,
    'presion_1' => '158/98', 'presion_2' => '155/96', 'sintomas' => ['ninguno'], 'olvido_dosis' => 0,
]], $juan);
afirmar(
    $estado === 201 && $r['evaluacion']['confiable'] === false && $r['evaluacion']['segmento'] === 'seguimiento'
        && in_array('reco_repetir_medicion', $r['recomendaciones'], true),
    'una toma en malas condiciones no alerta: pide repetirla',
    $r
);

// Bandera roja: alerta aunque el contexto de la medición sea malo.
[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/cronicas/hipertension/evaluaciones', ['respuestas' => [
    'ctx_reposo' => false, 'ctx_estimulante' => true, 'ctx_malestar' => true,
    'presion_1' => '190/124', 'presion_2' => '188/122', 'sintomas' => ['dolor_toracico'], 'olvido_dosis' => 0,
]], $juan);
afirmar(
    $estado === 201 && $r['evaluacion']['severidad'] === 'urgente'
        && in_array('reco_urgencias', $r['recomendaciones'], true),
    'una bandera roja alerta aunque la medición no sea confiable',
    $r['evaluacion'] ?? $r
);

[$estado, $r] = http('POST', '/pacientes/pac_01H8X9A/cronicas/hipertension/evaluaciones', ['respuestas' => [
    'ctx_reposo' => true, 'ctx_estimulante' => false, 'ctx_malestar' => false,
    'presion_1' => '120/80', 'sintomas' => ['ninguno'], 'olvido_dosis' => 0,
]], $juan);
afirmar($estado === 422 && $r['error']['detalles']['campo'] === 'presion_2', 'exige la segunda toma', $r['error'] ?? $r);

[$estado] = http('POST', '/pacientes/pac_01H8X9A/cronicas/diabetes/evaluaciones', ['respuestas' => []], $juan);
afirmar($estado === 404, 'no se puede evaluar una condición que el paciente no tiene');

[$estado, $r] = http('POST', '/pacientes/pac_02J9Y8B/cronicas/diabetes/evaluaciones', ['respuestas' => [
    'ctx_reposo' => true, 'ctx_estimulante' => false, 'ctx_malestar' => false,
    'momento' => 'ayuno', 'glucosa' => 48, 'sintomas_hipo' => ['temblor', 'sudor_frio'],
    'sintomas_hiper' => ['ninguno'], 'herida_sin_cerrar' => false,
]], $maria);
afirmar(
    $estado === 201 && $r['evaluacion']['severidad'] === 'urgente',
    'una hipoglucemia severa es urgente',
    $r['evaluacion'] ?? $r
);

echo "Alertas clínicas\n";
[$estado, $r] = http('GET', '/alertas', null, $elena);
afirmar($estado === 200 && $r['pendientes'] >= 1 && $r['alertas'][0]['estado'] === 'nueva', 'el médico ve su bandeja', $r);
$idAlerta = $r['alertas'][0]['idAlerta'];
afirmar(
    $r['alertas'][0]['claveTitulo'] !== '' && !isset($r['alertas'][0]['titulo']),
    'la alerta viaja como clave de strings.xml, no como texto'
);
[$estado] = http('GET', '/alertas', null, $juan);
afirmar($estado === 403, 'un paciente no entra a la bandeja del médico');
[$estado, $r] = http('PUT', "/alertas/$idAlerta", ['estado' => 'atendida', 'notasMedico' => 'Se ajusta dosis.'], $elena);
afirmar($estado === 200 && $r['estado'] === 'atendida' && $r['fechaAtencion'] !== null, 'el médico la marca como atendida', $r);
[$estado] = http('PUT', "/alertas/$idAlerta", ['estado' => 'vista'], $carlos);
afirmar($estado === 403, 'otro médico no puede tocar una alerta ajena');
[$estado, $r] = http('GET', '/pacientes/pac_01H8X9A/alertas', null, $juan);
afirmar($estado === 200 && count($r) >= 1, 'el paciente ve qué alertas se generaron en su nombre', count($r ?? []));

[$estado, $r] = http('GET', '/chat/doc_889900A/mensajes', null, $juan);
$delSistema = array_filter($r ?? [], fn (array $m) => $m['remitente'] === 'sistema');
afirmar($delSistema !== [] && reset($delSistema)['propio'] === false, 'el aviso también queda en el chat como mensaje del sistema');

echo "\n$total pruebas, $fallos fallos\n";
exit($fallos === 0 ? 0 : 1);
