<?php
declare(strict_types=1);

/**
 * Control de privacidad del expediente. Sólo el propio paciente lee y cambia
 * estas preferencias: un médico no puede consultar (ni menos cambiar) lo que
 * el paciente eligió ocultarle.
 */
return function (Router $r): void {
    $r->get('/pacientes/{id}/privacidad', function (array $p): void {
        autorizarPaciente(sesion('paciente'), $p['id']);
        responder(PreferenciaPrivacidad::tablero($p['id']));
    });

    /**
     * Cuerpo: { "audiencia": "medico", "secciones": { "cirugias": false, ... } }
     * Rechaza las secciones que el catálogo no deja configurar en esa audiencia,
     * en vez de ignorarlas en silencio.
     */
    $r->put('/pacientes/{id}/privacidad', function (array $p): void {
        autorizarPaciente(sesion('paciente'), $p['id'], true);
        $d = cuerpoJson();
        $audiencia = (string) opcion($d, 'audiencia', AUDIENCIAS_PRIVACIDAD);
        $secciones = $d['secciones'] ?? null;
        if (!is_array($secciones) || $secciones === []) {
            throw errorCampo('campo_requerido', 'secciones', 'Envía al menos una sección.');
        }

        foreach ($secciones as $seccion => $visible) {
            $seccion = (string) $seccion;
            if (!isset(seccionesPrivacidad()[$seccion])) {
                throw errorCampo('seccion_desconocida', $seccion, 'Esa sección no existe en el catálogo.');
            }
            if (!esConfigurable($seccion, $audiencia)) {
                throw new HttpError(422, 'seccion_no_configurable', 'Esa sección no se puede ocultar ante esa audiencia.', [
                    'campo' => $seccion,
                    'regla' => reglaPrivacidad($seccion, $audiencia),
                ]);
            }
            if (!is_bool($visible)) {
                throw errorCampo('campo_invalido', $seccion, 'El valor debe ser verdadero o falso.');
            }
        }

        enTransaccion(function () use ($p, $audiencia, $secciones): void {
            foreach ($secciones as $seccion => $visible) {
                PreferenciaPrivacidad::fijar($p['id'], $audiencia, (string) $seccion, (bool) $visible);
            }
        });
        responder(PreferenciaPrivacidad::tablero($p['id']));
    });

    /**
     * Copia del historial lista para compartir fuera del sistema, ya filtrada
     * con las preferencias de la audiencia `exportacion`.
     */
    $r->get('/pacientes/{id}/exportacion', function (array $p): void {
        $paciente = pacienteAutorizado(sesion('paciente'), $p['id']);
        responder([
            'generadoEn' => isoUtc(new DateTimeImmutable()),
            'expediente' => $paciente->expedientePara('exportacion'),
        ]);
    });
};
