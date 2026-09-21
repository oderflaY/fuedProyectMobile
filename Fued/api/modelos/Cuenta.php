<?php
declare(strict_types=1);

/** Credenciales de acceso; cada cuenta es un Paciente o un Medico. */
final class Cuenta extends Modelo
{
    protected static string $tabla = 'cuentas';
    protected static string|array $llave = 'id';
    protected static array $columnas = [
        'id' => 'texto',
        'rol' => 'texto',
        'email' => 'texto',
        'password_hash' => 'texto',
        'fecha_registro' => 'fechaHora',
        'ultimo_acceso' => 'fechaHora',
    ];

    public static function porEmail(string $email): ?self
    {
        $cuenta = self::donde('email', mb_strtolower($email))->primero();
        return $cuenta instanceof self ? $cuenta : null;
    }

    public static function registrar(string $id, string $rol, string $email, string $password): self
    {
        $ahora = ahoraSql();
        return self::crear([
            'id' => $id,
            'rol' => $rol,
            'email' => mb_strtolower($email),
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'fecha_registro' => $ahora,
            'ultimo_acceso' => $ahora,
        ]);
    }

    public function passwordCorrecta(string $password): bool
    {
        return password_verify($password, (string) $this->password_hash);
    }

    public function registrarAcceso(): void
    {
        $this->ultimo_acceso = ahoraSql();
        $this->guardar();
    }

    public function esPaciente(): bool
    {
        return $this->rol === 'paciente';
    }

    /** Perfil asociado según el rol. */
    public function perfil(): Paciente|Medico|null
    {
        return $this->esPaciente() ? Paciente::buscar((string) $this->id) : Medico::buscar((string) $this->id);
    }

    public function aDto(): array
    {
        $perfil = $this->perfil();
        return [
            'id' => $this->id,
            'rol' => $this->rol,
            'email' => $this->email,
            'nombre' => $perfil?->nombre ?? '',
            'apellidos' => $perfil?->apellidos ?? '',
            'estadoCuenta' => $perfil?->estado_cuenta,
            'especialidad' => $perfil instanceof Medico ? $perfil->especialidad : null,
        ];
    }
}
