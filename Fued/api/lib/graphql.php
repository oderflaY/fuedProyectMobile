<?php
declare(strict_types=1);

// Esquema GraphQL de las estadísticas del sistema (webonyx/graphql-php, instalado con Composer en api/vendor).
// Un solo POST /graphql trae todo lo que pide el tablero de gráficas de la app.

use GraphQL\Type\Definition\ObjectType;
use GraphQL\Type\Definition\Type;
use GraphQL\Type\Schema;

require_once __DIR__ . '/../vendor/autoload.php';
require_once __DIR__ . '/estadisticas.php';

function esquemaGraphql(): Schema
{
    $meses = [
        'type' => Type::int(),
        'defaultValue' => 12,
        'description' => 'Cuántos meses hacia atrás, contando el actual (1 a 36).',
    ];
    $acotarMeses = fn (array $args): int => max(1, min(36, (int) $args['meses']));
    $lista = fn (Type $tipo) => Type::nonNull(Type::listOf(Type::nonNull($tipo)));
    $entero = Type::nonNull(Type::int());

    $conteo = new ObjectType([
        'name' => 'Conteo',
        'description' => 'Cuántos registros caen en una categoría.',
        'fields' => ['clave' => Type::nonNull(Type::string()), 'valor' => $entero],
    ]);

    $resumen = new ObjectType([
        'name' => 'Resumen',
        'description' => 'Totales de todo el sistema.',
        'fields' => [
            'pacientes' => $entero,
            'medicos' => $entero,
            'citas' => $entero,
            'metricasVitales' => ['type' => $entero, 'resolve' => fn (array $r) => $r['metricas_vitales']],
            'tomas' => $entero,
            'tratamientos' => $entero,
            'perfilesCronicos' => ['type' => $entero, 'resolve' => fn (array $r) => $r['perfiles_cronicos']],
            'alertas' => $entero,
        ],
    ]);

    $registrosMes = new ObjectType([
        'name' => 'RegistrosMes',
        'fields' => ['mes' => Type::nonNull(Type::string()), 'pacientes' => $entero, 'medicos' => $entero],
    ]);

    $citasMes = new ObjectType([
        'name' => 'CitasMes',
        'fields' => [
            'mes' => Type::nonNull(Type::string()),
            'completadas' => $entero,
            'canceladas' => $entero,
            'pendientes' => $entero,
            'confirmadas' => $entero,
            'total' => $entero,
        ],
    ]);

    $adherenciaMes = new ObjectType([
        'name' => 'AdherenciaMes',
        'fields' => [
            'mes' => Type::nonNull(Type::string()),
            'tomado' => $entero,
            'tomadoTarde' => $entero,
            'omitido' => $entero,
            'porcentaje' => ['type' => Type::float(), 'description' => 'Tomas hechas (a tiempo o tarde) sobre el total.'],
        ],
    ]);

    $vitalesMes = new ObjectType([
        'name' => 'SignosVitalesMes',
        'description' => 'Promedios mensuales de todas las tomas de signos vitales.',
        'fields' => [
            'mes' => Type::nonNull(Type::string()),
            'glucosa' => Type::float(),
            'frecuenciaCardiaca' => Type::float(),
            'sistolica' => Type::float(),
            'diastolica' => Type::float(),
            'imc' => Type::float(),
            'tomas' => $entero,
        ],
    ]);

    $segmentos = new ObjectType([
        'name' => 'SegmentosCondicion',
        'description' => 'Pacientes por segmento de control en cada enfermedad crónica.',
        'fields' => [
            'condicion' => Type::nonNull(Type::string()),
            'controlado' => $entero,
            'seguimiento' => $entero,
            'riesgo' => $entero,
            'sinClasificar' => $entero,
        ],
    ]);

    $medicoCarga = new ObjectType([
        'name' => 'MedicoCarga',
        'fields' => [
            'nombre' => Type::nonNull(Type::string()),
            'especialidad' => Type::string(),
            'pacientes' => $entero,
            'citas' => $entero,
        ],
    ]);

    $consulta = new ObjectType([
        'name' => 'Query',
        'fields' => [
            'resumen' => ['type' => Type::nonNull($resumen), 'resolve' => fn () => estadisticaResumen()],
            'pacientesPorGenero' => ['type' => $lista($conteo), 'resolve' => fn () => estadisticaPacientesPorGenero()],
            'pacientesPorEdad' => ['type' => $lista($conteo), 'resolve' => fn () => estadisticaPacientesPorEdad()],
            'pacientesPorTipoSangre' => ['type' => $lista($conteo), 'resolve' => fn () => estadisticaPacientesPorTipoSangre()],
            'registrosPorMes' => [
                'type' => $lista($registrosMes),
                'args' => ['meses' => $meses],
                'resolve' => fn ($raiz, array $args) => estadisticaRegistrosPorMes($acotarMeses($args)),
            ],
            'citasPorMes' => [
                'type' => $lista($citasMes),
                'args' => ['meses' => $meses],
                'resolve' => fn ($raiz, array $args) => estadisticaCitasPorMes($acotarMeses($args)),
            ],
            'adherenciaPorMes' => [
                'type' => $lista($adherenciaMes),
                'args' => ['meses' => $meses],
                'resolve' => fn ($raiz, array $args) => estadisticaAdherenciaPorMes($acotarMeses($args)),
            ],
            'signosVitalesPorMes' => [
                'type' => $lista($vitalesMes),
                'args' => ['meses' => $meses],
                'resolve' => fn ($raiz, array $args) => estadisticaSignosVitalesPorMes($acotarMeses($args)),
            ],
            'segmentosPorCondicion' => ['type' => $lista($segmentos), 'resolve' => fn () => estadisticaSegmentosPorCondicion()],
            'alertasPorSeveridad' => ['type' => $lista($conteo), 'resolve' => fn () => estadisticaAlertasPorSeveridad()],
            'alertasPorOrigen' => ['type' => $lista($conteo), 'resolve' => fn () => estadisticaAlertasPorOrigen()],
            'medicosPorEspecialidad' => ['type' => $lista($conteo), 'resolve' => fn () => estadisticaMedicosPorEspecialidad()],
            'topMedicos' => [
                'type' => $lista($medicoCarga),
                'args' => ['limite' => ['type' => Type::int(), 'defaultValue' => 10]],
                'resolve' => fn ($raiz, array $args) => estadisticaTopMedicos(max(1, min(50, (int) $args['limite']))),
            ],
        ],
    ]);

    return new Schema(['query' => $consulta]);
}
