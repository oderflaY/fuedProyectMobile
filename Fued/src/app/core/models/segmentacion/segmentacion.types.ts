/** Uniones de la segmentación por enfermedad crónica. */

export type CondicionCronica = 'hipertension' | 'diabetes' | 'asma_epoc' | 'cardiopatia' | 'renal';

/** Resultado del tamizaje; `sin_clasificar` es un perfil aún sin evaluar. */
export type Segmento = 'sin_clasificar' | 'controlado' | 'seguimiento' | 'riesgo';

export type SeveridadAlerta = 'informativa' | 'atencion' | 'urgente';

export type TipoPregunta = 'booleano' | 'numero' | 'opcion' | 'opcion_multiple' | 'presion' | 'texto';

export type ValorRespuesta = string | number | boolean | string[];

/** Un perfil archivado deja de evaluarse, pero conserva su historial. */
export type EstadoPerfilCronico = 'activo' | 'archivado';

/** Respuestas indexadas por `Pregunta.id`. */
export interface RespuestasCuestionario {
  [idPregunta: string]: ValorRespuesta;
}

/** Datos con que se arma el texto de una bandera. */
export interface DatosBandera {
  [clave: string]: string | number;
}
