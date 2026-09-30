<?php
declare(strict_types=1);

/**
 * Segmentación por enfermedad crónica.
 *
 * Cada condición declara sus datos basales (la referencia personal del paciente)
 * y un cuestionario guiado. Las reglas de `evaluarSegmentacion()` comparan las
 * respuestas contra esa referencia propia, no contra promedios poblacionales.
 *
 * Contra los falsos positivos se usan tres mecanismos:
 *   1. Preguntas de contexto: si el paciente midió sin reposo, tras café, tabaco
 *      o ejercicio, o con dolor agudo, la toma se marca no confiable.
 *   2. Confirmación: la presión arterial exige dos tomas y se promedia.
 *   3. Degradación: una toma no confiable baja de `atencion` a informativa y
 *      pide repetir. Las banderas rojas nunca se degradan.
 *
 * Aquí no vive ningún texto visible: `etiqueta` y `ayuda` son claves de
 * strings.xml y los valores de opción se traducen como `opcion_<pregunta>_<valor>`.
 */

const CONDICIONES_CRONICAS = ['hipertension', 'diabetes', 'asma_epoc', 'cardiopatia', 'renal'];

/** Niveles internos; se traducen a segmento y severidad al final. */
const NIVEL_CONTROLADO = 0;
const NIVEL_SEGUIMIENTO = 1;
const NIVEL_RIESGO = 2;
const NIVEL_URGENTE = 3;

/** Preguntas de contexto comunes: deciden si la medición es confiable. */
function preguntasContexto(): array
{
    return [
        [
            'id' => 'ctx_reposo', 'tipo' => 'booleano', 'requerida' => true,
            'etiqueta' => 'pregunta_ctx_reposo', 'ayuda' => 'pregunta_ctx_reposo_ayuda',
        ],
        [
            'id' => 'ctx_estimulante', 'tipo' => 'booleano', 'requerida' => true,
            'etiqueta' => 'pregunta_ctx_estimulante', 'ayuda' => 'pregunta_ctx_estimulante_ayuda',
        ],
        [
            'id' => 'ctx_malestar', 'tipo' => 'booleano', 'requerida' => true,
            'etiqueta' => 'pregunta_ctx_malestar', 'ayuda' => 'pregunta_ctx_malestar_ayuda',
        ],
    ];
}

/**
 * Catálogo completo por condición.
 *
 * @return array<string, array{etiqueta: string, basales: array, preguntas: array}>
 */
