<?php
declare(strict_types=1);

/** Mensaje del chat: texto, nota de voz, imagen o documento. */
final class Mensaje extends Modelo
{
    protected static string $tabla = 'mensajes';
    protected static string|array $llave = 'id_mensaje';
    protected static string $prefijoId = 'msg';
    protected static array $columnas = [
        'secuencia' => 'entero',
        'id_mensaje' => 'texto',
        'id_paciente' => 'texto',
        'id_medico' => 'texto',
        'remitente' => 'texto',
        'tipo' => 'texto',
        'contenido' => 'texto',
        'archivo_ruta' => 'texto',
        'archivo_nombre' => 'texto',
        'archivo_mime' => 'texto',
        'archivo_bytes' => 'entero',
        'duracion_seg' => 'entero',
        'fecha_envio' => 'fechaHora',
        'leido_en' => 'fechaHora',
    ];
    protected static array $pertenece = [
        'paciente' => [Paciente::class, 'id_paciente'],
        'medico' => [Medico::class, 'id_medico'],
    ];

    public static function deConversacion(string $idPaciente, string $idMedico): Consulta
    {
        return self::donde('id_paciente', $idPaciente)->donde('id_medico', $idMedico);
    }

    public static function ultimoDe(string $idPaciente, string $idMedico): ?self
    {
        $mensaje = self::deConversacion($idPaciente, $idMedico)->ordenar('secuencia', 'DESC')->primero();
        return $mensaje instanceof self ? $mensaje : null;
    }

    public static function noLeidos(string $idPaciente, string $idMedico, string $remitente): int
    {
        return self::deConversacion($idPaciente, $idMedico)->donde('remitente', $remitente)->dondeNulo('leido_en')->contar();
    }

    /** Marca como leídos los mensajes que envió la contraparte. */
    public static function marcarLeidos(string $idPaciente, string $idMedico, string $remitente): void
    {
        self::deConversacion($idPaciente, $idMedico)
            ->donde('remitente', $remitente)
            ->dondeNulo('leido_en')
            ->actualizar(['leido_en' => ahoraSql()]);
    }

    public function esParticipante(array $sesion): bool
    {
        return ($sesion['rol'] === 'paciente' ? $this->id_paciente : $this->id_medico) === $sesion['id'];
    }

    public function aDto(string $rolSesion): array
    {
        return [
            'idMensaje' => $this->id_mensaje,
            'remitente' => $this->remitente,
            'propio' => $this->remitente === $rolSesion,
            'tipo' => $this->tipo ?? 'texto',
            'contenido' => $this->contenido,
            'adjunto' => $this->archivo_ruta === null ? null : [
                'nombre' => $this->archivo_nombre,
                'mime' => $this->archivo_mime,
                'bytes' => (int) $this->archivo_bytes,
                'duracionSeg' => $this->duracion_seg !== null ? (int) $this->duracion_seg : null,
                'url' => "/chat/adjuntos/{$this->id_mensaje}",
            ],
            'fechaEnvio' => iso($this->fecha_envio),
            'leido' => $this->leido_en !== null,
        ];
    }
}
