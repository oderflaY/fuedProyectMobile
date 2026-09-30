<?php
declare(strict_types=1);

/** Una corrida del cuestionario guiado, con el resultado que produjeron las reglas. */
final class EvaluacionCronica extends Modelo
{
    protected static string $tabla = 'evaluaciones_cronicas';
    protected static string|array $llave = 'id_evaluacion';
    protected static string $prefijoId = 'evl';
    protected static array $columnas = [
        'id_evaluacion' => 'texto',
        'id_perfil' => 'texto',
        'id_paciente' => 'texto',
        'condicion' => 'texto',
        'respuestas' => 'json',
        'segmento' => 'texto',
        'severidad' => 'texto',
        'banderas' => 'json',
        'confiable' => 'booleano',
        'id_metrica' => 'texto',
        'fecha' => 'fechaHora',
    ];
    protected static array $pertenece = [
        'perfil' => [PerfilCronico::class, 'id_perfil'],
        'paciente' => [Paciente::class, 'id_paciente'],
    ];

    /** Evaluaciones recientes del paciente, la más nueva primero. */
    public static function recientesDe(string $idPaciente, int $limite = 20): array
    {
        return self::donde('id_paciente', $idPaciente)->ordenar('fecha', 'DESC')->limitar($limite)->obtener();
    }

    public function tieneBanderaRoja(): bool
    {
        foreach ((array) $this->banderas as $bandera) {
            if (($bandera['roja'] ?? false) === true) {
                return true;
            }
        }
        return false;
    }

    public function aDto(): array
    {
        return [
            'idEvaluacion' => $this->id_evaluacion,
            'condicion' => $this->condicion,
            'segmento' => $this->segmento,
            'severidad' => $this->severidad,
            'banderas' => (array) $this->banderas,
            'confiable' => (bool) $this->confiable,
            'respuestas' => (array) $this->respuestas,
            'fecha' => iso($this->fecha),
        ];
    }
}
