<?php
declare(strict_types=1);

/** Una toma registrada por el paciente: tomada, tomada tarde u omitida. */
final class RegistroAdherencia extends Modelo
{
    protected static string $tabla = 'registro_adherencia';
    protected static string|array $llave = 'id_toma';
    protected static string $prefijoId = 'log';
    protected static array $columnas = [
        'id_toma' => 'texto',
        'id_tratamiento' => 'texto',
        'id_paciente' => 'texto',
        'fecha_hora_programada' => 'fechaHora',
        'fecha_hora_real' => 'fechaHora',
        'estado' => 'texto',
        'sintomas_asociados' => 'texto',
    ];
    protected static array $pertenece = [
        'tratamiento' => [Tratamiento::class, 'id_tratamiento'],
        'paciente' => [Paciente::class, 'id_paciente'],
    ];

    public static function deToma(string $idTratamiento, string $fechaHoraProgramada): ?self
    {
        $registro = self::donde('id_tratamiento', $idTratamiento)->donde('fecha_hora_programada', $fechaHoraProgramada)->primero();
        return $registro instanceof self ? $registro : null;
    }

    public function consumeInventario(): bool
    {
        return $this->estado !== 'omitido';
    }

    /** Resumen de cumplimiento de un conjunto de registros. */
    public static function resumen(array $registros): array
    {
        $estados = array_count_values(array_map(fn (self $r) => (string) $r->estado, $registros));
        $total = count($registros);
        $cumplidas = ($estados['tomado'] ?? 0) + ($estados['tomado_tarde'] ?? 0);
        return [
            'total' => $total,
            'tomadas' => $estados['tomado'] ?? 0,
            'tomadasTarde' => $estados['tomado_tarde'] ?? 0,
            'omitidas' => $estados['omitido'] ?? 0,
            'porcentajeCumplimiento' => $total > 0 ? round($cumplidas / $total * 100, 1) : null,
        ];
    }

    public function aDto(bool $conMedicamento = false): array
    {
        $dto = [
            'idToma' => $this->id_toma,
            'idTratamiento' => $this->id_tratamiento,
            'fechaHoraProgramada' => iso($this->fecha_hora_programada),
            'fechaHoraReal' => iso($this->fecha_hora_real),
            'estado' => $this->estado,
            'sintomasAsociados' => $this->sintomas_asociados,
        ];
        if ($conMedicamento) {
            $dto['medicamento'] = $this->tratamiento?->medicamento;
        }
        return $dto;
    }
}
