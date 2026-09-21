<?php
declare(strict_types=1);

final class Alergia extends Modelo
{
    protected static string $tabla = 'alergias';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'ale';
    protected static array $columnas = [
        'id' => 'texto',
        'id_paciente' => 'texto',
        'alergeno' => 'texto',
        'severidad' => 'texto',
        'reaccion' => 'texto',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function aDto(): array
    {
        return [
            'id' => $this->id,
            'alergeno' => $this->alergeno,
            'severidad' => $this->severidad,
            'reaccion' => $this->reaccion,
        ];
    }
}
