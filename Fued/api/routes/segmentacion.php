<?php
declare(strict_types=1);

/**
 * Segmentación por enfermedad crónica: el paciente declara sus condiciones y
 * responde un cuestionario guiado propio de cada una. El resultado clasifica al
 * paciente y, si procede, abre una alerta para su médico.
 */
return function (Router $r): void {
    // Catálogo completo, para que la app pinte la pantalla sin reglas propias.
    $r->get('/segmentacion/catalogo', function (): void {
        sesion();
        responder(array_map(fn (string $c) => cuestionarioDe($c), CONDICIONES_CRONICAS));
    });

    $r->get('/pacientes/{id}/cronicas', function (array $p): void {
        $paciente = pacienteAutorizado(sesion(), $p['id']);
        responder($paciente->segmentacionDto());
    });

    /** Alta de una condición crónica con sus datos basales. */
    $r->post('/pacientes/{id}/cronicas', function (array $p): void {
        autorizarPaciente(sesion(), $p['id'], true);
        $d = cuerpoJson();
        $condicion = (string) opcion($d, 'condicion', CONDICIONES_CRONICAS);
        $basales = validarRespuestas(
            catalogoSegmentacion()[$condicion]['basales'],
            is_array($d['datosBasales'] ?? null) ? $d['datosBasales'] : []
        );

        $perfil = PerfilCronico::de($p['id'], $condicion);
        if ($perfil !== null && $perfil->estado === 'activo') {
            throw new HttpError(409, 'condicion_ya_registrada', 'Esa condición ya está en el perfil del paciente.');
        }
        if ($perfil === null) {
            $perfil = PerfilCronico::crear([
                'id_paciente' => $p['id'], 'condicion' => $condicion, 'estado' => 'activo',
                'segmento' => 'sin_clasificar', 'datos_basales' => $basales, 'fecha_alta' => ahoraSql(),
            ]);
        } else {
            $perfil->estado = 'activo';
            $perfil->datos_basales = $basales;
            $perfil->guardar();
        }
        responder($perfil->aDto(), 201);
    });

    /** Ajuste de los datos basales o archivado de la condición. */
    $r->put('/pacientes/{id}/cronicas/{condicion}', function (array $p): void {
        autorizarPaciente(sesion(), $p['id'], true);
        $perfil = perfilCronicoDe($p['id'], $p['condicion']);
        $d = cuerpoJson();

        if (array_key_exists('datosBasales', $d)) {
            $perfil->datos_basales = validarRespuestas(
                catalogoSegmentacion()[$perfil->condicion]['basales'],
                is_array($d['datosBasales']) ? $d['datosBasales'] : []
            );
        }
        if (array_key_exists('estado', $d)) {
            $perfil->estado = (string) opcion($d, 'estado', ['activo', 'archivado']);
        }
        $perfil->guardar();
        responder($perfil->aDto());
    });

    /** Cuestionario a contestar, ya con los basales del paciente resueltos. */
    $r->get('/pacientes/{id}/cronicas/{condicion}/cuestionario', function (array $p): void {
        autorizarPaciente(sesion(), $p['id']);
        $perfil = perfilCronicoDe($p['id'], $p['condicion']);
        responder(cuestionarioDe((string) $perfil->condicion) + ['datosBasales' => $perfil->basales()]);
    });

    $r->get('/pacientes/{id}/cronicas/{condicion}/evaluaciones', function (array $p): void {
        autorizarPaciente(sesion(), $p['id']);
        $perfil = perfilCronicoDe($p['id'], $p['condicion']);
        responder(array_map(fn (EvaluacionCronica $e) => $e->aDto(), $perfil->evaluaciones()));
    });

    /**
     * Corrida del cuestionario. Guarda las mediciones como signos vitales para
     * que aparezcan en el expediente, clasifica al paciente y avisa al médico
     * cuando el resultado lo amerita.
     */
    $r->post('/pacientes/{id}/cronicas/{condicion}/evaluaciones', function (array $p): void {
        $s = sesion();
        $paciente = pacienteAutorizado($s, $p['id'], true);
        $perfil = perfilCronicoDe($p['id'], $p['condicion']);
        $condicion = (string) $perfil->condicion;

        $cuestionario = cuestionarioDe($condicion);
        $d = cuerpoJson();
        $respuestas = validarRespuestas(
            $cuestionario['preguntas'],
            is_array($d['respuestas'] ?? null) ? $d['respuestas'] : []
        );
        $resultado = evaluarSegmentacion($condicion, $respuestas, $perfil->basales());

        [$evaluacion, $alertas] = enTransaccion(function () use ($paciente, $perfil, $condicion, $respuestas, $resultado, $s) {
            $metrica = null;
            if ($resultado['metrica'] !== []) {
                $metrica = MetricaVital::crear($resultado['metrica'] + [
                    'id_paciente' => (string) $paciente->id_paciente,
                    'registrado_por' => $s['id'],
                    'fecha_toma' => ahoraSql(),
                ]);
            }

            $evaluacion = EvaluacionCronica::crear([
                'id_perfil' => (string) $perfil->id_perfil,
                'id_paciente' => (string) $paciente->id_paciente,
                'condicion' => $condicion,
                'respuestas' => $respuestas,
                'segmento' => $resultado['segmento'],
                'severidad' => $resultado['severidad'],
                'banderas' => $resultado['banderas'],
                'confiable' => $resultado['confiable'],
                'id_metrica' => $metrica?->id,
                'fecha' => ahoraSql(),
            ]);

            $perfil->segmento = $resultado['segmento'];
            $perfil->fecha_evaluacion = ahoraSql();
            $perfil->guardar();

            return [$evaluacion, AlertaClinica::desdeEvaluacion($paciente, $evaluacion)];
        });

        responder([
            'evaluacion' => $evaluacion->aDto(),
            'recomendaciones' => $resultado['recomendaciones'],
            'alertasEnviadas' => count($alertas),
        ], 201);
    });
};

/** Perfil crónico activo o archivado del paciente, o 404. */
function perfilCronicoDe(string $idPaciente, string $condicion): PerfilCronico
{
    if (!in_array($condicion, CONDICIONES_CRONICAS, true)) {
        throw new HttpError(404, 'condicion_no_encontrada', 'Esa enfermedad crónica no está en el catálogo.');
    }
    return PerfilCronico::de($idPaciente, $condicion)
        ?? throw new HttpError(404, 'perfil_no_encontrado', 'El paciente no tiene registrada esa condición.');
}