function catalogoSegmentacion(): array
{
    return [
        'hipertension' => [
            'etiqueta' => 'cronica_hipertension',
            'basales' => [
                ['id' => 'meta_sistolica', 'tipo' => 'numero', 'min' => 110, 'max' => 160, 'defecto' => 140,
                 'unidad' => 'mmHg', 'etiqueta' => 'basal_meta_sistolica'],
                ['id' => 'meta_diastolica', 'tipo' => 'numero', 'min' => 60, 'max' => 100, 'defecto' => 90,
                 'unidad' => 'mmHg', 'etiqueta' => 'basal_meta_diastolica'],
            ],
            'preguntas' => [
                ['id' => 'presion_1', 'tipo' => 'presion', 'requerida' => true,
                 'etiqueta' => 'pregunta_presion_1', 'ayuda' => 'pregunta_presion_1_ayuda'],
                ['id' => 'presion_2', 'tipo' => 'presion', 'requerida' => true,
                 'etiqueta' => 'pregunta_presion_2', 'ayuda' => 'pregunta_presion_2_ayuda'],
                ['id' => 'frecuencia_cardiaca', 'tipo' => 'numero', 'min' => 30, 'max' => 220, 'requerida' => false,
                 'unidad' => 'lpm', 'etiqueta' => 'pregunta_frecuencia_cardiaca'],
                ['id' => 'sintomas', 'tipo' => 'opcion_multiple', 'requerida' => true,
                 'opciones' => ['cefalea_intensa', 'vision_borrosa', 'dolor_toracico', 'disnea', 'debilidad_unilateral', 'ninguno'],
                 'etiqueta' => 'pregunta_sintomas_hipertension'],
                ['id' => 'olvido_dosis', 'tipo' => 'numero', 'min' => 0, 'max' => 30, 'requerida' => true,
                 'etiqueta' => 'pregunta_olvido_dosis'],
            ],
        ],

        'diabetes' => [
            'etiqueta' => 'cronica_diabetes',
            'basales' => [
                ['id' => 'tipo_diabetes', 'tipo' => 'opcion', 'opciones' => ['tipo_1', 'tipo_2', 'gestacional'],
                 'defecto' => 'tipo_2', 'etiqueta' => 'basal_tipo_diabetes'],
                ['id' => 'meta_ayuno', 'tipo' => 'numero', 'min' => 80, 'max' => 180, 'defecto' => 130,
                 'unidad' => 'mg/dL', 'etiqueta' => 'basal_meta_ayuno'],
            ],
            'preguntas' => [
                ['id' => 'momento', 'tipo' => 'opcion', 'requerida' => true,
                 'opciones' => ['ayuno', 'postprandial', 'aleatorio'], 'etiqueta' => 'pregunta_momento_glucosa'],
                ['id' => 'glucosa', 'tipo' => 'numero', 'min' => 20, 'max' => 800, 'requerida' => true,
                 'unidad' => 'mg/dL', 'etiqueta' => 'pregunta_glucosa'],
                ['id' => 'sintomas_hipo', 'tipo' => 'opcion_multiple', 'requerida' => true,
                 'opciones' => ['temblor', 'sudor_frio', 'confusion', 'mareo', 'ninguno'],
                 'etiqueta' => 'pregunta_sintomas_hipo'],
                ['id' => 'sintomas_hiper', 'tipo' => 'opcion_multiple', 'requerida' => true,
                 'opciones' => ['sed_intensa', 'orina_frecuente', 'vision_borrosa', 'nausea_vomito', 'ninguno'],
                 'etiqueta' => 'pregunta_sintomas_hiper'],
                ['id' => 'herida_sin_cerrar', 'tipo' => 'booleano', 'requerida' => true,
                 'etiqueta' => 'pregunta_herida_sin_cerrar', 'ayuda' => 'pregunta_herida_sin_cerrar_ayuda'],
            ],
        ],

        'asma_epoc' => [
            'etiqueta' => 'cronica_asma_epoc',
            'basales' => [
                ['id' => 'mejor_pef', 'tipo' => 'numero', 'min' => 50, 'max' => 900, 'requerida' => true,
                 'unidad' => 'L/min', 'etiqueta' => 'basal_mejor_pef', 'ayuda' => 'basal_mejor_pef_ayuda'],
            ],
            'preguntas' => [
                ['id' => 'pef', 'tipo' => 'numero', 'min' => 30, 'max' => 900, 'requerida' => true,
                 'unidad' => 'L/min', 'etiqueta' => 'pregunta_pef', 'ayuda' => 'pregunta_pef_ayuda'],
                ['id' => 'usos_rescate_semana', 'tipo' => 'numero', 'min' => 0, 'max' => 50, 'requerida' => true,
                 'etiqueta' => 'pregunta_usos_rescate'],
                ['id' => 'despertares_nocturnos', 'tipo' => 'numero', 'min' => 0, 'max' => 7, 'requerida' => true,
                 'etiqueta' => 'pregunta_despertares'],
                ['id' => 'dificultad_hablar', 'tipo' => 'booleano', 'requerida' => true,
                 'etiqueta' => 'pregunta_dificultad_hablar'],
                ['id' => 'labios_azulados', 'tipo' => 'booleano', 'requerida' => true,
                 'etiqueta' => 'pregunta_labios_azulados'],
            ],
        ],

        'cardiopatia' => [
            'etiqueta' => 'cronica_cardiopatia',
            'basales' => [
                ['id' => 'peso_seco_kg', 'tipo' => 'numero', 'min' => 30, 'max' => 250, 'requerida' => true,
                 'unidad' => 'kg', 'etiqueta' => 'basal_peso_seco', 'ayuda' => 'basal_peso_seco_ayuda'],
            ],
            'preguntas' => [
                ['id' => 'dolor_toracico_reposo', 'tipo' => 'booleano', 'requerida' => true,
                 'etiqueta' => 'pregunta_dolor_toracico_reposo'],
                ['id' => 'disnea_nyha', 'tipo' => 'opcion', 'requerida' => true,
                 'opciones' => ['i', 'ii', 'iii', 'iv'], 'etiqueta' => 'pregunta_disnea_nyha',
                 'ayuda' => 'pregunta_disnea_nyha_ayuda'],
                ['id' => 'ortopnea', 'tipo' => 'booleano', 'requerida' => true,
                 'etiqueta' => 'pregunta_ortopnea', 'ayuda' => 'pregunta_ortopnea_ayuda'],
                ['id' => 'edema_piernas', 'tipo' => 'opcion', 'requerida' => true,
                 'opciones' => ['ninguno', 'leve', 'moderado', 'severo'], 'etiqueta' => 'pregunta_edema_piernas'],
                ['id' => 'peso_kg', 'tipo' => 'numero', 'min' => 30, 'max' => 300, 'requerida' => true,
                 'unidad' => 'kg', 'etiqueta' => 'pregunta_peso_hoy'],
                ['id' => 'frecuencia_cardiaca', 'tipo' => 'numero', 'min' => 30, 'max' => 220, 'requerida' => false,
                 'unidad' => 'lpm', 'etiqueta' => 'pregunta_frecuencia_cardiaca'],
            ],
        ],

        'renal' => [
            'etiqueta' => 'cronica_renal',
            'basales' => [
                ['id' => 'etapa_erc', 'tipo' => 'opcion', 'opciones' => ['1', '2', '3', '4', '5'],
                 'defecto' => '3', 'etiqueta' => 'basal_etapa_erc'],
            ],
            'preguntas' => [
                ['id' => 'volumen_orina', 'tipo' => 'opcion', 'requerida' => true,
                 'opciones' => ['normal', 'disminuido', 'muy_disminuido'], 'etiqueta' => 'pregunta_volumen_orina'],
                ['id' => 'edema', 'tipo' => 'opcion', 'requerida' => true,
                 'opciones' => ['ninguno', 'piernas', 'facial', 'generalizado'], 'etiqueta' => 'pregunta_edema'],
                ['id' => 'presion', 'tipo' => 'presion', 'requerida' => true, 'etiqueta' => 'pregunta_presion_1'],
                ['id' => 'nausea_vomito', 'tipo' => 'booleano', 'requerida' => true,
                 'etiqueta' => 'pregunta_nausea_vomito'],
                ['id' => 'calambres', 'tipo' => 'booleano', 'requerida' => true, 'etiqueta' => 'pregunta_calambres'],
                ['id' => 'confusion', 'tipo' => 'booleano', 'requerida' => true, 'etiqueta' => 'pregunta_confusion'],
            ],
        ],
    ];
}

