/** Uniones de la bandeja de alertas. */

export type EstadoAlerta = 'nueva' | 'vista' | 'atendida';

/** Qué disparó la alerta. */
export type OrigenAlerta = 'segmentacion' | 'metrica' | 'adherencia';

/** Parámetros de las claves de texto; las listas no se interpolan, se traducen aparte. */
export interface DatosAlerta {
  [clave: string]: string | number | boolean | string[];
}
