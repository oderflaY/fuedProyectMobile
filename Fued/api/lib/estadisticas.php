<?php
declare(strict_types=1);

// Agregados de todo el sistema que expone GraphQL (api/lib/graphql.php).
// Sólo devuelven conteos y promedios, nunca datos de un paciente en particular.
// Recorren cientos de miles de filas, así que cada resultado se cachea unos minutos.

const ESTADISTICAS_CACHE_SEGUNDOS = 300;

function estadisticaCacheada(string $clave, callable $calcular): array
{
    $archivo = sys_get_temp_dir() . '/fued-estadistica-' . md5($clave) . '.json';
    if (is_file($archivo) && time() - (int) filemtime($archivo) < ESTADISTICAS_CACHE_SEGUNDOS) {
        $guardado = json_decode((string) file_get_contents($archivo), true);
        if (is_array($guardado)) {
            return $guardado;
        }
    }
    $resultado = $calcular();
    @file_put_contents($archivo, json_encode($resultado), LOCK_EX);
    return $resultado;
}

/** Primer día (UTC) del mes que abre una ventana de $meses meses que termina en el actual. */
function inicioVentana(int $meses): string
{
    return (new DateTimeImmutable('first day of this month 00:00', new DateTimeZone('UTC')))
        ->modify('-' . ($meses - 1) . ' months')->format('Y-m-d H:i:s');
}

/** Lista de meses 'YYYY-MM' de la ventana, para rellenar con ceros los meses sin datos. */
function mesesVentana(int $meses): array
{
    $inicio = new DateTimeImmutable(inicioVentana($meses), new DateTimeZone('UTC'));
    return array_map(fn (int $i) => $inicio->modify("+$i months")->format('Y-m'), range(0, $meses - 1));
}

/** Convierte filas [mes => ...] en una serie con todos los meses de la ventana. */
function rellenarMeses(int $meses, array $filas, array $ceros): array
{
    $porMes = array_column($filas, null, 'mes');
    return array_map(fn (string $mes) => array_merge($ceros, $porMes[$mes] ?? [], ['mes' => $mes]), mesesVentana($meses));
}

function conteos(string $sql, array $parametros = []): array
{
    return array_map(
        fn (array $f) => ['clave' => (string) $f['clave'], 'valor' => (int) $f['valor']],
        consultar($sql, $parametros)
    );
}

function estadisticaResumen(): array
{
    return estadisticaCacheada('resumen', function (): array {
        $fila = consultarUno(
            'SELECT
                (SELECT COUNT(*) FROM pacientes) AS pacientes,
                (SELECT COUNT(*) FROM medicos) AS medicos,
                (SELECT COUNT(*) FROM citas) AS citas,
                (SELECT COUNT(*) FROM metricas_vitales) AS metricas_vitales,
                (SELECT COUNT(*) FROM registro_adherencia) AS tomas,
                (SELECT COUNT(*) FROM tratamientos) AS tratamientos,
                (SELECT COUNT(*) FROM perfiles_cronicos) AS perfiles_cronicos,
                (SELECT COUNT(*) FROM alertas_clinicas) AS alertas'
        ) ?? [];
        return array_map('intval', $fila);
    });
}

function estadisticaPacientesPorGenero(): array
{
    return estadisticaCacheada('genero', fn () => conteos(
        "SELECT COALESCE(NULLIF(genero, ''), 'Sin dato') AS clave, COUNT(*) AS valor FROM pacientes GROUP BY clave ORDER BY valor DESC"
    ));
}

function estadisticaPacientesPorEdad(): array
{
    return estadisticaCacheada('edad', function (): array {
        $rangos = ['0-17', '18-29', '30-44', '45-59', '60-74', '75+'];
        $filas = array_column(conteos(
            "SELECT CASE
                WHEN edad < 18 THEN '0-17' WHEN edad < 30 THEN '18-29' WHEN edad < 45 THEN '30-44'
                WHEN edad < 60 THEN '45-59' WHEN edad < 75 THEN '60-74' ELSE '75+' END AS clave,
                COUNT(*) AS valor
             FROM (SELECT TIMESTAMPDIFF(YEAR, fecha_nacimiento, CURDATE()) AS edad FROM pacientes WHERE fecha_nacimiento IS NOT NULL) t
             GROUP BY clave"
        ), 'valor', 'clave');
        return array_map(fn (string $r) => ['clave' => $r, 'valor' => $filas[$r] ?? 0], $rangos);
    });
}

