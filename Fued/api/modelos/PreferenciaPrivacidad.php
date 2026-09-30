<?php
declare(strict_types=1);

/**
 * Visibilidad que el paciente concede a una sección del expediente frente a una
 * audiencia. Sólo se guardan las secciones configurables: lo que el catálogo de
 * api/lib/privacidad.php marca como `siempre` o `nunca` no se puede negociar.
 */
final class PreferenciaPrivacidad extends Modelo
{
    protected static string $tabla = 'preferencias_privacidad';
    protected static string|array $llave = ['id_paciente', 'audiencia', 'seccion'];
    protected static array $columnas = [
        'id_paciente' => 'texto',
        'audiencia' => 'texto',
        'seccion' => 'texto',
        'visible' => 'booleano',
        'actualizado_en' => 'fechaHora',
    ];
    protected static array $pertenece = ['paciente' => [Paciente::class, 'id_paciente']];

    /**
     * Preferencias guardadas de una audiencia.
     *
     * @return array<string, bool> seccion => visible
     */
    public static function deAudiencia(string $idPaciente, string $audiencia): array
    {
        $preferencias = [];
        foreach (self::donde('id_paciente', $idPaciente)->donde('audiencia', $audiencia)->obtener() as $fila) {
            $preferencias[(string) $fila->seccion] = (bool) $fila->visible;
        }
        return $preferencias;
    }

    /** Guarda (o actualiza) la visibilidad de una sección. */
    public static function fijar(string $idPaciente, string $audiencia, string $seccion, bool $visible): void
    {
        $preferencia = self::buscar(['id_paciente' => $idPaciente, 'audiencia' => $audiencia, 'seccion' => $seccion]);
        if ($preferencia === null) {
            self::crear([
                'id_paciente' => $idPaciente, 'audiencia' => $audiencia, 'seccion' => $seccion,
                'visible' => $visible, 'actualizado_en' => ahoraSql(),
            ]);
            return;
        }
        $preferencia->visible = $visible;
        $preferencia->actualizado_en = ahoraSql();
        $preferencia->guardar();
    }

    /**
     * Tablero completo para la pantalla de privacidad: todas las secciones del
     * catálogo, con su regla y su valor actual en cada audiencia.
     */
    public static function tablero(string $idPaciente): array
    {
        $guardadas = [];
        foreach (AUDIENCIAS_PRIVACIDAD as $audiencia) {
            $guardadas[$audiencia] = self::deAudiencia($idPaciente, $audiencia);
        }

        $secciones = [];
        foreach (seccionesPrivacidad() as $clave => $definicion) {
            $audiencias = [];
            foreach (AUDIENCIAS_PRIVACIDAD as $audiencia) {
                $regla = reglaPrivacidad($clave, $audiencia);
                if ($regla === 'nunca') {
                    continue;
                }
                $audiencias[$audiencia] = [
                    'regla' => $regla,
                    'visible' => seccionVisible($clave, $audiencia, $guardadas[$audiencia]),
                ];
            }
            $secciones[] = ['seccion' => $clave, 'etiqueta' => $definicion['etiqueta'], 'audiencias' => $audiencias];
        }
        return ['audiencias' => AUDIENCIAS_PRIVACIDAD, 'secciones' => $secciones];
    }
}
