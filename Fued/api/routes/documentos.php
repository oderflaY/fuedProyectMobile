<?php
declare(strict_types=1);

/** Archivos que acepta el expediente: MIME real (finfo) => extensión. */
const DOCUMENTOS_PERMITIDOS = [
    'image/jpeg' => 'jpg',
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/heic' => 'heic',
    'application/pdf' => 'pdf',
];

const CATEGORIAS_DOCUMENTO = ['receta', 'laboratorio', 'imagenologia', 'nota_medica', 'identificacion', 'seguro', 'otro'];
const ORIGENES_DOCUMENTO = ['camara', 'escaner', 'galeria', 'archivo'];

/** Límite del JSON de metadatos que manda la app (EXIF ya leído en el teléfono). */
const MAX_BYTES_METADATOS = 32 * 1024;

/**
 * Metadatos que manda la app como JSON. Sólo se aceptan pares simples (texto, número,
 * booleano) agrupados a lo más en un nivel, para que nadie guarde estructuras arbitrarias.
 */
function metadatosDeCliente(?string $json): ?array
{
    if ($json === null || trim($json) === '') {
        return null;
    }
    if (strlen($json) > MAX_BYTES_METADATOS) {
        throw errorCampo('campo_muy_largo', 'metadatos', 'Los metadatos son demasiado grandes.');
    }
    $datos = json_decode($json, true, 4);
    if (!is_array($datos)) {
        throw errorCampo('campo_invalido', 'metadatos', 'Los metadatos deben ser un objeto JSON.');
    }
    $limpios = [];
    foreach ($datos as $grupo => $valores) {
        if (!is_array($valores)) {
            continue;
        }
        foreach ($valores as $clave => $valor) {
            if (is_scalar($valor)) {
                $limpios[mb_substr((string) $grupo, 0, 40)][mb_substr((string) $clave, 0, 60)] =
                    is_string($valor) ? mb_substr($valor, 0, 300) : $valor;
            }
        }
    }
    return $limpios ?: null;
}

/** Respaldo: si la app no pudo leer el EXIF, PHP lo intenta con la extensión exif. */
function metadatosDeServidor(string $ruta, string $mime): ?array
{
    if ($mime !== 'image/jpeg' || !function_exists('exif_read_data')) {
        return null;
    }
    try {
        // El manejador global vuelve excepción cualquier warning, y un EXIF dañado no debe tumbar la subida.
        $exif = exif_read_data($ruta, null, true);
    } catch (Throwable) {
        return null;
    }
    if (!is_array($exif)) {
        return null;
    }
    $campos = [
        'camara' => ['IFD0' => ['Make' => 'marca', 'Model' => 'modelo', 'Software' => 'software']],
        'captura' => ['EXIF' => [
            'DateTimeOriginal' => 'fechaOriginal', 'ExposureTime' => 'exposicion', 'FNumber' => 'apertura',
            'ISOSpeedRatings' => 'iso', 'FocalLength' => 'distanciaFocal', 'Flash' => 'flash',
        ]],
        'imagen' => ['COMPUTED' => ['Width' => 'ancho', 'Height' => 'alto'], 'IFD0' => ['Orientation' => 'orientacion']],
        'rastreo' => [
            'IFD0' => ['Artist' => 'autor', 'ImageDescription' => 'descripcion'],
            'EXIF' => ['ImageUniqueID' => 'idEscaneo'],
        ],
    ];
    $resultado = [];
    foreach ($campos as $grupo => $secciones) {
        foreach ($secciones as $seccion => $mapa) {
            foreach ($mapa as $origen => $destino) {
                $valor = $exif[$seccion][$origen] ?? null;
                if (is_scalar($valor) && $valor !== '') {
                    $resultado[$grupo][$destino] = is_string($valor) ? mb_substr(trim($valor), 0, 120) : $valor;
                }
            }
        }
    }
    // El escáner de la app deja en UserComment un JSON con expediente, quién escaneó y la página.
    $comentario = $exif['COMPUTED']['UserComment'] ?? $exif['EXIF']['UserComment'] ?? null;
    if (is_string($comentario)) {
        $comentario = trim((string) preg_replace('/^(ASCII|UNICODE)\\0*/', '', $comentario), "\0 ");
        $datos = json_decode($comentario, true, 2);
        foreach (is_array($datos) ? $datos : [] as $clave => $valor) {
            if (is_scalar($valor)) {
                $resultado['rastreo'][mb_substr((string) $clave, 0, 40)] = is_string($valor) ? mb_substr($valor, 0, 120) : $valor;
            }
        }
    }
    $gps = $exif['GPS'] ?? null;
    if (is_array($gps) && isset($gps['GPSLatitude'], $gps['GPSLongitude'])) {
        $grados = static function (array $partes, string $ref): float {
            $n = array_map(static function ($p): float {
                [$a, $b] = array_map('floatval', explode('/', (string) $p) + [1, 1]);
                return $b == 0.0 ? 0.0 : $a / $b;
            }, $partes);
            $valor = ($n[0] ?? 0) + ($n[1] ?? 0) / 60 + ($n[2] ?? 0) / 3600;
            return in_array($ref, ['S', 'W'], true) ? -$valor : $valor;
        };
        $resultado['ubicacion'] = [
            'latitud' => round($grados((array) $gps['GPSLatitude'], (string) ($gps['GPSLatitudeRef'] ?? 'N')), 6),
            'longitud' => round($grados((array) $gps['GPSLongitude'], (string) ($gps['GPSLongitudeRef'] ?? 'E')), 6),
        ];
    }
    return $resultado ?: null;
}