function estadisticaPacientesPorTipoSangre(): array
{
    return estadisticaCacheada('sangre', fn () => conteos(
        'SELECT tipo_sangre AS clave, COUNT(*) AS valor FROM pacientes WHERE tipo_sangre IS NOT NULL GROUP BY tipo_sangre ORDER BY valor DESC'
    ));
}

function estadisticaRegistrosPorMes(int $meses): array
{
    return estadisticaCacheada("registros-$meses", fn () => rellenarMeses($meses, array_map(
        fn (array $f) => ['mes' => $f['mes'], 'pacientes' => (int) $f['pacientes'], 'medicos' => (int) $f['medicos']],
        consultar(
            "SELECT DATE_FORMAT(fecha_registro, '%Y-%m') AS mes, SUM(rol = 'paciente') AS pacientes, SUM(rol = 'medico') AS medicos
             FROM cuentas WHERE fecha_registro >= ? GROUP BY mes",
            [inicioVentana($meses)]
        )
    ), ['pacientes' => 0, 'medicos' => 0]));
}

function estadisticaCitasPorMes(int $meses): array
{
    return estadisticaCacheada("citas-$meses", fn () => rellenarMeses($meses, array_map(
        fn (array $f) => array_map(fn ($v) => is_numeric($v) ? (int) $v : $v, $f),
        consultar(
            "SELECT DATE_FORMAT(fecha_hora, '%Y-%m') AS mes,
                    SUM(estado = 'completada') AS completadas, SUM(estado = 'cancelada') AS canceladas,
                    SUM(estado = 'pendiente') AS pendientes, SUM(estado = 'confirmada') AS confirmadas, COUNT(*) AS total
             FROM citas WHERE fecha_hora >= ? AND fecha_hora < ? GROUP BY mes",
            [inicioVentana($meses), gmdate('Y-m-d H:i:s', strtotime('first day of next month 00:00 UTC'))]
        )
    ), ['completadas' => 0, 'canceladas' => 0, 'pendientes' => 0, 'confirmadas' => 0, 'total' => 0]));
}

function estadisticaAdherenciaPorMes(int $meses): array
{
    return estadisticaCacheada("adherencia-$meses", fn () => rellenarMeses($meses, array_map(
        function (array $f): array {
            $total = (int) $f['tomado'] + (int) $f['tomado_tarde'] + (int) $f['omitido'];
            return [
                'mes' => $f['mes'],
                'tomado' => (int) $f['tomado'],
                'tomadoTarde' => (int) $f['tomado_tarde'],
                'omitido' => (int) $f['omitido'],
                'porcentaje' => $total ? round(((int) $f['tomado'] + (int) $f['tomado_tarde']) * 100 / $total, 1) : null,
            ];
        },
        consultar(
            "SELECT DATE_FORMAT(fecha_hora_programada, '%Y-%m') AS mes,
                    SUM(estado = 'tomado') AS tomado, SUM(estado = 'tomado_tarde') AS tomado_tarde, SUM(estado = 'omitido') AS omitido
             FROM registro_adherencia WHERE fecha_hora_programada >= ? GROUP BY mes",
            [inicioVentana($meses)]
        )
    ), ['tomado' => 0, 'tomadoTarde' => 0, 'omitido' => 0, 'porcentaje' => null]));
}

