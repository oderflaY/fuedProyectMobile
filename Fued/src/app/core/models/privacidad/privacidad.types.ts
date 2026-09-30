/** Uniones de privacidad. */

/** Quién mira el expediente; decide qué secciones se omiten al armarlo. */
export type Audiencia = 'medico' | 'emergencia' | 'exportacion';

/** `siempre` y `nunca` no son negociables: el catálogo del servidor los impone. */
export type ReglaPrivacidad = 'configurable' | 'siempre' | 'nunca';
