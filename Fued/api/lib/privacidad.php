<?php
declare(strict_types=1);

/**
 * Privacidad selectiva del expediente.
 *
 * El paciente decide qué secciones de su historial se muestran a cada audiencia.
 * El filtro se aplica siempre en el servidor: la app nunca recibe un dato que el
 * paciente ocultó, así que no depende de que la interfaz lo respete.
 *
 * Estados por audiencia:
 *   configurable  el paciente la enciende o apaga.
 *   siempre       no es ocultable (seguridad vital en una urgencia).
 *   nunca         esa audiencia jamás recibe la sección, se configure o no.
 *
 * Una sección oculta no desaparece en silencio: el DTO lleva `privacidad.
 * seccionesOmitidas`, para que el médico sepa que hay datos retenidos y no
 * los confunda con datos inexistentes.
 */

const AUDIENCIAS_PRIVACIDAD = ['medico', 'emergencia', 'exportacion'];

/**
 * Catálogo de secciones. `etiqueta` es la clave de strings.xml que la app usa
 * para nombrarla; aquí no vive ningún texto visible. `defecto` cambia el valor
 * inicial de una audiencia concreta (por omisión, visible).
 *
 * @return array<string, array{etiqueta: string, audiencias: array<string, string>, defecto?: array<string, bool>}>
 */
function seccionesPrivacidad(): array
{
    return [
        'identificaciones' => [
            'etiqueta' => 'privacidad_seccion_identificaciones',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'nunca', 'exportacion' => 'configurable'],
        ],
        'datosPersonales' => [
            'etiqueta' => 'privacidad_seccion_datos_personales',
            'audiencias' => ['medico' => 'siempre', 'emergencia' => 'nunca', 'exportacion' => 'configurable'],
        ],
        'contactosEmergencia' => [
            'etiqueta' => 'privacidad_seccion_contactos',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'configurable', 'exportacion' => 'configurable'],
            'defecto' => ['emergencia' => false],
        ],
        'tipoSangre' => [
            'etiqueta' => 'privacidad_seccion_tipo_sangre',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'siempre', 'exportacion' => 'configurable'],
        ],
        'alergias' => [
            'etiqueta' => 'privacidad_seccion_alergias',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'siempre', 'exportacion' => 'configurable'],
        ],
        'condicionesCriticas' => [
            'etiqueta' => 'privacidad_seccion_condiciones',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'siempre', 'exportacion' => 'configurable'],
        ],
        'medicacionRescate' => [
            'etiqueta' => 'privacidad_seccion_rescate',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'siempre', 'exportacion' => 'configurable'],
        ],
        'tratamientos' => [
            'etiqueta' => 'privacidad_seccion_tratamientos',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'configurable', 'exportacion' => 'configurable'],
            'defecto' => ['emergencia' => false],
        ],
        // Estas secciones no viajan en el escaneo RFID; el paciente puede sumarlas,
        // pero por omisión la tarjeta sigue entregando sólo el perfil reducido
        // que define DM_HistorialMedico.md.
        'metricasVitales' => [
            'etiqueta' => 'privacidad_seccion_metricas',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'configurable', 'exportacion' => 'configurable'],
            'defecto' => ['emergencia' => false],
        ],
        'cirugias' => [
            'etiqueta' => 'privacidad_seccion_cirugias',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'configurable', 'exportacion' => 'configurable'],
            'defecto' => ['emergencia' => false],
        ],
        'segmentacion' => [
            'etiqueta' => 'privacidad_seccion_segmentacion',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'configurable', 'exportacion' => 'configurable'],
            'defecto' => ['emergencia' => false],
        ],
        'adherencia' => [
            'etiqueta' => 'privacidad_seccion_adherencia',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'nunca', 'exportacion' => 'configurable'],
        ],
        'dispositivosRfid' => [
            'etiqueta' => 'privacidad_seccion_rfid',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'nunca', 'exportacion' => 'configurable'],
            'defecto' => ['medico' => false],
        ],
        'controlAccesos' => [
            'etiqueta' => 'privacidad_seccion_accesos',
            'audiencias' => ['medico' => 'configurable', 'emergencia' => 'nunca', 'exportacion' => 'configurable'],
            'defecto' => ['medico' => false],
        ],
    ];
}

function esAudienciaValida(string $audiencia): bool
{
    return in_array($audiencia, AUDIENCIAS_PRIVACIDAD, true);
}

function reglaPrivacidad(string $seccion, string $audiencia): string
{
    return seccionesPrivacidad()[$seccion]['audiencias'][$audiencia] ?? 'nunca';
}

function esConfigurable(string $seccion, string $audiencia): bool
{
    return reglaPrivacidad($seccion, $audiencia) === 'configurable';
}

function defectoPrivacidad(string $seccion, string $audiencia): bool
{
    return seccionesPrivacidad()[$seccion]['defecto'][$audiencia] ?? true;
}

/**
 * Decide si una sección se entrega a esa audiencia.
 *
 * @param array<string, bool> $preferencias seccion => visible, ya filtradas por audiencia
 */
