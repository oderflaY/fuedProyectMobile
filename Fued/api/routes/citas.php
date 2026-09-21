<?php
declare(strict_types=1);

/** Busca una cita y comprueba que la sesión sea uno de sus participantes. */
function citaVisible(array $sesion, string $idCita): Cita
{
    $cita = Cita::buscar($idCita);
    if (!$cita instanceof Cita || !$cita->esParticipante($sesion)) {
        throw new HttpError(404, 'cita_no_encontrada', 'La cita no existe.');
    }
    return $cita;
}

/** Horarios de consulta de un médico en una fecha, marcando los ya ocupados. */
function horariosDelDia(string $idMedico, string $fecha, DateTimeZone $tz): array
{
    $cfg = config('consultas');
    $dia = new DateTimeImmutable($fecha, $tz);
    if (!in_array((int) $dia->format('N'), $cfg['dias_laborales'], true)) {
        return [];
    }
    $inicio = new DateTimeImmutable("$fecha {$cfg['hora_inicio']}", $tz);
    $fin = new DateTimeImmutable("$fecha {$cfg['hora_fin']}", $tz);

    $ocupadas = Cita::activas()
        ->donde('id_medico', $idMedico)
        ->donde('fecha_hora', '>=', sqlUtc($inicio->modify('-4 hours')))
        ->donde('fecha_hora', '<', sqlUtc($fin))
        ->obtener();

    $horarios = [];
    $paso = (int) $cfg['duracion_min'];
    for ($t = $inicio; $t < $fin; $t = $t->modify("+$paso minutes")) {
        $desde = $t->getTimestamp();
        $hasta = $desde + $paso * 60;
        $libre = $desde > time();
        foreach ($ocupadas as $cita) {
            if ($cita->inicioEnSegundos() < $hasta && $cita->finEnSegundos() > $desde) {
                $libre = false;
                break;
            }
        }
        $horarios[] = ['fechaHora' => isoUtc($t), 'horaLocal' => $t->format('H:i'), 'disponible' => $libre];
    }
    return $horarios;
}

