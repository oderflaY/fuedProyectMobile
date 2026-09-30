// Cuerpos que se envían a `/pacientes/{id}/cronicas`.

import type { CondicionCronica, EstadoPerfilCronico, RespuestasCuestionario } from './segmentacion.types';

/** Cuerpo de `POST`: el paciente declara que vive con esa condición. */
export interface NuevoPerfilCronico {
  condicion: CondicionCronica;
  datosBasales: RespuestasCuestionario;
}

/** Cuerpo de `PUT /{condicion}`: corregir lo basal o archivar el seguimiento. */
export interface CambioPerfilCronico {
  datosBasales?: RespuestasCuestionario;
  estado?: EstadoPerfilCronico;
}

/** Cuerpo de `POST /{condicion}/evaluaciones`: el cuestionario contestado. */
export interface NuevaEvaluacion {
  respuestas: RespuestasCuestionario;
}
