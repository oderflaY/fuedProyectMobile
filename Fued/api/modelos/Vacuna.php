<?php
declare(strict_types=1);

final class Vacuna extends Modelo
{
    protected static string $tabla = 'vacunas';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'vac';
    protected static array $columnas = [
        'id' => 'texto',
        'id_paciente' => 'texto',
        'vacuna' => 'texto',
        'fecha' => 'fecha',
        'dosis' => 'texto',
        'lote' => 'texto',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function aDto(): array
    {
        return [
            'id' => $this->id,
            'vacuna' => $this->vacuna,
            'fecha' => $this->fecha,
            'dosis' => $this->dosis,
            'lote' => $this->lote,
        ];
    }
}
