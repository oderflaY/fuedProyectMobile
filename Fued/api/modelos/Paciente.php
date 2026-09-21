<?php
declare(strict_types=1);

/**
 * Paciente y su expediente. Concentra las consultas del historial médico
 * para que las rutas no tengan que armar SQL.
 */
final class Paciente extends Modelo
{
    protected static string $tabla = 'pacientes';
    protected static string|array $llave = 'id_paciente';
    protected static string $prefijoId = 'pac';
    protected static array $columnas = [
        'id_paciente' => 'texto',
        'estado_cuenta' => 'texto',
        'curp' => 'texto',
        'nss' => 'texto',
        'nombre' => 'texto',
        'apellidos' => 'texto',
        'fecha_nacimiento' => 'fecha',
        'genero' => 'texto',
        'telefono' => 'texto',
        'tipo_sangre' => 'texto',
        'donador_organos' => 'booleano',
    ];
    protected static array $pertenece = ['cuenta' => [Cuenta::class, 'id_paciente']];

    public function nombreCompleto(): string
    {
        return trim("{$this->nombre} {$this->apellidos}");
    }

    // ------------------------------------------------------------ relaciones

    /** @return array<int, Alergia> */
    public function alergias(): array
    {
        return $this->tieneMuchos(Alergia::class, 'id_paciente')->ordenar('alergeno')->obtener();
    }

    /** @return array<int, CondicionCritica> */
    public function condiciones(): array
    {
        return $this->tieneMuchos(CondicionCritica::class, 'id_paciente')->ordenar('descripcion')->obtener();
    }

    /** @return array<int, MedicacionRescate> */
    public function medicacionRescate(): array
    {
        return $this->tieneMuchos(MedicacionRescate::class, 'id_paciente')->ordenar('descripcion')->obtener();
    }

    /** @return array<int, Cirugia> */
    public function cirugias(): array
    {
        return $this->tieneMuchos(Cirugia::class, 'id_paciente')->ordenar('fecha', 'DESC')->obtener();
    }

    /** @return array<int, ContactoEmergencia> */
    public function contactos(): array
    {
        return $this->tieneMuchos(ContactoEmergencia::class, 'id_paciente')->ordenar('prioridad')->obtener();
    }

    /** @return array<int, DispositivoRfid> */
    public function tarjetas(): array
    {
        return $this->tieneMuchos(DispositivoRfid::class, 'id_paciente')->ordenar('fecha_asignacion', 'DESC')->obtener();
    }

    public function tratamientos(bool $soloActivos = true): array
    {
        $consulta = $this->tieneMuchos(Tratamiento::class, 'id_paciente');
        if ($soloActivos) {
            $consulta->donde('activo', true);
        }
        return $consulta->ordenar('activo', 'DESC')->ordenar('medicamento')->obtener();
    }

    /** @return array<int, MetricaVital> */
    public function metricas(int $limite = 30): array
    {
        return $this->tieneMuchos(MetricaVital::class, 'id_paciente')->ordenar('fecha_toma', 'DESC')->limitar($limite)->obtener();
    }

    public function registrosAdherencia(): Consulta
    {
        return $this->tieneMuchos(RegistroAdherencia::class, 'id_paciente');
    }

    /** @return array<int, AccesoMedico> */
    public function accesosVigentes(): array
    {
        return AccesoMedico::vigentes()->donde('id_paciente', (string) $this->id_paciente)->con('medico')->obtener();
    }

    public function nivelAccesoDe(string $idMedico): ?string
    {
        return AccesoMedico::entre((string) $this->id_paciente, $idMedico)?->nivel_acceso;
    }

    // ------------------------------------------------------------ DTO

    /** Único bloque que la API entrega al escanear la tarjeta RFID. */
    public function perfilEmergencia(): array
    {
        return [
            'tipoSangre' => $this->tipo_sangre,
            'donadorOrganos' => (bool) $this->donador_organos,
            'alergias' => array_map(fn (Alergia $a) => $a->aDto(), $this->alergias()),
            'condicionesCriticas' => array_map(fn (CondicionCritica $c) => (string) $c->descripcion, $this->condiciones()),
            'medicacionRescate' => array_map(fn (MedicacionRescate $m) => (string) $m->descripcion, $this->medicacionRescate()),
        ];
    }

