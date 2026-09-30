<?php
declare(strict_types=1);

/**
 * Alerta dirigida al médico tratante.
 *
 * El texto visible no se guarda: se almacena la clave de strings.xml más sus
 * parámetros, y la app la traduce (DM_Arquitectura_App.md, sección 5). El aviso
 * que además se manda al chat sí se redacta aquí, porque un mensaje ya enviado
 * es un dato histórico de la conversación y no puede cambiar de idioma después.
 */
final class AlertaClinica extends Modelo
{
    protected static string $tabla = 'alertas_clinicas';
    protected static string|array $llave = 'id_alerta';
    protected static string $prefijoId = 'alr';
    protected static array $columnas = [
        'id_alerta' => 'texto',
        'id_paciente' => 'texto',
        'id_medico' => 'texto',
        'id_evaluacion' => 'texto',
        'origen' => 'texto',
        'condicion' => 'texto',
        'severidad' => 'texto',
        'clave_titulo' => 'texto',
        'clave_detalle' => 'texto',
        'datos' => 'json',
        'estado' => 'texto',
        'fecha_creacion' => 'fechaHora',
        'fecha_atencion' => 'fechaHora',
        'notas_medico' => 'texto',
    ];
    protected static array $pertenece = [
        'paciente' => [Paciente::class, 'id_paciente'],
        'medico' => [Medico::class, 'id_medico'],
    ];

    /** Ventana en la que no se repite una alerta equivalente, para no saturar al médico. */
    private const HORAS_SIN_REPETIR = 12;

    public static function deMedico(string $idMedico, ?string $estado = null): Consulta
    {
        $consulta = self::donde('id_medico', $idMedico);
        if ($estado !== null) {
            $consulta->donde('estado', $estado);
        }
        return $consulta->ordenar('fecha_creacion', 'DESC');
    }

    public static function pendientesDe(string $idMedico): int
    {
        return self::donde('id_medico', $idMedico)->donde('estado', 'nueva')->contar();
    }

    /** ¿Ya hay una alerta igual sin atender dentro de la ventana? */
    private static function yaAvisado(string $idPaciente, string $idMedico, ?string $condicion, string $severidad): bool
    {
        $desde = sqlUtc(new DateTimeImmutable('-' . self::HORAS_SIN_REPETIR . ' hours'));
        $consulta = self::donde('id_paciente', $idPaciente)
            ->donde('id_medico', $idMedico)
            ->donde('severidad', $severidad)
            ->donde('estado', '<>', 'atendida')
            ->donde('fecha_creacion', '>=', $desde);
        $condicion === null ? $consulta->dondeNulo('condicion') : $consulta->donde('condicion', $condicion);
        return $consulta->existe();
    }

    /**
     * Genera las alertas de una evaluación para cada médico con acceso vigente.
     * Las urgentes no se pueden silenciar; las de atención respetan la
     * preferencia `notificaciones_urgencia` del médico.
     *
     * @return array<int, self>
     */
    public static function desdeEvaluacion(Paciente $paciente, EvaluacionCronica $evaluacion): array
    {
        if (!in_array($evaluacion->severidad, ['atencion', 'urgente'], true)) {
            return [];
        }
        $idPaciente = (string) $paciente->id_paciente;
        $severidad = (string) $evaluacion->severidad;
        $condicion = (string) $evaluacion->condicion;
        $creadas = [];

        foreach ($paciente->accesosVigentes() as $acceso) {
            $idMedico = (string) $acceso->id_medico;
            $medico = $acceso->medico;
            if ($severidad === 'atencion' && $medico !== null && !$medico->notificaciones_urgencia) {
                continue;
            }
            if (self::yaAvisado($idPaciente, $idMedico, $condicion, $severidad)) {
                continue;
            }

            $alerta = self::crear([
                'id_paciente' => $idPaciente,
                'id_medico' => $idMedico,
                'id_evaluacion' => (string) $evaluacion->id_evaluacion,
                'origen' => 'segmentacion',
                'condicion' => $condicion,
                'severidad' => $severidad,
                'clave_titulo' => "alerta_titulo_$severidad",
                'clave_detalle' => 'alerta_detalle_segmentacion',
                'datos' => [
                    'paciente' => $paciente->nombreCompleto(),
                    'condicion' => $condicion,
                    'segmento' => $evaluacion->segmento,
                    'banderas' => array_column((array) $evaluacion->banderas, 'codigo'),
                    'confiable' => (bool) $evaluacion->confiable,
                ],
                'estado' => 'nueva',
                'fecha_creacion' => ahoraSql(),
            ]);
            $alerta->avisarPorChat($paciente);
            $creadas[] = $alerta;
        }
        return $creadas;
    }

    /** Deja además el aviso en la conversación, para que no dependa de abrir la bandeja. */
    public function avisarPorChat(Paciente $paciente): void
    {
        Mensaje::crear([
            'id_paciente' => (string) $this->id_paciente,
            'id_medico' => (string) $this->id_medico,
            'remitente' => 'sistema',
            'tipo' => 'texto',
            'contenido' => $this->textoChat($paciente),
            'fecha_envio' => ahoraSql(),
        ]);
    }

    private function textoChat(Paciente $paciente): string
    {
        $condiciones = [
            'hipertension' => 'hipertensión',
            'diabetes' => 'diabetes',
            'asma_epoc' => 'asma o EPOC',
            'cardiopatia' => 'cardiopatía',
            'renal' => 'enfermedad renal',
        ];
        $condicion = $condiciones[(string) $this->condicion] ?? (string) $this->condicion;
        $encabezado = $this->severidad === 'urgente'
            ? 'Alerta urgente del sistema'
            : 'Alerta de seguimiento del sistema';
        $banderas = implode(', ', array_map('strval', (array) ($this->datos['banderas'] ?? [])));
        $detalle = $banderas === '' ? '' : " Hallazgos: $banderas.";
        $aviso = ((bool) ($this->datos['confiable'] ?? true)) ? '' : ' La medición se registró en condiciones no ideales.';

        return "$encabezado. {$paciente->nombreCompleto()} completó su cuestionario de $condicion "
            . "y quedó en segmento {$this->datos['segmento']}.$detalle$aviso";
    }

    public function marcar(string $estado, ?string $notas = null): void
    {
        $this->estado = $estado;
        if ($estado === 'atendida') {
            $this->fecha_atencion = ahoraSql();
            $this->notas_medico = $notas;
        }
        $this->guardar();
    }

    public function aDto(): array
    {
        $paciente = $this->paciente;
        return [
            'idAlerta' => $this->id_alerta,
            'idPaciente' => $this->id_paciente,
            'nombrePaciente' => $paciente?->nombreCompleto() ?? '',
            'idEvaluacion' => $this->id_evaluacion,
            'origen' => $this->origen,
            'condicion' => $this->condicion,
            'severidad' => $this->severidad,
            'claveTitulo' => $this->clave_titulo,
            'claveDetalle' => $this->clave_detalle,
            'datos' => (array) $this->datos,
            'estado' => $this->estado,
            'fechaCreacion' => iso($this->fecha_creacion),
            'fechaAtencion' => iso($this->fecha_atencion),
            'notasMedico' => $this->notas_medico,
        ];
    }
}
