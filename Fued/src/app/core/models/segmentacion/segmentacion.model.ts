// Respuestas de `/segmentacion` y `/pacientes/{id}/cronicas`.

import type {
  CondicionCronica,
  DatosBandera,
  EstadoPerfilCronico,
  RespuestasCuestionario,
  Segmento,
  SeveridadAlerta,
  TipoPregunta,
} from './segmentacion.types';

/** Pregunta del cuestionario; el formulario se pinta a partir de esto. */
export interface Pregunta {
  id: string;
  tipo: TipoPregunta;
  /** Clave de strings.xml; las opciones se traducen como `opcion_<id>_<valor>`. */
  etiqueta: string;
  ayuda?: string;
  requerida?: boolean;
  unidad?: string;
  min?: number;
  max?: number;
  opciones?: string[];
  defecto?: string | number;
}

/** Cuestionario de una condición: lo basal se pregunta una vez, el resto cada vez. */
export interface Cuestionario {
  condicion: CondicionCronica;
  etiqueta: string;
  basales: Pregunta[];
  preguntas: Pregunta[];
  /** Lo basal ya contestado, para no volver a pedirlo. */
  datosBasales?: RespuestasCuestionario;
}

/** Hallazgo de las reglas; `roja` marca un signo de alarma. */
export interface Bandera {
  codigo: string;
  roja: boolean;
  datos: DatosBandera;
}

/** Un tamizaje ya calculado por el servidor. */
export interface Evaluacion {
  idEvaluacion: string;
  condicion: CondicionCronica;
  segmento: Exclude<Segmento, 'sin_clasificar'>;
  severidad: SeveridadAlerta;
  banderas: Bandera[];
  /** false cuando el paciente declaró un contexto que invalida la medición. */
  confiable: boolean;
  respuestas: RespuestasCuestionario;
  fecha: string;
}

/** Condición crónica que sigue el paciente, con su último resultado. */
export interface PerfilCronico {
  idPerfil: string;
  condicion: CondicionCronica;
  etiqueta: string;
  estado: EstadoPerfilCronico;
  segmento: Segmento;
  datosBasales: RespuestasCuestionario;
  fechaAlta: string;
  fechaEvaluacion: string | null;
  ultimaEvaluacion: Evaluacion | null;
}

/** Lo que devuelve contestar un cuestionario. */
export interface ResultadoEvaluacion {
  evaluacion: Evaluacion;
  /** Claves de strings.xml con la guía para el paciente. */
  recomendaciones: string[];
  /** Cuántos médicos recibieron aviso por este resultado. */
  alertasEnviadas: number;
}
