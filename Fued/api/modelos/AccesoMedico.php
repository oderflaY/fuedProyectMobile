<?php
declare(strict_types=1);

/** Permiso que un paciente otorga a un médico sobre su expediente (llave compuesta). */
final class AccesoMedico extends Modelo
{
    protected static string $tabla = 'accesos_medicos';
    protected static string|array $llave = ['id_paciente', 'id_medico'];
    protected static array $columnas = [
        'id_paciente' => 'texto',
        'id_medico' => 'texto',
        'nivel_acceso' => 'texto',
        'fecha_vinculacion' => 'fechaHora',
        'fecha_expiracion' => 'fechaHora',
        'revocado_en' => 'fechaHora',
    ];
    protected static array $pertenece = [
        'paciente' => [Paciente::class, 'id_paciente'],
        'medico' => [Medico::class, 'id_medico'],
    ];

    /** Accesos que siguen siendo válidos ahora mismo. */
    public static function vigentes(): Consulta
    {
        return self::consulta()
            ->dondeNulo('revocado_en')
            ->dondeCrudo('fecha_expiracion IS NULL OR fecha_expiracion > ?', [ahoraSql()]);
    }

    public static function entre(string $idPaciente, string $idMedico): ?self
    {
        $acceso = self::vigentes()->donde('id_paciente', $idPaciente)->donde('id_medico', $idMedico)->primero();
        return $acceso instanceof self ? $acceso : null;
    }

    public function permiteEscritura(): bool
    {
        return $this->nivel_acceso === 'lectura_escritura';
    }

    public function revocar(): void
    {
        $this->revocado_en = ahoraSql();
        $this->guardar();
    }

    public function aDto(): array
    {
        $medico = $this->medico;
        return [
            'idMedico' => $this->id_medico,
            'nombreCompleto' => $medico?->nombreCompleto() ?? '',
            'especialidad' => $medico?->especialidad,
            'nivelAcceso' => $this->nivel_acceso,
            'fechaExpiracion' => iso($this->fecha_expiracion),
        ];
    }
}