return function (Router $r): void {
    $r->get('/citas', function (): void {
        $s = sesion();
        $consulta = Cita::donde($s['rol'] === 'paciente' ? 'id_paciente' : 'id_medico', $s['id']);

        $estados = parametro('estado');
        if ($estados !== null) {
            $lista = array_values(array_intersect(explode(',', $estados), ['pendiente', 'confirmada', 'cancelada', 'completada']));
            if ($lista === []) {
                throw new HttpError(422, 'opcion_invalida', 'Estado de cita no válido.', ['campo' => 'estado']);
            }
            $consulta->dondeEn('estado', $lista);
        }
        if (parametro('proximas') === '1') {
            $consulta->donde('fecha_hora', '>=', gmdate('Y-m-d H:i:s', time() - 3600))
                ->dondeCrudo("estado IN ('pendiente', 'confirmada')");
        }
        $desde = fechaHoraSql(['desde' => parametro('desde')], 'desde', false);
        if ($desde !== null) {
            $consulta->donde('fecha_hora', '>=', $desde);
        }
        $hasta = fechaHoraSql(['hasta' => parametro('hasta')], 'hasta', false);
        if ($hasta !== null) {
            $consulta->donde('fecha_hora', '<', $hasta);
        }

        $citas = $consulta->con('paciente', 'medico')->ordenar('fecha_hora')->limitar(200)->obtener();
        responder(array_map(fn (Cita $c) => $c->aDto(), $citas));
    });

    $r->get('/citas/disponibilidad', function (): void {
        sesion();
        $idMedico = (string) texto(['idMedico' => parametro('idMedico')], 'idMedico', true, 32);
        if (Medico::verificado($idMedico) === null) {
            throw new HttpError(404, 'medico_no_encontrado', 'El médico no existe o no está verificado.');
        }
        $tz = zonaHoraria(parametro('tz'));
        $fecha = fechaDeParametro('fecha', fechaHoyLocal($tz));
        responder([
            'idMedico' => $idMedico,
            'fecha' => $fecha,
            'zonaHoraria' => $tz->getName(),
            'duracionMin' => (int) config('consultas')['duracion_min'],
            'horarios' => horariosDelDia($idMedico, $fecha, $tz),
        ]);
    });

    $r->get('/citas/{id}', fn (array $p) => responder(citaVisible(sesion(), $p['id'])->aDto()));

    // El paciente solicita (queda pendiente); el médico agenda directamente (queda confirmada).
    $r->post('/citas', function (): void {
        $s = sesion();
        $d = cuerpoJson();
        $fechaHora = (string) fechaHoraSql($d, 'fechaHora');
        $motivo = texto($d, 'motivo', true, 500);
        $duracion = entero($d, 'duracionMin', false, 15, 240) ?? (int) config('consultas')['duracion_min'];

        if ($s['rol'] === 'paciente') {
            $idPaciente = $s['id'];
            $idMedico = (string) texto($d, 'idMedico', true, 32);
            if (Medico::verificado($idMedico) === null) {
                throw new HttpError(404, 'medico_no_encontrado', 'El médico no existe o no está verificado.');
            }
            $estado = 'pendiente';
        } else {
            $idMedico = $s['id'];
            $idPaciente = (string) texto($d, 'idPaciente', true, 32);
            autorizarPaciente($s, $idPaciente);
            $estado = 'confirmada';
        }
        if (strtotime($fechaHora . ' UTC') <= time()) {
            throw errorCampo('fecha_pasada', 'fechaHora', 'La cita debe ser en una fecha futura.');
        }
        Cita::validarSinTraslape($idMedico, $idPaciente, $fechaHora, $duracion);

        $cita = Cita::crear([
            'id_paciente' => $idPaciente, 'id_medico' => $idMedico, 'fecha_hora' => $fechaHora,
            'duracion_min' => $duracion, 'motivo' => $motivo, 'estado' => $estado,
            'creado_por' => $s['id'], 'fecha_creacion' => ahoraSql(),
        ]);
        responder($cita->aDto(), 201);
    });

    $r->put('/citas/{id}', function (array $p): void {
        $s = sesion();
        $cita = citaVisible($s, $p['id']);
        $d = cuerpoJson();
        $huboCambios = false;

        if (array_key_exists('estado', $d)) {
            $nuevo = (string) opcion($d, 'estado', ['pendiente', 'confirmada', 'cancelada', 'completada']);
            if (!$cita->puedeCambiarA($nuevo, $s['rol'])) {
                throw new HttpError(422, 'transicion_invalida', "No puedes cambiar una cita {$cita->estado} a $nuevo.");
            }
            $cita->estado = $nuevo;
            $huboCambios = true;
        }

        if (array_key_exists('fechaHora', $d)) {
            if (!$cita->estaActiva()) {
                throw new HttpError(422, 'cita_cerrada', 'Sólo se pueden reprogramar citas pendientes o confirmadas.');
            }
            $fechaHora = (string) fechaHoraSql($d, 'fechaHora');
            if (strtotime($fechaHora . ' UTC') <= time()) {
                throw errorCampo('fecha_pasada', 'fechaHora', 'La cita debe ser en una fecha futura.');
            }
            Cita::validarSinTraslape((string) $cita->id_medico, (string) $cita->id_paciente, $fechaHora, (int) $cita->duracion_min, (string) $cita->id_cita);
            $cita->fecha_hora = $fechaHora;
            if ($s['rol'] === 'paciente') {
                $cita->estado = 'pendiente'; // el médico debe confirmar el nuevo horario
            }
            $huboCambios = true;
        }

        if (array_key_exists('notasMedico', $d)) {
            if ($s['rol'] !== 'medico') {
                throw new HttpError(403, 'rol_no_permitido', 'Sólo el médico puede escribir notas de la cita.');
            }
            $cita->notas_medico = texto($d, 'notasMedico', false, 5000);
            $huboCambios = true;
        }

        if (!$huboCambios) {
            throw new HttpError(422, 'sin_cambios', 'No se envió ningún cambio.');
        }
        $cita->fecha_actualizacion = ahoraSql();
        $cita->guardar();
        responder($cita->aDto());
    });
};