    public function metricasActuales(): ?array
    {
        $ultima = $this->tieneMuchos(MetricaVital::class, 'id_paciente')->ordenar('fecha_toma', 'DESC')->primero();
        if ($ultima === null) {
            return null;
        }
        $id = (string) $this->id_paciente;
        return [
            'pesoKg' => MetricaVital::ultimoValor($id, 'peso_kg'),
            'alturaCm' => MetricaVital::ultimoValor($id, 'altura_cm'),
            'imc' => MetricaVital::ultimoValor($id, 'imc'),
            'ultimaPresionArterial' => MetricaVital::ultimoValor($id, 'presion_arterial'),
            'frecuenciaCardiaca' => MetricaVital::ultimoValor($id, 'frecuencia_cardiaca'),
            'glucosaMgDl' => MetricaVital::ultimoValor($id, 'glucosa_mg_dl'),
            'fechaTomaMetricas' => iso($ultima->fecha_toma),
        ];
    }

    /** Expediente completo según DM_HistorialMedico.md. */
    public function expediente(): array
    {
        return [
            'idPaciente' => $this->id_paciente,
            'estadoCuenta' => $this->estado_cuenta,
            'identificaciones' => ['curp' => $this->curp, 'nss' => $this->nss],
            'dispositivosRfid' => array_map(fn (DispositivoRfid $t) => $t->aDto(), $this->tarjetas()),
            'datosPersonales' => [
                'nombre' => $this->nombre,
                'apellidos' => $this->apellidos,
                'fechaNacimiento' => $this->fecha_nacimiento,
                'genero' => $this->genero,
                'telefono' => $this->telefono,
            ],
            'contactosEmergencia' => array_map(fn (ContactoEmergencia $c) => $c->aDto(), $this->contactos()),
            'perfilEmergenciaReducido' => $this->perfilEmergencia(),
            'metricasVitalesActuales' => $this->metricasActuales(),
            'historialClinico' => ['cirugias' => array_map(fn (Cirugia $c) => $c->aDto(), $this->cirugias())],
            'tratamientosActivos' => array_map(fn (Tratamiento $t) => $t->aDto(), $this->tratamientos()),
            'registroAdherencia' => array_map(
                fn (RegistroAdherencia $r) => $r->aDto(true),
                $this->registrosAdherencia()->con('tratamiento')->ordenar('fecha_hora_programada', 'DESC')->limitar(50)->obtener()
            ),
            'controlAccesos' => [
                'medicosAutorizados' => array_map(fn (AccesoMedico $a) => $a->aDto(), $this->accesosVigentes()),
            ],
        ];
    }

    /**
     * Semáforo de riesgo: combina cumplimiento de tomas de los últimos 7 días,
     * última presión arterial y condiciones críticas registradas.
     */
    public function evaluarRiesgo(): array
    {
        $registros = $this->registrosAdherencia()
            ->donde('fecha_hora_programada', '>=', sqlUtc(new DateTimeImmutable('-7 days')))
            ->obtener();
        $resumen = RegistroAdherencia::resumen($registros);
        $cumplimiento = $resumen['porcentajeCumplimiento'];

        $presion = MetricaVital::ultimoValor((string) $this->id_paciente, 'presion_arterial');
        [$sistolica, $diastolica] = is_string($presion) ? array_map('intval', explode('/', $presion) + [0, 0]) : [0, 0];
        $condiciones = $this->tieneMuchos(CondicionCritica::class, 'id_paciente')->contar();

        $estado = 'bajo';
        if (($cumplimiento !== null && $cumplimiento < 60) || $sistolica >= 140 || $diastolica >= 90) {
            $estado = 'alto';
        } elseif (($cumplimiento !== null && $cumplimiento < 85) || $sistolica >= 130 || $diastolica >= 85 || $condiciones > 0) {
            $estado = 'medio';
        }
        return ['estadoRiesgo' => $estado, 'porcentajeAdherencia' => $cumplimiento];
    }
}