/** Cuestionario completo de una condición: contexto + preguntas propias. */
function cuestionarioDe(string $condicion): array
{
    $definicion = catalogoSegmentacion()[$condicion] ?? throw new HttpError(
        404, 'condicion_no_encontrada', 'Esa enfermedad crónica no está en el catálogo.'
    );
    return [
        'condicion' => $condicion,
        'etiqueta' => $definicion['etiqueta'],
        'basales' => $definicion['basales'],
        'preguntas' => array_merge(preguntasContexto(), $definicion['preguntas']),
    ];
}

// ---------------------------------------------------------------- validación

/** Presión arterial `sistólica/diastólica`; devuelve [sistólica, diastólica]. */
function partesPresion(string $valor, string $campo): array
{
    if (!preg_match('/^(\d{2,3})\/(\d{2,3})$/', $valor, $m) || (int) $m[1] <= (int) $m[2]) {
        throw errorCampo('presion_invalida', $campo, 'La presión debe tener formato sistólica/diastólica, p. ej. 120/80.');
    }
    return [(int) $m[1], (int) $m[2]];
}

/**
 * Valida las respuestas contra la definición del cuestionario y las normaliza.
 * Ignora cualquier clave que no esté declarada.
 *
 * @param array<int, array> $preguntas
 */
function validarRespuestas(array $preguntas, array $datos): array
{
    $respuestas = [];
    foreach ($preguntas as $pregunta) {
        $id = (string) $pregunta['id'];
        $requerida = (bool) ($pregunta['requerida'] ?? false);
        $ausente = !array_key_exists($id, $datos) || $datos[$id] === null || $datos[$id] === '';

        if ($ausente) {
            if ($requerida) {
                throw errorCampo('campo_requerido', $id, "La pregunta '$id' es obligatoria.");
            }
            continue;
        }

        $respuestas[$id] = match ($pregunta['tipo']) {
            'booleano' => booleano($datos, $id),
            'numero' => numero($datos, $id, true, (float) ($pregunta['min'] ?? 0), (float) ($pregunta['max'] ?? 1000)),
            'opcion' => opcion($datos, $id, $pregunta['opciones'], true),
            'presion' => partesPresion((string) texto($datos, $id, true, 7), $id),
            'opcion_multiple' => validarOpcionMultiple($datos[$id], $pregunta['opciones'], $id),
            default => texto($datos, $id, true, 255),
        };
        if ($pregunta['tipo'] === 'presion') {
            $respuestas[$id] = implode('/', $respuestas[$id]);
        }
    }
    return $respuestas;
}

