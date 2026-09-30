// Respuestas de `/pacientes/{id}/privacidad` y `/exportacion`.

import type { Audiencia, ReglaPrivacidad } from './privacidad.types';
import type { Expediente } from '../paciente/paciente.model';

/** Cómo queda una sección frente a una audiencia concreta. */
export interface EstadoAudiencia {
  regla: ReglaPrivacidad;
  visible: boolean;
}

export interface SeccionPrivacidad {
  seccion: string;
  /** Clave de strings.xml con el nombre de la sección. */
  etiqueta: string;
  /** Sólo trae las audiencias en las que la sección aplica. */
  audiencias: Partial<Record<Audiencia, EstadoAudiencia>>;
}

/** Matriz secciones × audiencias que edita el paciente. */
export interface TableroPrivacidad {
  audiencias: Audiencia[];
  secciones: SeccionPrivacidad[];
}

/** Qué se retuvo al armar este expediente; vacío cuando lo lee el propio paciente. */
export interface AvisoPrivacidad {
  audiencia: Audiencia | 'propio';
  seccionesOmitidas: string[];
}

/** Copia del expediente que el paciente descarga para llevarse sus datos. */
export interface Exportacion {
  generadoEn: string;
  expediente: Expediente;
}
