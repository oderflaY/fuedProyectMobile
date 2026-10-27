<?php
declare(strict_types=1);

final class AntecedenteFamiliar extends Modelo
{
    protected static string $tabla = 'antecedentes_familiares';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'ant';
    protected static array $columnas = [
        'id' => 'texto',
        'id_paciente' => 'texto',
        'parentesco' => 'texto',
        'padecimiento' => 'texto',
        'notas' => 'texto',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function aDto(): array
    {
        return [
            'id' => $this->id,
            'parentesco' => $this->parentesco,
            'padecimiento' => $this->padecimiento,
            'notas' => $this->notas,
        ];
    }
}
