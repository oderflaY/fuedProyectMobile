<?php
declare(strict_types=1);

/** Tarjeta de emergencia. Nunca se borra: al perderse cambia de estado (baja lógica). */
final class DispositivoRfid extends Modelo
{
    protected static string $tabla = 'dispositivos_rfid';
    protected static string|array $llave = 'id_tarjeta_rfid';
    protected static array $columnas = [
        'id_tarjeta_rfid' => 'texto',
        'id_paciente' => 'texto',
        'estado' => 'texto',
        'fecha_asignacion' => 'fechaHora',
        'fecha_revocacion' => 'fechaHora',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    public function estaActiva(): bool
    {
        return $this->estado === 'activa';
    }

    public function revocar(string $estado): void
    {
        $this->estado = $estado;
        $this->fecha_revocacion = ahoraSql();
        $this->guardar();
    }

    public function aDto(): array
    {
        return [
            'idTarjetaRfid' => $this->id_tarjeta_rfid,
            'estado' => $this->estado,
            'fechaAsignacion' => iso($this->fecha_asignacion),
            'fechaRevocacion' => iso($this->fecha_revocacion),
        ];
    }
}