function seccionVisible(string $seccion, string $audiencia, array $preferencias): bool
{
    return match (reglaPrivacidad($seccion, $audiencia)) {
        'siempre' => true,
        'nunca' => false,
        default => $preferencias[$seccion] ?? defectoPrivacidad($seccion, $audiencia),
    };
}

/**
 * Cómo se vacía cada sección del expediente. Devolver la forma vacía en lugar de
 * borrar la clave mantiene el contrato del DTO: la app no necesita comprobar si
 * existe cada nodo.
 *
 * @return array<string, callable(array): array>
 */
function vaciadoresExpediente(): array
{
    return [
        'identificaciones' => function (array $e): array {
            $e['identificaciones'] = ['curp' => null, 'nss' => null];
            return $e;
        },
        'datosPersonales' => function (array $e): array {
            // El nombre se conserva siempre: sin él el documento no identifica a nadie.
            $e['datosPersonales'] = [
                'nombre' => $e['datosPersonales']['nombre'] ?? '',
                'apellidos' => $e['datosPersonales']['apellidos'] ?? '',
                'fechaNacimiento' => null, 'genero' => null, 'telefono' => null,
            ];
            return $e;
        },
        'contactosEmergencia' => function (array $e): array {
            $e['contactosEmergencia'] = [];
            return $e;
        },
        'tipoSangre' => function (array $e): array {
            $e['perfilEmergenciaReducido']['tipoSangre'] = null;
            $e['perfilEmergenciaReducido']['donadorOrganos'] = null;
            return $e;
        },
        'alergias' => function (array $e): array {
            $e['perfilEmergenciaReducido']['alergias'] = [];
            return $e;
        },
        'condicionesCriticas' => function (array $e): array {
            $e['perfilEmergenciaReducido']['condicionesCriticas'] = [];
            return $e;
        },
        'medicacionRescate' => function (array $e): array {
            $e['perfilEmergenciaReducido']['medicacionRescate'] = [];
            return $e;
        },
        'metricasVitales' => function (array $e): array {
            $e['metricasVitalesActuales'] = null;
            return $e;
        },
        'cirugias' => function (array $e): array {
            $e['historialClinico']['cirugias'] = [];
            return $e;
        },
        'tratamientos' => function (array $e): array {
            $e['tratamientosActivos'] = [];
            return $e;
        },
        'adherencia' => function (array $e): array {
            $e['registroAdherencia'] = [];
            return $e;
        },
        'segmentacion' => function (array $e): array {
            $e['segmentacion'] = [];
            return $e;
        },
        'dispositivosRfid' => function (array $e): array {
            $e['dispositivosRfid'] = [];
            return $e;
        },
        'controlAccesos' => function (array $e): array {
            $e['controlAccesos'] = ['medicosAutorizados' => []];
            return $e;
        },
    ];
}

/**
 * Aplica las preferencias del paciente sobre un expediente ya armado.
 *
 * @param array<string, bool> $preferencias
 */
/** Rutas del DTO que ocupa cada sección; sirve para saber si viaja en ese payload. */
function rutaDeSeccion(string $seccion): array
{
    return match ($seccion) {
        'tipoSangre', 'alergias', 'condicionesCriticas', 'medicacionRescate' => ['perfilEmergenciaReducido'],
        'metricasVitales' => ['metricasVitalesActuales'],
        'cirugias' => ['historialClinico'],
        'tratamientos' => ['tratamientosActivos'],
        'adherencia' => ['registroAdherencia'],
        default => [$seccion],
    };
}

/**
 * Aplica las preferencias del paciente sobre un expediente ya armado. Sólo toca
 * las secciones que ese payload realmente lleva, así el mismo filtro sirve para
 * el expediente completo y para el perfil reducido de la tarjeta RFID.
 *
 * @param array<string, bool> $preferencias
 */
function filtrarExpediente(array $expediente, string $audiencia, array $preferencias): array
{
    $omitidas = [];
    foreach (vaciadoresExpediente() as $seccion => $vaciar) {
        [$raiz] = rutaDeSeccion($seccion);
        if (!array_key_exists($raiz, $expediente)) {
            continue;
        }
        if (!seccionVisible($seccion, $audiencia, $preferencias)) {
            $expediente = $vaciar($expediente);
            $omitidas[] = $seccion;
        }
    }
    $expediente['privacidad'] = ['audiencia' => $audiencia, 'seccionesOmitidas' => $omitidas];
    return $expediente;
}

/**
 * Quita del payload las secciones omitidas en vez de dejarlas vacías, y retira
 * el nodo `privacidad`. Se usa en el escaneo RFID: quien lee la tarjeta no puede
 * pedir más datos, así que enumerarle lo retenido no le sirve de nada, y el
 * contrato de DM_HistorialMedico.md queda intacto cuando el paciente no amplía.
 */
function podarOmitidas(array $payload): array
{
    foreach ($payload['privacidad']['seccionesOmitidas'] ?? [] as $seccion) {
        [$raiz] = rutaDeSeccion((string) $seccion);
        if ($raiz !== 'perfilEmergenciaReducido') {
            unset($payload[$raiz]);
        }
    }
    unset($payload['privacidad']);
    return $payload;
}
