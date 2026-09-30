<?php
declare(strict_types=1);

/** Enfermedad crónica declarada por el paciente, con su referencia personal. */
final class PerfilCronico extends Modelo
{
    protected static string $tabla = 'perfiles_cronicos';
    protected static string|array $llave = 'id_perfil';
    protected static string $prefijoId = 'prf';
    protected static array $columnas = [
        'id_perfil' => 'texto',
        'id_paciente' => 'texto',
        'condicion' => 'texto',
        'estado' => 'texto',
        'segmento' => 'texto',
        'datos_basales' => 'json',
        'fecha_alta' => 'fechaHora',
        'fecha_evaluacion' => 'fechaHora',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    /** @return array<int, self> */
    public static function activosDe(string $idPaciente): array
    {
        return self::donde('id_paciente', $idPaciente)->donde('estado', 'activo')->ordenar('condicion')->obtener();
    }

    public static function de(string $idPaciente, string $condicion): ?self
    {
        $perfil = self::donde('id_paciente', $idPaciente)->donde('condicion', $condicion)->primero();
        return $perfil instanceof self ? $perfil : null;
    }

    public function basales(): array
    {
        return basalesConDefectos((string) $this->condicion, $this->datos_basales);
    }

    /** @return array<int, EvaluacionCronica> */
    public function evaluaciones(int $limite = 20): array
    {
        return $this->tieneMuchos(EvaluacionCronica::class, 'id_perfil')
            ->ordenar('fecha', 'DESC')->limitar($limite)->obtener();
    }

    public function ultimaEvaluacion(): ?EvaluacionCronica
    {
        $evaluacion = $this->tieneMuchos(EvaluacionCronica::class, 'id_perfil')->ordenar('fecha', 'DESC')->primero();
        return $evaluacion instanceof EvaluacionCronica ? $evaluacion : null;
    }

    public function aDto(bool $conUltima = true): array
    {
        $ultima = $conUltima ? $this->ultimaEvaluacion() : null;
        return [
            'idPerfil' => $this->id_perfil,
            'condicion' => $this->condicion,
            'etiqueta' => catalogoSegmentacion()[$this->condicion]['etiqueta'] ?? $this->condicion,
            'estado' => $this->estado,
            'segmento' => $this->segmento,
            'datosBasales' => $this->basales(),
            'fechaAlta' => iso($this->fecha_alta),
            'fechaEvaluacion' => iso($this->fecha_evaluacion),
            'ultimaEvaluacion' => $ultima?->aDto(),
        ];
    }
}
