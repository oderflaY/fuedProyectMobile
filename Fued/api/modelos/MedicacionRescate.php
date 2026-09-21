<?php
declare(strict_types=1);

final class MedicacionRescate extends Modelo
{
    protected static string $tabla = 'medicacion_rescate';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'mre';
    protected static array $columnas = ['id' => 'texto', 'id_paciente' => 'texto', 'descripcion' => 'texto'];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function aDto(): array
    {
        return ['id' => $this->id, 'descripcion' => $this->descripcion];
    }
}
