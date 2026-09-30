// Respuestas de `/pacientes/{id}/metricas`: signos vitales ya guardados.

/** Resumen que el expediente muestra arriba: la última lectura de cada signo. */
export interface MetricasActuales {
  pesoKg: number | null;
  alturaCm: number | null;
  /** Lo calcula la API a partir de peso y altura. */
  imc: number | null;
  ultimaPresionArterial: string | null;
  frecuenciaCardiaca: number | null;
  glucosaMgDl: number | null;
  fechaTomaMetricas: string;
}

/** Una toma guardada, con quién la registró. */
export interface Metrica {
  idMetrica: string;
  pesoKg: number | null;
  alturaCm: number | null;
  imc: number | null;
  /** Formato `sistolica/diastolica`, p. ej. `120/80`. */
  presionArterial: string | null;
  frecuenciaCardiaca: number | null;
  glucosaMgDl: number | null;
  temperaturaC: number | null;
  notas: string | null;
  fechaToma: string;
  registradoPor: string;
}
