<?php
declare(strict_types=1);

final class Cirugia extends Modelo
{
    protected static string $tabla = 'cirugias';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'cir';
    protected static array $columnas = [
        'id' => 'texto',
        'id_paciente' => 'texto',
        'procedimiento' => 'texto',
        'fecha' => 'fecha',
        'notas' => 'texto',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function aDto(): array
    {
        return [
            'id' => $this->id,
            'procedimiento' => $this->procedimiento,
            'fecha' => $this->fecha,
            'notas' => $this->notas,
        ];
    }
}