function validarOpcionMultiple(mixed $valor, array $opciones, string $campo): array
{
    if (!is_array($valor)) {
        throw errorCampo('campo_invalido', $campo, "El campo '$campo' debe ser una lista de opciones.");
    }
    $seleccion = [];
    foreach ($valor as $elemento) {
        if (!is_string($elemento) || !in_array($elemento, $opciones, true)) {
            throw errorCampo('opcion_invalida', $campo, "Valor no permitido para '$campo'.", ['opciones' => $opciones]);
        }
        $seleccion[] = $elemento;
    }
    if ($seleccion === []) {
        throw errorCampo('campo_requerido', $campo, "La pregunta '$campo' es obligatoria.");
    }
    return array_values(array_unique($seleccion));
}

/** Valores basales con los valores por omisión del catálogo ya aplicados. */
function basalesConDefectos(string $condicion, ?array $guardados): array
{
    $basales = $guardados ?? [];
    foreach (catalogoSegmentacion()[$condicion]['basales'] ?? [] as $definicion) {
        $id = (string) $definicion['id'];
        if (!isset($basales[$id]) && array_key_exists('defecto', $definicion)) {
            $basales[$id] = $definicion['defecto'];
        }
    }
    return $basales;
}

// ---------------------------------------------------------------- evaluación

function contiene(array $respuestas, string $campo, string $valor): bool
{
    $seleccion = $respuestas[$campo] ?? [];
    return is_array($seleccion) && in_array($valor, $seleccion, true);
}

/**
 * Aplica las reglas de la condición.
 *
 * @return array{segmento: string, severidad: string, banderas: array, confiable: bool,
 *               recomendaciones: array<int, string>, metrica: array<string, mixed>}
 */
function evaluarSegmentacion(string $condicion, array $respuestas, array $basales): array
{
    $confiable = ($respuestas['ctx_reposo'] ?? true) === true
        && ($respuestas['ctx_estimulante'] ?? false) === false
        && ($respuestas['ctx_malestar'] ?? false) === false;

    [$nivel, $banderas, $metrica] = match ($condicion) {
        'hipertension' => reglasHipertension($respuestas, $basales),
        'diabetes' => reglasDiabetes($respuestas, $basales),
        'asma_epoc' => reglasAsmaEpoc($respuestas, $basales),
        'cardiopatia' => reglasCardiopatia($respuestas, $basales),
        'renal' => reglasRenal($respuestas, $basales),
    };

    // Una toma tomada en malas condiciones no puede, por sí sola, mandar una
    // alerta al médico: se degrada y se le pide al paciente repetirla.
    $recomendaciones = [];
    $hayBanderaRoja = array_filter($banderas, fn (array $b) => ($b['roja'] ?? false) === true) !== [];
    if (!$confiable && $nivel >= NIVEL_RIESGO && !$hayBanderaRoja) {
        $nivel = NIVEL_SEGUIMIENTO;
        $banderas[] = ['codigo' => 'medicion_no_confiable', 'roja' => false, 'datos' => []];
        $recomendaciones[] = 'reco_repetir_medicion';
    }

    $recomendaciones[] = match ($nivel) {
        NIVEL_URGENTE => 'reco_urgencias',
        NIVEL_RIESGO => 'reco_contactar_medico',
        NIVEL_SEGUIMIENTO => 'reco_vigilar',
        default => 'reco_continuar',
    };

    return [
        'segmento' => match ($nivel) {
            NIVEL_URGENTE, NIVEL_RIESGO => 'riesgo',
            NIVEL_SEGUIMIENTO => 'seguimiento',
            default => 'controlado',
        },
        'severidad' => match ($nivel) {
            NIVEL_URGENTE => 'urgente',
            NIVEL_RIESGO => 'atencion',
            default => 'informativa',
        },
        'banderas' => array_values($banderas),
        'confiable' => $confiable,
        'recomendaciones' => array_values(array_unique($recomendaciones)),
        'metrica' => array_filter($metrica, fn ($v) => $v !== null),
    ];
}

