<?php
declare(strict_types=1);

final class Cita extends Modelo
{
    protected static string $tabla = 'citas';
    protected static string|array $llave = 'id_cita';
    protected static string $prefijoId = 'cit';
    protected static array $columnas = [
        'id_cita' => 'texto',
        'id_paciente' => 'texto',
        'id_medico' => 'texto',
        'fecha_hora' => 'fechaHora',
        'duracion_min' => 'entero',
        'motivo' => 'texto',
        'estado' => 'texto',
        'notas_medico' => 'texto',
        'creado_por' => 'texto',
        'fecha_creacion' => 'fechaHora',
        'fecha_actualizacion' => 'fechaHora',
    ];
    protected static array $pertenece = [
        'paciente' => [Paciente::class, 'id_paciente'],
        'medico' => [Medico::class, 'id_medico'],
    ];

    /** Transiciones de estado permitidas según quién las pide. */
    private const TRANSICIONES_PACIENTE = ['pendiente' => ['cancelada'], 'confirmada' => ['cancelada']];
    private const TRANSICIONES_MEDICO = ['pendiente' => ['confirmada', 'cancelada'], 'confirmada' => ['completada', 'cancelada']];

    public static function activas(): Consulta
    {
        return self::consulta()->dondeCrudo("estado IN ('pendiente', 'confirmada')");
    }

    public function estaActiva(): bool
    {
        return in_array((string) $this->estado, ['pendiente', 'confirmada'], true);
    }

    public function inicioEnSegundos(): int
    {
        return (int) strtotime((string) $this->fecha_hora . ' UTC');
    }

    public function finEnSegundos(): int
    {
        return $this->inicioEnSegundos() + (int) $this->duracion_min * 60;
    }

    public function esParticipante(array $sesion): bool
    {
        return ($sesion['rol'] === 'paciente' ? $this->id_paciente : $this->id_medico) === $sesion['id'];
    }

    public function puedeCambiarA(string $nuevoEstado, string $rol): bool
    {
        if ($nuevoEstado === $this->estado) {
            return true;
        }
        $transiciones = $rol === 'paciente' ? self::TRANSICIONES_PACIENTE : self::TRANSICIONES_MEDICO;
        return in_array($nuevoEstado, $transiciones[(string) $this->estado] ?? [], true);
    }

    /**
     * Lanza 409 si el médico o el paciente ya tienen una cita activa que se traslape.
     */
    public static function validarSinTraslape(string $idMedico, string $idPaciente, string $inicioSql, int $duracionMin, ?string $excluirCita = null): void
    {
        $inicio = (int) strtotime($inicioSql . ' UTC');
        $fin = $inicio + $duracionMin * 60;
        $candidatas = self::activas()
            ->dondeCrudo('id_medico = ? OR id_paciente = ?', [$idMedico, $idPaciente])
            ->donde('fecha_hora', '<', gmdate('Y-m-d H:i:s', $fin))
            ->donde('fecha_hora', '>=', gmdate('Y-m-d H:i:s', $inicio - 4 * 3600))
            ->donde('id_cita', '<>', $excluirCita ?? '')
            ->obtener();

        foreach ($candidatas as $cita) {
            if ($cita->inicioEnSegundos() < $fin && $cita->finEnSegundos() > $inicio) {
                throw $cita->id_medico === $idMedico
                    ? new HttpError(409, 'horario_ocupado', 'El médico ya tiene una cita en ese horario.')
                    : new HttpError(409, 'paciente_con_cita', 'Ya tienes otra cita en ese horario.');
            }
        }
    }

    public function aDto(): array
    {
        $paciente = $this->paciente;
        $medico = $this->medico;
        return [
            'idCita' => $this->id_cita,
            'idPaciente' => $this->id_paciente,
            'nombrePaciente' => $paciente?->nombreCompleto() ?? '',
            'idMedico' => $this->id_medico,
            'nombreMedico' => $medico?->nombreCompleto() ?? '',
            'especialidad' => $medico?->especialidad,
            'nombreClinica' => $medico?->nombre_clinica,
            'direccion' => $medico?->direccion,
            'fechaHora' => iso($this->fecha_hora),
            'duracionMin' => (int) $this->duracion_min,
            'motivo' => $this->motivo,
            'estado' => $this->estado,
            'notasMedico' => $this->notas_medico,
            'creadoPor' => $this->creado_por,
            'fechaCreacion' => iso($this->fecha_creacion),
            'fechaActualizacion' => iso($this->fecha_actualizacion),
        ];
    }
}
