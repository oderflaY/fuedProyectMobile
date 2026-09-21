<?php
declare(strict_types=1);

final class Tratamiento extends Modelo
{
    protected static string $tabla = 'tratamientos';
    protected static string|array $llave = 'id_tratamiento';
    protected static string $prefijoId = 'trt';
    protected static array $columnas = [
        'id_tratamiento' => 'texto',
        'id_paciente' => 'texto',
        'medicamento' => 'texto',
        'dosis' => 'texto',
        'frecuencia_horas' => 'entero',
        'horarios_sugeridos' => 'json',
        'via_administracion' => 'texto',
        'fecha_inicio' => 'fecha',
        'fecha_fin' => 'fecha',
        'id_medico_receta' => 'texto',
        'cantidad_restante' => 'entero',
        'umbral_alerta' => 'entero',
        'activo' => 'booleano',
        'fecha_creacion' => 'fechaHora',
    ];
    protected static array $pertenece = [
        'paciente' => [Paciente::class, 'id_paciente'],
        'medicoReceta' => [Medico::class, 'id_medico_receta'],
    ];

    /** Tratamientos vigentes de un paciente en una fecha de calendario. */
    public static function vigentesEn(string $idPaciente, string $fecha): array
    {
        return self::donde('id_paciente', $idPaciente)
            ->donde('activo', true)
            ->donde('fecha_inicio', '<=', $fecha)
            ->dondeCrudo('fecha_fin IS NULL OR fecha_fin >= ?', [$fecha])
            ->obtener();
    }

    public function registros(): Consulta
    {
        return $this->tieneMuchos(RegistroAdherencia::class, 'id_tratamiento');
    }

    public function loRecetoUnMedico(): bool
    {
        return $this->id_medico_receta !== null;
    }

    public function inventarioBajo(): bool
    {
        return (int) $this->cantidad_restante <= (int) $this->umbral_alerta;
    }

    /** Un tratamiento cada 48 h o 72 h sólo aplica algunos días. */
    public function aplicaEnFecha(string $fecha): bool
    {
        $frecuencia = (int) $this->frecuencia_horas;
        if ($frecuencia <= 24) {
            return true;
        }
        $dias = (new DateTimeImmutable((string) $this->fecha_inicio))->diff(new DateTimeImmutable($fecha))->days;
        return $dias % max(1, intdiv($frecuencia, 24)) === 0;
    }

    public function ajustarInventario(int $delta): void
    {
        $this->cantidad_restante = max(0, (int) $this->cantidad_restante + $delta);
        $this->guardar();
    }

    /** Baja lógica: se conserva el historial de tomas. */
    public function suspender(string $fechaLocal): void
    {
        $this->activo = false;
        $fin = $this->fecha_fin;
        $this->fecha_fin = $fin === null ? $fechaLocal : min((string) $fin, $fechaLocal);
        $this->guardar();
    }

    public function aDto(): array
    {
        return [
            'idTratamiento' => $this->id_tratamiento,
            'medicamento' => $this->medicamento,
            'dosis' => $this->dosis,
            'frecuenciaHoras' => (int) $this->frecuencia_horas,
            'horariosSugeridos' => $this->horarios_sugeridos ?: [],
            'viaAdministracion' => $this->via_administracion,
            'fechaInicio' => $this->fecha_inicio,
            'fechaFin' => $this->fecha_fin,
            'idMedicoReceta' => $this->id_medico_receta,
            'inventario' => [
                'cantidadRestante' => (int) $this->cantidad_restante,
                'umbralAlerta' => (int) $this->umbral_alerta,
            ],
            'activo' => (bool) $this->activo,
        ];
    }
}