// ---------------------------------------------------------------- reglas por condición
// Cada función devuelve [nivel, banderas, medidas para metricas_vitales].
// Una bandera con `roja` en true es un signo de alarma: alerta al médico aunque
// el contexto de la medición no sea confiable.

function reglasHipertension(array $r, array $basales): array
{
    [$s1, $d1] = partesPresion((string) $r['presion_1'], 'presion_1');
    [$s2, $d2] = partesPresion((string) $r['presion_2'], 'presion_2');
    $sistolica = (int) round(($s1 + $s2) / 2);
    $diastolica = (int) round(($d1 + $d2) / 2);
    $metaS = (int) ($basales['meta_sistolica'] ?? 140);
    $metaD = (int) ($basales['meta_diastolica'] ?? 90);

    $banderas = [];
    $nivel = NIVEL_CONTROLADO;
    $datosPresion = ['sistolica' => $sistolica, 'diastolica' => $diastolica];

    foreach (['dolor_toracico', 'disnea', 'debilidad_unilateral'] as $sintoma) {
        if (contiene($r, 'sintomas', $sintoma)) {
            $banderas[] = ['codigo' => "sintoma_$sintoma", 'roja' => true, 'datos' => []];
            $nivel = NIVEL_URGENTE;
        }
    }

    if ($sistolica >= 180 || $diastolica >= 120) {
        $banderas[] = ['codigo' => 'crisis_hipertensiva', 'roja' => true, 'datos' => $datosPresion];
        $nivel = NIVEL_URGENTE;
    } elseif ($sistolica < 90 || $diastolica < 60) {
        $banderas[] = ['codigo' => 'hipotension', 'roja' => false, 'datos' => $datosPresion];
        $nivel = max($nivel, NIVEL_RIESGO);
    } elseif ($s1 >= $metaS || $d1 >= $metaD) {
        // Sólo se considera elevada si ambas tomas lo confirman: una sola lectura
        // alta es la fuente más común de falsos positivos.
        if ($s2 >= $metaS || $d2 >= $metaD) {
            $banderas[] = ['codigo' => 'presion_elevada_confirmada', 'roja' => false, 'datos' => $datosPresion];
            $nivel = max($nivel, NIVEL_RIESGO);
        } else {
            $banderas[] = ['codigo' => 'presion_elevada_sin_confirmar', 'roja' => false, 'datos' => $datosPresion];
            $nivel = max($nivel, NIVEL_SEGUIMIENTO);
        }
    } elseif ($sistolica >= 130 || $diastolica >= 85) {
        $banderas[] = ['codigo' => 'presion_limitrofe', 'roja' => false, 'datos' => $datosPresion];
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    if (contiene($r, 'sintomas', 'cefalea_intensa') || contiene($r, 'sintomas', 'vision_borrosa')) {
        $banderas[] = ['codigo' => 'sintomas_neurologicos', 'roja' => false, 'datos' => []];
        $nivel = max($nivel, NIVEL_RIESGO);
    }

    $olvidos = (int) ($r['olvido_dosis'] ?? 0);
    if ($olvidos >= 3) {
        $banderas[] = ['codigo' => 'adherencia_baja', 'roja' => false, 'datos' => ['dosis' => $olvidos]];
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    return [$nivel, $banderas, [
        'presion_arterial' => "$sistolica/$diastolica",
        'frecuencia_cardiaca' => isset($r['frecuencia_cardiaca']) ? (int) $r['frecuencia_cardiaca'] : null,
    ]];
}

function reglasDiabetes(array $r, array $basales): array
{
    $glucosa = (float) $r['glucosa'];
    $momento = (string) $r['momento'];
    $metaAyuno = (float) ($basales['meta_ayuno'] ?? 130);
    $banderas = [];
    $nivel = NIVEL_CONTROLADO;
    $datos = ['glucosa' => $glucosa, 'momento' => $momento];

    if ($glucosa < 54) {
        $banderas[] = ['codigo' => 'hipoglucemia_severa', 'roja' => true, 'datos' => $datos];
        $nivel = NIVEL_URGENTE;
    } elseif ($glucosa < 70) {
        $banderas[] = ['codigo' => 'hipoglucemia', 'roja' => false, 'datos' => $datos];
        $nivel = NIVEL_RIESGO;
        if (contiene($r, 'sintomas_hipo', 'confusion')) {
            $banderas[] = ['codigo' => 'hipoglucemia_con_confusion', 'roja' => true, 'datos' => $datos];
            $nivel = NIVEL_URGENTE;
        }
    } elseif ($glucosa > 400 || ($glucosa > 300 && contiene($r, 'sintomas_hiper', 'nausea_vomito'))) {
        $banderas[] = ['codigo' => 'sospecha_cetoacidosis', 'roja' => true, 'datos' => $datos];
        $nivel = NIVEL_URGENTE;
    } else {
        [$limiteSeguimiento, $limiteRiesgo] = match ($momento) {
            'ayuno' => [$metaAyuno, 180.0],
            'postprandial' => [180.0, 250.0],
            default => [200.0, 300.0],
        };
        if ($glucosa > $limiteRiesgo) {
            $banderas[] = ['codigo' => 'glucosa_alta', 'roja' => false, 'datos' => $datos];
            $nivel = NIVEL_RIESGO;
        } elseif ($glucosa > $limiteSeguimiento) {
            $banderas[] = ['codigo' => 'glucosa_sobre_meta', 'roja' => false, 'datos' => $datos];
            $nivel = NIVEL_SEGUIMIENTO;
        }
    }

    if (($r['herida_sin_cerrar'] ?? false) === true) {
        $banderas[] = ['codigo' => 'herida_sin_cerrar', 'roja' => false, 'datos' => []];
        $nivel = max($nivel, NIVEL_RIESGO);
    }
    if (contiene($r, 'sintomas_hiper', 'sed_intensa') && contiene($r, 'sintomas_hiper', 'orina_frecuente')) {
        $banderas[] = ['codigo' => 'sintomas_hiperglucemia', 'roja' => false, 'datos' => []];
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    return [$nivel, $banderas, ['glucosa_mg_dl' => $glucosa]];
}

function reglasAsmaEpoc(array $r, array $basales): array
{
    $pef = (float) $r['pef'];
    $mejor = (float) ($basales['mejor_pef'] ?? 0);
    $porcentaje = $mejor > 0 ? (int) round($pef / $mejor * 100) : null;
    $banderas = [];
    $nivel = NIVEL_CONTROLADO;
    $datos = ['pef' => $pef, 'porcentaje' => $porcentaje];

    if (($r['labios_azulados'] ?? false) === true || ($r['dificultad_hablar'] ?? false) === true) {
        $banderas[] = ['codigo' => 'crisis_respiratoria', 'roja' => true, 'datos' => $datos];
        $nivel = NIVEL_URGENTE;
    }

    // Zonas del plan de acción: verde >=80%, amarilla 50-79%, roja <50% del mejor personal.
    if ($porcentaje === null) {
        $banderas[] = ['codigo' => 'sin_mejor_pef', 'roja' => false, 'datos' => []];
    } elseif ($porcentaje < 50) {
        $banderas[] = ['codigo' => 'pef_zona_roja', 'roja' => false, 'datos' => $datos];
        $nivel = max($nivel, NIVEL_RIESGO);
    } elseif ($porcentaje < 80) {
        $banderas[] = ['codigo' => 'pef_zona_amarilla', 'roja' => false, 'datos' => $datos];
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    $usos = (int) ($r['usos_rescate_semana'] ?? 0);
    if ($usos > 2) {
        $banderas[] = ['codigo' => 'rescate_frecuente', 'roja' => false, 'datos' => ['usos' => $usos]];
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }
    $despertares = (int) ($r['despertares_nocturnos'] ?? 0);
    if ($despertares >= 2) {
        $banderas[] = ['codigo' => 'despertares_nocturnos', 'roja' => false, 'datos' => ['noches' => $despertares]];
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    return [$nivel, $banderas, []];
}

function reglasCardiopatia(array $r, array $basales): array
{
    $banderas = [];
    $nivel = NIVEL_CONTROLADO;
    $peso = (float) $r['peso_kg'];
    $pesoSeco = (float) ($basales['peso_seco_kg'] ?? 0);
    $nyha = (string) $r['disnea_nyha'];
    $edema = (string) $r['edema_piernas'];

    if (($r['dolor_toracico_reposo'] ?? false) === true) {
        $banderas[] = ['codigo' => 'dolor_toracico_reposo', 'roja' => true, 'datos' => []];
        $nivel = NIVEL_URGENTE;
    }
    if ($nyha === 'iv') {
        $banderas[] = ['codigo' => 'disnea_reposo', 'roja' => true, 'datos' => ['nyha' => $nyha]];
        $nivel = NIVEL_URGENTE;
    } elseif ($nyha === 'iii') {
        $banderas[] = ['codigo' => 'disnea_esfuerzo_minimo', 'roja' => false, 'datos' => ['nyha' => $nyha]];
        $nivel = max($nivel, NIVEL_RIESGO);
    } elseif ($nyha === 'ii') {
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    // Retención de líquidos: el aumento sobre el peso seco es el aviso más
    // temprano de descompensación, antes de que aparezca la disnea.
    if ($pesoSeco > 0) {
        $aumento = round($peso - $pesoSeco, 1);
        if ($aumento >= 2) {
            $banderas[] = ['codigo' => 'aumento_peso', 'roja' => false, 'datos' => ['kg' => $aumento]];
            $nivel = max($nivel, NIVEL_RIESGO);
        } elseif ($aumento >= 1) {
            $banderas[] = ['codigo' => 'aumento_peso_leve', 'roja' => false, 'datos' => ['kg' => $aumento]];
            $nivel = max($nivel, NIVEL_SEGUIMIENTO);
        }
    }

    if (in_array($edema, ['moderado', 'severo'], true) || ($r['ortopnea'] ?? false) === true) {
        $banderas[] = ['codigo' => 'congestion', 'roja' => false, 'datos' => ['edema' => $edema]];
        $nivel = max($nivel, NIVEL_RIESGO);
    } elseif ($edema === 'leve') {
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    $fc = isset($r['frecuencia_cardiaca']) ? (int) $r['frecuencia_cardiaca'] : null;
    if ($fc !== null && ($fc > 120 || $fc < 45)) {
        $banderas[] = ['codigo' => 'frecuencia_anormal', 'roja' => false, 'datos' => ['lpm' => $fc]];
        $nivel = max($nivel, NIVEL_RIESGO);
    }

    return [$nivel, $banderas, ['peso_kg' => $peso, 'frecuencia_cardiaca' => $fc]];
}

function reglasRenal(array $r, array $basales): array
{
    $banderas = [];
    $nivel = NIVEL_CONTROLADO;
    [$sistolica, $diastolica] = partesPresion((string) $r['presion'], 'presion');
    $volumen = (string) $r['volumen_orina'];
    $edema = (string) $r['edema'];

    if ($volumen === 'muy_disminuido') {
        $banderas[] = ['codigo' => 'oliguria', 'roja' => true, 'datos' => []];
        $nivel = NIVEL_URGENTE;
    } elseif ($volumen === 'disminuido') {
        $banderas[] = ['codigo' => 'volumen_orina_bajo', 'roja' => false, 'datos' => []];
        $nivel = max($nivel, NIVEL_RIESGO);
    }

    if (($r['confusion'] ?? false) === true && ($r['nausea_vomito'] ?? false) === true) {
        $banderas[] = ['codigo' => 'sospecha_uremia', 'roja' => true, 'datos' => []];
        $nivel = NIVEL_URGENTE;
    }

    if (in_array($edema, ['facial', 'generalizado'], true)) {
        $banderas[] = ['codigo' => 'edema_generalizado', 'roja' => false, 'datos' => ['edema' => $edema]];
        $nivel = max($nivel, NIVEL_RIESGO);
    } elseif ($edema === 'piernas') {
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    if ($sistolica >= 160 || $diastolica >= 100) {
        $banderas[] = ['codigo' => 'presion_elevada_confirmada', 'roja' => false,
                       'datos' => ['sistolica' => $sistolica, 'diastolica' => $diastolica]];
        $nivel = max($nivel, NIVEL_RIESGO);
    }

    if (($r['calambres'] ?? false) === true || ($r['nausea_vomito'] ?? false) === true) {
        $nivel = max($nivel, NIVEL_SEGUIMIENTO);
    }

    return [$nivel, $banderas, ['presion_arterial' => "$sistolica/$diastolica"]];
}
