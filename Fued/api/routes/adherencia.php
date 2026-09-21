<?php
declare(strict_types=1);

/**
 * Construye la agenda de tomas de un día: cada horario sugerido de los
 * tratamientos vigentes, con su registro si el paciente ya lo marcó.
 */
function agendaTomas(string $idPaciente, string $fecha, DateTimeZone $tz): array
{
    $tratamientos = Tratamiento::vigentesEn($idPaciente, $fecha);
    $inicioDia = new DateTimeImmutable("$fecha 00:00", $tz);

    $registros = RegistroAdherencia::donde('id_paciente', $idPaciente)
        ->donde('fecha_hora_programada', '>=', sqlUtc($inicioDia))
        ->donde('fecha_hora_programada', '<', sqlUtc($inicioDia->modify('+1 day')))
        ->obtener();
    $indice = [];
    foreach ($registros as $registro) {
        $indice[$registro->id_tratamiento . '|' . $registro->fecha_hora_programada] = $registro;
    }

    $tomas = [];
    foreach ($tratamientos as $tratamiento) {
        if (!$tratamiento->aplicaEnFecha($fecha)) {
            continue;
        }
        foreach ($tratamiento->horarios_sugeridos ?: [] as $hora) {
            $programada = sqlUtc(new DateTimeImmutable("$fecha $hora", $tz));
            $registro = $indice[$tratamiento->id_tratamiento . '|' . $programada] ?? null;
            $tomas[] = [
                'idTratamiento' => $tratamiento->id_tratamiento,
                'medicamento' => $tratamiento->medicamento,
                'dosis' => $tratamiento->dosis,
                'viaAdministracion' => $tratamiento->via_administracion,
                'horario' => $hora,
                'fechaHoraProgramada' => iso($programada),
                'registro' => $registro?->aDto(),
                'inventario' => [
                    'cantidadRestante' => (int) $tratamiento->cantidad_restante,
                    'umbralAlerta' => (int) $tratamiento->umbral_alerta,
                ],
                'inventarioBajo' => $tratamiento->inventarioBajo(),
            ];
        }
    }
    usort($tomas, fn (array $a, array $b) => strcmp((string) $a['fechaHoraProgramada'], (string) $b['fechaHoraProgramada']));
    return $tomas;
}

return function (Router $r): void {
    $r->get('/pacientes/{id}/tomas', function (array $p): void {
        autorizarPaciente(sesion(), $p['id']);
        $tz = zonaHoraria(parametro('tz'));
        $fecha = fechaDeParametro('fecha', fechaHoyLocal($tz));
        $tomas = agendaTomas($p['id'], $fecha, $tz);

        $registradas = array_values(array_filter(array_column($tomas, 'registro')));
        $estados = array_count_values(array_column($registradas, 'estado'));
        $cumplidas = ($estados['tomado'] ?? 0) + ($estados['tomado_tarde'] ?? 0);
        responder([
            'fecha' => $fecha,
            'zonaHoraria' => $tz->getName(),
            'tomas' => $tomas,
            'resumen' => [
                'pendientes' => count($tomas) - count($registradas),
                'total' => count($registradas),
                'tomadas' => $estados['tomado'] ?? 0,
                'tomadasTarde' => $estados['tomado_tarde'] ?? 0,
                'omitidas' => $estados['omitido'] ?? 0,
                'porcentajeCumplimiento' => $registradas === [] ? null : round($cumplidas / count($registradas) * 100, 1),
            ],
        ]);
    });

    // El paciente marca una toma como tomada u omitida. Si la marca más de
    // `minutos_tolerancia_toma` después de la hora programada, queda como tomado_tarde.
    $r->post('/pacientes/{id}/tomas', function (array $p): void {
        autorizarPaciente(sesion('paciente'), $p['id'], true);
        $d = cuerpoJson();
        $idTratamiento = (string) texto($d, 'idTratamiento', true, 32);
        $programada = (string) fechaHoraSql($d, 'fechaHoraProgramada');
        $accion = (string) opcion($d, 'estado', ['tomado', 'omitido']);
        $sintomas = texto($d, 'sintomasAsociados', false, 500);

        $tratamiento = Tratamiento::donde('id_tratamiento', $idTratamiento)
            ->donde('id_paciente', $p['id'])
            ->donde('activo', true)
            ->primero();
        if (!$tratamiento instanceof Tratamiento) {
            throw new HttpError(404, 'tratamiento_no_encontrado', 'El tratamiento no existe o ya no está activo.');
        }

        $ahora = time();
        $programadaTs = (int) strtotime($programada . ' UTC');
        if ($programadaTs > $ahora + 12 * 3600) {
            throw errorCampo('toma_futura', 'fechaHoraProgramada', 'No puedes registrar una toma con más de 12 horas de anticipación.');
        }
        $estado = $accion === 'omitido'
            ? 'omitido'
            : ($ahora - $programadaTs > (int) config('minutos_tolerancia_toma') * 60 ? 'tomado_tarde' : 'tomado');

        $registro = enTransaccion(function () use ($tratamiento, $p, $programada, $estado, $sintomas): RegistroAdherencia {
            $registro = RegistroAdherencia::deToma((string) $tratamiento->id_tratamiento, $programada);
            $consumiaAntes = $registro?->consumeInventario() ?? false;

            $registro ??= new RegistroAdherencia([
                'id_tratamiento' => $tratamiento->id_tratamiento,
                'id_paciente' => $p['id'],
                'fecha_hora_programada' => $programada,
            ]);
            $registro->estado = $estado;
            $registro->sintomas_asociados = $sintomas;
            $registro->fecha_hora_real = $estado === 'omitido' ? null : ahoraSql();
            $registro->guardar();

            $delta = (int) $consumiaAntes - (int) $registro->consumeInventario();
            if ($delta !== 0) {
                $tratamiento->ajustarInventario($delta);
            }
            return $registro;
        });

        responder([
            'registro' => $registro->aDto(),
            'inventario' => [
                'cantidadRestante' => (int) $tratamiento->cantidad_restante,
                'umbralAlerta' => (int) $tratamiento->umbral_alerta,
            ],
            'alertaInventario' => $tratamiento->inventarioBajo(),
        ], 201);
    });

    $r->get('/pacientes/{id}/adherencia', function (array $p): void {
        $paciente = pacienteAutorizado(sesion(), $p['id']);
        $tz = zonaHoraria(parametro('tz'));
        $hoy = new DateTimeImmutable('today', $tz);
        $desde = fechaDeParametro('desde', $hoy->modify('-30 days')->format('Y-m-d'));
        $hasta = fechaDeParametro('hasta', $hoy->format('Y-m-d'));

        $registros = $paciente->registrosAdherencia()
            ->donde('fecha_hora_programada', '>=', sqlUtc(new DateTimeImmutable("$desde 00:00", $tz)))
            ->donde('fecha_hora_programada', '<', sqlUtc((new DateTimeImmutable("$hasta 00:00", $tz))->modify('+1 day')))
            ->con('tratamiento')
            ->ordenar('fecha_hora_programada', 'DESC')
            ->obtener();

        responder([
            'desde' => $desde,
            'hasta' => $hasta,
            'registros' => array_map(fn (RegistroAdherencia $r) => $r->aDto(true), $registros),
            'resumen' => RegistroAdherencia::resumen($registros),
        ]);
    });
};