function documentoDe(string $idPaciente, string $idDocumento): DocumentoMedico
{
    $documento = DocumentoMedico::buscar($idDocumento);
    if (!$documento instanceof DocumentoMedico || $documento->id_paciente !== $idPaciente) {
        throw new HttpError(404, 'documento_no_encontrado', 'El documento no existe.');
    }
    return $documento;
}

/** Leer documentos exige acceso al expediente y que el paciente no se los haya ocultado al médico. */
function autorizarDocumentos(array $sesion, string $idPaciente, bool $escritura = false): void
{
    autorizarPaciente($sesion, $idPaciente, $escritura);
    if (!seccionVisibleParaSesion($sesion, $idPaciente, 'documentos')) {
        throw new HttpError(403, 'seccion_privada', 'El paciente decidió no compartir sus documentos.');
    }
}

return function (Router $r): void {
    $r->get('/pacientes/{id}/documentos', function (array $p): void {
        $s = sesion();
        autorizarPaciente($s, $p['id']);
        if (!seccionVisibleParaSesion($s, $p['id'], 'documentos')) {
            responder([]);
        }
        $documentos = DocumentoMedico::donde('id_paciente', $p['id'])->ordenar('fecha_subida', 'DESC')->obtener();
        responder(array_map(fn (DocumentoMedico $d) => $d->aDto(), $documentos));
    });

    /**
     * Sube una foto, un escaneo o un PDF (multipart/form-data).
     * Campos: `archivo`, `titulo`, `categoria`, `origen`, `fechaDocumento`, `notas`, `metadatos` (JSON).
     */
    $r->post('/pacientes/{id}/documentos', function (array $p): void {
        $s = sesion();
        autorizarDocumentos($s, $p['id'], true);
        $subida = $_FILES['archivo'] ?? null;
        $maximo = (int) config('max_bytes_documento');

        if (!is_array($subida) || ($subida['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE) {
            throw new HttpError(422, 'archivo_requerido', 'Adjunta un archivo.');
        }
        if (in_array($subida['error'], [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true) || (int) $subida['size'] > $maximo) {
            throw new HttpError(413, 'archivo_muy_grande', 'El archivo supera el tamaño permitido.');
        }
        if ($subida['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($subida['tmp_name'])) {
            throw new HttpError(400, 'subida_fallida', 'No se pudo recibir el archivo.');
        }

        $mime = (string) (new finfo(FILEINFO_MIME_TYPE))->file($subida['tmp_name']);
        $extension = DOCUMENTOS_PERMITIDOS[$mime] ?? null;
        if ($extension === null) {
            throw new HttpError(415, 'tipo_no_permitido', 'Sólo se aceptan fotos (JPG, PNG, WEBP, HEIC) y PDF.');
        }

        $titulo = (string) texto($_POST, 'titulo', true, 160);
        $categoria = opcion($_POST, 'categoria', CATEGORIAS_DOCUMENTO, false) ?? 'otro';
        $origen = opcion($_POST, 'origen', ORIGENES_DOCUMENTO, false) ?? 'archivo';
        $fechaDocumento = fecha($_POST, 'fechaDocumento', false);
        $notas = texto($_POST, 'notas', false, 500);
        $metadatos = metadatosDeCliente(isset($_POST['metadatos']) ? (string) $_POST['metadatos'] : null)
            ?? metadatosDeServidor($subida['tmp_name'], $mime);

        $id = nuevoId('doc');
        $relativa = "documentos/{$p['id']}/$id.$extension";
        $destino = rutaAlmacenamiento($relativa);
        if (!is_dir(dirname($destino))) {
            mkdir(dirname($destino), 0775, true);
        }
        if (!move_uploaded_file($subida['tmp_name'], $destino)) {
            throw new HttpError(500, 'subida_fallida', 'No se pudo guardar el archivo.');
        }

        $documento = DocumentoMedico::crear([
            'id' => $id,
            'id_paciente' => $p['id'],
            'categoria' => $categoria,
            'titulo' => $titulo,
            'fecha_documento' => $fechaDocumento,
            'notas' => $notas,
            'origen' => $origen,
            'archivo_ruta' => $relativa,
            'archivo_nombre' => nombreArchivoSeguro((string) ($subida['name'] ?? ''), $extension),
            'archivo_mime' => $mime,
            'archivo_bytes' => (int) $subida['size'],
            'metadatos' => $metadatos,
            'subido_por' => $s['id'],
            'subido_por_rol' => $s['rol'],
            'fecha_subida' => ahoraSql(),
        ]);
        responder($documento->aDto(), 201);
    });

    $r->get('/pacientes/{id}/documentos/{idDocumento}/archivo', function (array $p): void {
        autorizarDocumentos(sesion(), $p['id']);
        $documento = documentoDe($p['id'], $p['idDocumento']);
        $ruta = rutaAlmacenamiento((string) $documento->archivo_ruta);
        if (!is_file($ruta)) {
            throw new HttpError(404, 'documento_no_encontrado', 'El archivo ya no está disponible en el servidor.');
        }
        header('Content-Type: ' . $documento->archivo_mime);
        header('Content-Length: ' . filesize($ruta));
        header('Content-Disposition: inline; filename="' . $documento->archivo_nombre . '"');
        header('Cache-Control: private, max-age=86400');
        header('X-Content-Type-Options: nosniff');
        readfile($ruta);
        exit;
    });

    $r->delete('/pacientes/{id}/documentos/{idDocumento}', function (array $p): void {
        autorizarDocumentos(sesion(), $p['id'], true);
        $documento = documentoDe($p['id'], $p['idDocumento']);
        $ruta = rutaAlmacenamiento((string) $documento->archivo_ruta);
        $documento->eliminar();
        if (is_file($ruta)) {
            unlink($ruta);
        }
        responder(null, 204);
    });
};
