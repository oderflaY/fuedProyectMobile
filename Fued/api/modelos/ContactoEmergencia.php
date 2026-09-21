<?php
declare(strict_types=1);

final class ContactoEmergencia extends Modelo
{
    protected static string $tabla = 'contactos_emergencia';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'cte';
    protected static array $columnas = [
        'id' => 'texto',
        'id_paciente' => 'texto',
        'nombre' => 'texto',
        'relacion' => 'texto',
        'telefono' => 'texto',
        'prioridad' => 'entero',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function aDto(): array
    {
        return [
            'id' => $this->id,
            'nombre' => $this->nombre,
            'relacion' => $this->relacion,
            'telefono' => $this->telefono,
            'prioridad' => (int) $this->prioridad,
        ];
    }
}
