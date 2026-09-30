// Cuerpos que se envían a `/pacientes/{id}/privacidad`.

import type { Audiencia } from './privacidad.types';

/** Visibilidad pedida para cada sección, indexada por su clave. */
export interface VisibilidadSecciones {
  [seccion: string]: boolean;
}

/**
 * Cuerpo de `PUT`: qué secciones quedan visibles para una audiencia.
 * El servidor rechaza las que no son configurables ahí.
 */
export interface CambioPrivacidad {
  audiencia: Audiencia;
  secciones: VisibilidadSecciones;
}
