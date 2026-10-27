<?php
declare(strict_types=1);

/**
 * Documento del expediente: foto de una receta, estudio escaneado, PDF de laboratorio…
 * `metadatos` guarda el EXIF de la imagen (cámara, fecha de captura, GPS) tal como se leyó.
 */
final class DocumentoMedico extends Modelo
{
    protected static string $tabla = 'documentos_medicos';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'doc';
    protected static array $columnas = [
        'id' => 'texto',
        'id_paciente' => 'texto',
        'categoria' => 'texto',
        'titulo' => 'texto',
        'fecha_documento' => 'fecha',
        'notas' => 'texto',
        'origen' => 'texto',
        'archivo_ruta' => 'texto',
        'archivo_nombre' => 'texto',
        'archivo_mime' => 'texto',
        'archivo_bytes' => 'entero',
        'metadatos' => 'json',
        'subido_por' => 'texto',
        'subido_por_rol' => 'texto',
        'fecha_subida' => 'fechaHora',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function aDto(): array
    {
        return [
            'id' => $this->id,
            'categoria' => $this->categoria,
            'titulo' => $this->titulo,
            'fechaDocumento' => $this->fecha_documento,
            'notas' => $this->notas,
            'origen' => $this->origen,
            'archivo' => [
                'nombre' => $this->archivo_nombre,
                'mime' => $this->archivo_mime,
                'bytes' => (int) $this->archivo_bytes,
                'url' => "/pacientes/{$this->id_paciente}/documentos/{$this->id}/archivo",
            ],
            'metadatos' => $this->metadatos ?: null,
            'subidoPorRol' => $this->subido_por_rol,
            'fechaSubida' => iso($this->fecha_subida),
        ];
    }
}