function estadisticaSignosVitalesPorMes(int $meses): array
{
    $promedio = fn ($v) => $v === null ? null : round((float) $v, 1);
    return estadisticaCacheada("vitales-$meses", fn () => rellenarMeses($meses, array_map(
        fn (array $f) => [
            'mes' => $f['mes'],
            'glucosa' => $promedio($f['glucosa']),
            'frecuenciaCardiaca' => $promedio($f['frecuencia']),
            'sistolica' => $promedio($f['sistolica']),
            'diastolica' => $promedio($f['diastolica']),
            'imc' => $promedio($f['imc']),
            'tomas' => (int) $f['tomas'],
        ],
        consultar(
            "SELECT DATE_FORMAT(fecha_toma, '%Y-%m') AS mes, AVG(glucosa_mg_dl) AS glucosa, AVG(frecuencia_cardiaca) AS frecuencia,
                    AVG(CAST(SUBSTRING_INDEX(presion_arterial, '/', 1) AS UNSIGNED)) AS sistolica,
                    AVG(CAST(SUBSTRING_INDEX(presion_arterial, '/', -1) AS UNSIGNED)) AS diastolica,
                    AVG(imc) AS imc, COUNT(*) AS tomas
             FROM metricas_vitales WHERE fecha_toma >= ? GROUP BY mes",
            [inicioVentana($meses)]
        )
    ), ['glucosa' => null, 'frecuenciaCardiaca' => null, 'sistolica' => null, 'diastolica' => null, 'imc' => null, 'tomas' => 0]));
}

function estadisticaSegmentosPorCondicion(): array
{
    return estadisticaCacheada('segmentos', fn () => array_map(
        fn (array $f) => [
            'condicion' => $f['condicion'],
            'controlado' => (int) $f['controlado'],
            'seguimiento' => (int) $f['seguimiento'],
            'riesgo' => (int) $f['riesgo'],
            'sinClasificar' => (int) $f['sin_clasificar'],
        ],
        consultar(
            "SELECT condicion, SUM(segmento = 'controlado') AS controlado, SUM(segmento = 'seguimiento') AS seguimiento,
                    SUM(segmento = 'riesgo') AS riesgo, SUM(segmento = 'sin_clasificar') AS sin_clasificar
             FROM perfiles_cronicos WHERE estado = 'activo' GROUP BY condicion ORDER BY COUNT(*) DESC"
        )
    ));
}

function estadisticaAlertasPorSeveridad(): array
{
    return estadisticaCacheada('alertas-severidad', fn () => conteos(
        "SELECT severidad AS clave, COUNT(*) AS valor FROM alertas_clinicas GROUP BY severidad ORDER BY FIELD(severidad, 'urgente', 'atencion', 'informativa')"
    ));
}

function estadisticaAlertasPorOrigen(): array
{
    return estadisticaCacheada('alertas-origen', fn () => conteos(
        'SELECT origen AS clave, COUNT(*) AS valor FROM alertas_clinicas GROUP BY origen ORDER BY valor DESC'
    ));
}

function estadisticaMedicosPorEspecialidad(): array
{
    return estadisticaCacheada('especialidades', fn () => conteos(
        "SELECT COALESCE(NULLIF(especialidad, ''), 'Sin especialidad') AS clave, COUNT(*) AS valor FROM medicos GROUP BY clave ORDER BY valor DESC"
    ));
}

/** Médicos con más pacientes vinculados; sólo nombre y carga, sin datos de contacto. */
function estadisticaTopMedicos(int $limite): array
{
    return estadisticaCacheada("top-medicos-$limite", fn () => array_map(
        fn (array $f) => [
            'nombre' => trim($f['nombre'] . ' ' . $f['apellidos']),
            'especialidad' => $f['especialidad'],
            'pacientes' => (int) $f['pacientes'],
            'citas' => (int) $f['citas'],
        ],
        consultar(
            "SELECT m.nombre, m.apellidos, m.especialidad,
                    (SELECT COUNT(*) FROM accesos_medicos a WHERE a.id_medico = m.id_medico AND a.revocado_en IS NULL) AS pacientes,
                    (SELECT COUNT(*) FROM citas c WHERE c.id_medico = m.id_medico) AS citas
             FROM medicos m ORDER BY pacientes DESC, citas DESC LIMIT $limite"
        )
    ));
}
