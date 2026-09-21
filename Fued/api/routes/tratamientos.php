<?php
declare(strict_types=1);

/** Si no se envían horarios, se reparten a partir de las 08:00 según la frecuencia. */
function horariosPorFrecuencia(int $frecuenciaHoras): array
{
    if ($frecuenciaHoras >= 24) {
        return ['08:00'];
    }
    $horarios = [];
    for ($i = 0; $i < intdiv(24, $frecuenciaHoras); $i++) {
        $horarios[] = sprintf('%02d:00', (8 + $i * $frecuenciaHoras) % 24);
    }
    sort($horarios);
    return $horarios;
}

function validarHorarios(mixed $valor): array
{
    if (!is_array($valor) || $valor === [] || count($valor) > 24) {
        throw errorCampo('horarios_invalidos', 'horariosSugeridos', 'Envía entre 1 y 24 horarios con formato HH:MM.');
    }
    $horarios = array_values(array_unique(array_map(
        fn ($h) => horaHHMM(is_string($h) ? $h : '', 'horariosSugeridos'),
        $valor
    )));
    sort($horarios);
    return $horarios;
}

return function (Router $r): void {
    $r->get('/pacientes/{id}/tratamientos', function (array $p): void {
        $paciente = pacienteAutorizado(sesion(), $p['id']);
        $tratamientos = $paciente->tratamientos(parametro('activos', '1') === '1');
        responder(array_map(fn (Tratamiento $t) => $t->aDto(), $tratamientos));
    });

    $r->post('/pacientes/{id}/tratamientos', function (array $p): void {
        $s = sesion();
        autorizarPaciente($s, $p['id'], true);
        $d = cuerpoJson();
        $frecuencia = (int) entero($d, 'frecuenciaHoras', true, 1, 168);
        $horarios = array_key_exists('horariosSugeridos', $d) ? validarHorarios($d['horariosSugeridos']) : horariosPorFrecuencia($frecuencia);
        $inicio = fecha($d, 'fechaInicio', false) ?? fechaHoyLocal(zonaHoraria(parametro('tz')));
        $fin = fecha($d, 'fechaFin', false);
        if ($fin !== null && $fin < $inicio) {
            throw errorCampo('rango_fechas_invalido', 'fechaFin', 'La fecha de fin no puede ser anterior al inicio.');
        }
        $inventario = is_array($d['inventario'] ?? null) ? $d['inventario'] : [];

        $tratamiento = Tratamiento::crear([
            'id_paciente' => $p['id'],
            'medicamento' => texto($d, 'medicamento', true, 120),
            'dosis' => texto($d, 'dosis', true, 60),
            'frecuencia_horas' => $frecuencia,
            'horarios_sugeridos' => $horarios,
            'via_administracion' => texto($d, 'viaAdministracion', false, 40) ?? 'Oral',
            'fecha_inicio' => $inicio,
            'fecha_fin' => $fin,
            'id_medico_receta' => $s['rol'] === 'medico' ? $s['id'] : null,
            'cantidad_restante' => entero($inventario, 'cantidadRestante', false, 0, 100000) ?? 0,
            'umbral_alerta' => entero($inventario, 'umbralAlerta', false, 0, 1000) ?? 5,
            'activo' => true,
            'fecha_creacion' => ahoraSql(),
        ]);
        responder($tratamiento->aDto(), 201);
    });

    // El médico edita todo; el paciente sólo el inventario de lo que le recetaron
    // (puede editar libremente los tratamientos que él mismo registró).
    $r->put('/tratamientos/{idTratamiento}', function (array $p): void {
        $s = sesion();
        $tratamiento = Tratamiento::buscarOFallar($p['idTratamiento'], 'tratamiento_no_encontrado', 'El tratamiento no existe.');
        autorizarPaciente($s, (string) $tratamiento->id_paciente, true);
        $d = cuerpoJson();
        $soloInventario = $s['rol'] === 'paciente' && $tratamiento->loRecetoUnMedico();

        if (!$soloInventario) {
            foreach (['medicamento' => ['medicamento', 120], 'dosis' => ['dosis', 60], 'viaAdministracion' => ['via_administracion', 40]] as $campo => [$columna, $max]) {
                if (array_key_exists($campo, $d)) {
                    $tratamiento->$columna = texto($d, $campo, true, $max);
                }
            }
            if (array_key_exists('frecuenciaHoras', $d)) {
                $tratamiento->frecuencia_horas = entero($d, 'frecuenciaHoras', true, 1, 168);
            }
            if (array_key_exists('horariosSugeridos', $d)) {
                $tratamiento->horarios_sugeridos = validarHorarios($d['horariosSugeridos']);
            }
            if (array_key_exists('fechaInicio', $d)) {
                $tratamiento->fecha_inicio = fecha($d, 'fechaInicio');
            }
            if (array_key_exists('fechaFin', $d)) {
                $tratamiento->fecha_fin = fecha($d, 'fechaFin', false);
            }
        } elseif (array_diff(array_keys($d), ['inventario']) !== []) {
            throw new HttpError(403, 'solo_inventario', 'Sólo puedes actualizar el inventario de un tratamiento recetado por tu médico.');
        }

        $inventario = is_array($d['inventario'] ?? null) ? $d['inventario'] : [];
        if (array_key_exists('cantidadRestante', $inventario)) {
            $tratamiento->cantidad_restante = entero($inventario, 'cantidadRestante', true, 0, 100000);
        }
        if (array_key_exists('umbralAlerta', $inventario)) {
            $tratamiento->umbral_alerta = entero($inventario, 'umbralAlerta', true, 0, 1000);
        }

        $tratamiento->guardar();
        responder($tratamiento->aDto());
    });

    // Baja lógica: se conserva el historial de tomas del tratamiento.
    $r->delete('/tratamientos/{idTratamiento}', function (array $p): void {
        $s = sesion();
        $tratamiento = Tratamiento::buscarOFallar($p['idTratamiento'], 'tratamiento_no_encontrado', 'El tratamiento no existe.');
        autorizarPaciente($s, (string) $tratamiento->id_paciente, true);
        if ($s['rol'] === 'paciente' && $tratamiento->loRecetoUnMedico()) {
            throw new HttpError(403, 'suspension_requiere_medico', 'Sólo tu médico puede suspender un tratamiento recetado.');
        }
        $tratamiento->suspender(fechaHoyLocal(zonaHoraria(parametro('tz'))));
        responder(null, 204);
    });
};
