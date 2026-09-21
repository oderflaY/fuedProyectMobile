<?php
declare(strict_types=1);

/** Médico, sus credenciales legales y su cartera de pacientes. */
final class Medico extends Modelo
{
    protected static string $tabla = 'medicos';
    protected static string|array $llave = 'id_medico';
    protected static string $prefijoId = 'doc';
    protected static array $columnas = [
        'id_medico' => 'texto',
        'estado_cuenta' => 'texto',
        'nombre' => 'texto',
        'apellidos' => 'texto',
        'genero' => 'texto',
        'telefono' => 'texto',
        'cedula_profesional' => 'texto',
        'cedula_especialidad' => 'texto',
        'especialidad' => 'texto',
        'universidad' => 'texto',
        'estado_verificacion' => 'texto',
        'fecha_verificacion' => 'fechaHora',
        'nombre_clinica' => 'texto',
        'direccion' => 'texto',
        'telefono_recepcion' => 'texto',
        'alertas_adherencia_baja' => 'booleano',
        'notificaciones_urgencia' => 'booleano',
        'tema_visual' => 'texto',
    ];
    protected static array $pertenece = ['cuenta' => [Cuenta::class, 'id_medico']];

    /** Sólo los médicos con cédula aprobada aparecen en el directorio y pueden ver expedientes. */
    public static function verificados(): Consulta
    {
        return self::donde('estado_cuenta', 'verificado')->donde('estado_verificacion', 'aprobado');
    }

    public static function verificado(string $idMedico): ?self
    {
        $medico = self::verificados()->donde('id_medico', $idMedico)->primero();
        return $medico instanceof self ? $medico : null;
    }

    public function nombreCompleto(): string
    {
        return trim("{$this->nombre} {$this->apellidos}");
    }

    public function estaVerificado(): bool
    {
        return $this->estado_cuenta === 'verificado' && $this->estado_verificacion === 'aprobado';
    }

    /** @return array<int, AccesoMedico> */
    public function accesosVigentes(): array
    {
        return AccesoMedico::vigentes()->donde('id_medico', (string) $this->id_medico)->con('paciente')->obtener();
    }

    public function aDtoPublico(): array
    {
        return [
            'idMedico' => $this->id_medico,
            'nombreCompleto' => $this->nombreCompleto(),
            'especialidad' => $this->especialidad,
            'nombreClinica' => $this->nombre_clinica,
            'direccion' => $this->direccion,
            'telefonoRecepcion' => $this->telefono_recepcion,
        ];
    }

    /** Perfil completo según DM_PerfilMedico.md. */
    public function perfil(): array
    {
        $cuenta = $this->cuenta;
        $vinculados = array_map(function (AccesoMedico $acceso): array {
            $paciente = $acceso->paciente;
            return [
                'idPaciente' => $acceso->id_paciente,
                'nombreCompleto' => $paciente?->nombreCompleto() ?? '',
                'nivelAcceso' => $acceso->nivel_acceso,
                'fechaVinculacion' => iso($acceso->fecha_vinculacion),
            ] + ($paciente?->evaluarRiesgo() ?? ['estadoRiesgo' => 'bajo', 'porcentajeAdherencia' => null]);
        }, $this->accesosVigentes());
        usort($vinculados, fn (array $a, array $b) => strcmp((string) $a['nombreCompleto'], (string) $b['nombreCompleto']));

        return [
            'idMedico' => $this->id_medico,
            'estadoCuenta' => $this->estado_cuenta,
            'datosPersonales' => [
                'nombre' => $this->nombre,
                'apellidos' => $this->apellidos,
                'genero' => $this->genero,
                'telefono' => $this->telefono,
                'email' => $cuenta?->email,
            ],
            'credenciales' => [
                'cedulaProfesional' => $this->cedula_profesional,
                'cedulaEspecialidad' => $this->cedula_especialidad,
                'especialidad' => $this->especialidad,
                'universidad' => $this->universidad,
                'estadoVerificacion' => $this->estado_verificacion,
                'fechaVerificacion' => iso($this->fecha_verificacion),
            ],
            'lugarTrabajo' => [
                'nombreClinica' => $this->nombre_clinica,
                'direccion' => $this->direccion,
                'telefonoRecepcion' => $this->telefono_recepcion,
            ],
            'pacientesVinculados' => $vinculados,
            'configuracionDashboard' => [
                'alertasAdherenciaBaja' => (bool) $this->alertas_adherencia_baja,
                'notificacionesUrgencia' => (bool) $this->notificaciones_urgencia,
                'temaVisual' => $this->tema_visual,
            ],
            'metadatos' => [
                'fechaRegistro' => iso($cuenta?->fecha_registro),
                'ultimoAcceso' => iso($cuenta?->ultimo_acceso),
            ],
        ];
    }
}
