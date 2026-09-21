<?php
declare(strict_types=1);

/**
 * Tipos de archivo aceptados en el chat: MIME real (detectado con finfo) => [tipo de mensaje, extensión].
 * Cubre las notas de voz del teléfono, PDF de estudios, fotos y documentos.
 */
const ADJUNTOS_PERMITIDOS = [
    'audio/webm' => ['audio', 'webm'],
    'audio/ogg' => ['audio', 'ogg'],
    'audio/mpeg' => ['audio', 'mp3'],
    'audio/mp4' => ['audio', 'm4a'],
    'audio/x-m4a' => ['audio', 'm4a'],
    'audio/aac' => ['audio', 'aac'],
    'audio/wav' => ['audio', 'wav'],
    'audio/x-wav' => ['audio', 'wav'],
    'audio/3gpp' => ['audio', '3gp'],
    'video/webm' => ['audio', 'webm'], // el navegador graba audio en contenedor webm
    'image/jpeg' => ['imagen', 'jpg'],
    'image/png' => ['imagen', 'png'],
    'image/webp' => ['imagen', 'webp'],
    'image/heic' => ['imagen', 'heic'],
    'application/pdf' => ['archivo', 'pdf'],
    'text/plain' => ['archivo', 'txt'],
    'application/msword' => ['archivo', 'doc'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => ['archivo', 'docx'],
    'application/vnd.ms-excel' => ['archivo', 'xls'],
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' => ['archivo', 'xlsx'],
    'application/zip' => ['archivo', 'zip'],
];

/** Devuelve [idPaciente, idMedico] de la conversación entre la sesión y su contraparte. */
function parConversacion(array $sesion, string $idContraparte): array
{
    $esPaciente = $sesion['rol'] === 'paciente';
    $contraparte = $esPaciente ? Medico::buscar($idContraparte) : Paciente::buscar($idContraparte);
    $par = $esPaciente ? [$sesion['id'], $idContraparte] : [$idContraparte, $sesion['id']];
    if ($contraparte === null || !puedenComunicarse(...$par)) {
        throw new HttpError(403, 'chat_no_permitido', 'Sólo puedes escribir a médicos o pacientes con los que tienes una vinculación o cita.');
    }
    return $par;
}

/** Limpia el nombre original para poder mostrarlo y descargarlo sin riesgos. */
function nombreArchivoSeguro(string $nombre, string $extension): string
{
    $nombre = str_replace(['\\', '/', '"', "\r", "\n", "\0"], '', basename($nombre));
    $nombre = trim(preg_replace('/\s+/', ' ', $nombre) ?? '');
    if ($nombre === '' || $nombre === '.' || $nombre === '..') {
        $nombre = 'adjunto.' . $extension;
    }
    return mb_substr($nombre, 0, 200);
}

function rutaAlmacenamiento(string $relativa = ''): string
{
    return rtrim(__DIR__ . '/../almacenamiento/' . ltrim($relativa, '/'), '/');
}

return function (Router $r): void {
    $r->get('/chat/conversaciones', function (): void {
        $s = sesion();
        $esPaciente = $s['rol'] === 'paciente';
        $otroRol = $esPaciente ? 'medico' : 'paciente';

        // Contrapartes: quien tiene un acceso vigente o alguna cita no cancelada.
        $columnaPropia = $esPaciente ? 'id_paciente' : 'id_medico';
        $columnaOtro = $esPaciente ? 'id_medico' : 'id_paciente';
        $ids = array_values(array_unique([
            ...AccesoMedico::vigentes()->donde($columnaPropia, $s['id'])->columnaDe($columnaOtro),
            ...Cita::donde($columnaPropia, $s['id'])->donde('estado', '<>', 'cancelada')->columnaDe($columnaOtro),
        ]));

        $clase = $esPaciente ? Medico::class : Paciente::class;
        $contrapartes = $ids === [] ? [] : $clase::consulta()->dondeEn($clase::llavePrimaria(), $ids)->obtener();

        $conversaciones = array_map(function (Modelo $contraparte) use ($s, $esPaciente, $otroRol): array {
            $id = (string) $contraparte->llaveSimple();
            [$idPaciente, $idMedico] = $esPaciente ? [$s['id'], $id] : [$id, $s['id']];
            $ultimo = Mensaje::ultimoDe($idPaciente, $idMedico);
            return [
                'idContraparte' => $id,
                'rolContraparte' => $otroRol,
                'nombre' => $contraparte->nombreCompleto(),
                'subtitulo' => $esPaciente ? $contraparte->especialidad : null,
                'ultimoMensaje' => $ultimo?->contenido,
                'tipoUltimoMensaje' => $ultimo?->tipo,
                'fechaUltimoMensaje' => iso($ultimo?->fecha_envio),
                'noLeidos' => Mensaje::noLeidos($idPaciente, $idMedico, $otroRol),
            ];
        }, $contrapartes);

        usort($conversaciones, fn (array $a, array $b) => strcmp($b['fechaUltimoMensaje'] ?? '', $a['fechaUltimoMensaje'] ?? '')
            ?: strcmp($a['nombre'], $b['nombre']));
        responder($conversaciones);
    });

    // Descarga de un adjunto. Sólo los dos participantes de la conversación pueden abrirlo.
    $r->get('/chat/adjuntos/{idMensaje}', function (array $p): void {
        $s = sesion();
        $mensaje = Mensaje::buscar($p['idMensaje']);
        if ($mensaje === null || !$mensaje->esParticipante($s) || $mensaje->archivo_ruta === null) {
            throw new HttpError(404, 'adjunto_no_encontrado', 'El adjunto no existe.');
        }
        $ruta = rutaAlmacenamiento((string) $mensaje->archivo_ruta);
        if (!is_file($ruta)) {
            throw new HttpError(404, 'adjunto_no_encontrado', 'El archivo ya no está disponible en el servidor.');
        }
        header('Content-Type: ' . $mensaje->archivo_mime);
        header('Content-Length: ' . (string) filesize($ruta));
        header('Content-Disposition: inline; filename="' . nombreArchivoSeguro((string) $mensaje->archivo_nombre, 'bin') . '"');
        header('Cache-Control: private, max-age=3600');
        header('X-Content-Type-Options: nosniff');
        readfile($ruta);
        exit;
    });

    // `despuesDe` permite al cliente pedir sólo los mensajes nuevos (sondeo periódico).
    $r->get('/chat/{idContraparte}/mensajes', function (array $p): void {
        $s = sesion();
        [$idPaciente, $idMedico] = parConversacion($s, $p['idContraparte']);
        $otroRol = $s['rol'] === 'paciente' ? 'medico' : 'paciente';

        $consulta = Mensaje::deConversacion($idPaciente, $idMedico);
        $despuesDe = parametro('despuesDe');
        if ($despuesDe !== null) {
            $referencia = Mensaje::buscar($despuesDe);
            $consulta->donde('secuencia', '>', (int) ($referencia?->secuencia ?? 0));
        }
        $mensajes = array_reverse($consulta->ordenar('secuencia', 'DESC')->limitar(200)->obtener());

        Mensaje::marcarLeidos($idPaciente, $idMedico, $otroRol);
        responder(array_map(fn (Mensaje $m) => $m->aDto($s['rol']), $mensajes));
    });

    $r->post('/chat/{idContraparte}/mensajes', function (array $p): void {
        $s = sesion();
        [$idPaciente, $idMedico] = parConversacion($s, $p['idContraparte']);
        $mensaje = Mensaje::crear([
            'id_paciente' => $idPaciente, 'id_medico' => $idMedico, 'remitente' => $s['rol'],
            'tipo' => 'texto', 'contenido' => texto(cuerpoJson(), 'contenido', true, 2000), 'fecha_envio' => ahoraSql(),
        ]);
        responder($mensaje->aDto($s['rol']), 201);
    });

    /**
     * Envía una nota de voz, un PDF, una foto o un documento (multipart/form-data).
     * Campos: `archivo` (obligatorio), `contenido` (texto opcional), `duracionSeg` (audios).
     */
    $r->post('/chat/{idContraparte}/adjuntos', function (array $p): void {
        $s = sesion();
        [$idPaciente, $idMedico] = parConversacion($s, $p['idContraparte']);
        $subida = $_FILES['archivo'] ?? null;
        $maximo = (int) config('max_bytes_adjunto');

        if (!is_array($subida) || ($subida['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            throw new HttpError(422, 'archivo_requerido', 'Adjunta un archivo.');
        }
        if (in_array($subida['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
            throw new HttpError(413, 'archivo_muy_grande', 'El archivo supera el tamaño permitido.');
        }
        if ($subida['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($subida['tmp_name'])) {
            throw new HttpError(400, 'subida_fallida', 'No se pudo recibir el archivo.');
        }
        if ((int) $subida['size'] > $maximo) {
            throw new HttpError(413, 'archivo_muy_grande', 'El archivo supera el tamaño permitido.');
        }

        // El tipo se detecta del contenido real, nunca del encabezado que envía el cliente.
        $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($subida['tmp_name']);
        if (!isset(ADJUNTOS_PERMITIDOS[$mime])) {
            throw new HttpError(415, 'tipo_no_permitido', 'Ese tipo de archivo no se puede enviar por el chat.');
        }
        [$tipo, $extension] = ADJUNTOS_PERMITIDOS[$mime];

        $id = nuevoId('msg');
        $relativa = "chat/$id.$extension";
        $destino = rutaAlmacenamiento($relativa);
        if (!is_dir(dirname($destino))) {
            mkdir(dirname($destino), 0775, true);
        }
        if (!move_uploaded_file($subida['tmp_name'], $destino)) {
            throw new HttpError(500, 'subida_fallida', 'No se pudo guardar el archivo.');
        }

        $nombre = nombreArchivoSeguro((string) ($subida['name'] ?? ''), $extension);
        $duracion = entero($_POST, 'duracionSeg', false, 1, 3600);
        $contenido = texto($_POST, 'contenido', false, 2000) ?? $nombre;

        $mensaje = Mensaje::crear([
            'id_mensaje' => $id,
            'id_paciente' => $idPaciente,
            'id_medico' => $idMedico,
            'remitente' => $s['rol'],
            'tipo' => $tipo,
            'contenido' => $contenido,
            'archivo_ruta' => $relativa,
            'archivo_nombre' => $nombre,
            'archivo_mime' => $mime,
            'archivo_bytes' => (int) $subida['size'],
            'duracion_seg' => $tipo === 'audio' ? $duracion : null,
            'fecha_envio' => ahoraSql(),
        ]);
        responder($mensaje->aDto($s['rol']), 201);
    });
};
