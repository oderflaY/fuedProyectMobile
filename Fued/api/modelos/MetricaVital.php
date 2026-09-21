<?php
declare(strict_types=1);

final class MetricaVital extends Modelo
{
    protected static string $tabla = 'metricas_vitales';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'met';
    protected static array $columnas = [
        'id' => 'texto',
        'id_paciente' => 'texto',
        'peso_kg' => 'decimal',
        'altura_cm' => 'decimal',
        'imc' => 'decimal',
        'presion_arterial' => 'texto',
        'frecuencia_cardiaca' => 'entero',
        'glucosa_mg_dl' => 'decimal',
        'temperatura_c' => 'decimal',
        'notas' => 'texto',
        'registrado_por' => 'texto',
        'fecha_toma' => 'fechaHora',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    /** Última medición del paciente que tenga valor en esa columna. */
    public static function ultimoValor(string $idPaciente, string $columna): mixed
    {
        $metrica = self::donde('id_paciente', $idPaciente)->dondeNoNulo($columna)->ordenar('fecha_toma', 'DESC')->primero();
        return $metrica?->$columna;
    }

    public function aDto(): array
    {
        return [
            'idMetrica' => $this->id,
            'pesoKg' => $this->peso_kg,
            'alturaCm' => $this->altura_cm,
            'imc' => $this->imc,
            'presionArterial' => $this->presion_arterial,
            'frecuenciaCardiaca' => $this->frecuencia_cardiaca,
            'glucosaMgDl' => $this->glucosa_mg_dl,
            'temperaturaC' => $this->temperatura_c,
            'notas' => $this->notas,
            'fechaToma' => iso($this->fecha_toma),
            'registradoPor' => $this->registrado_por,
        ];
    }
}
