<?php
declare(strict_types=1);

final class CondicionCritica extends Modelo
{
    protected static string $tabla = 'condiciones_criticas';
    protected static string|array $llave = 'id';
    protected static string $prefijoId = 'cnd';
    protected static array $columnas = ['id' => 'texto', 'id_paciente' => 'texto', 'descripcion' => 'texto'];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function aDto(): array
    {
        return ['id' => $this->id, 'descripcion' => $this->descripcion];
    }
}
