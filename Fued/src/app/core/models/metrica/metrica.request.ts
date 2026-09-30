// Cuerpos que se envían a `/pacientes/{id}/metricas`.

/** Cuerpo de `POST`: sólo viajan los campos que se llenaron en el formulario. */
export interface NuevaMetrica {
  pesoKg?: number;
  alturaCm?: number;
  presionArterial?: string;
  frecuenciaCardiaca?: number;
  glucosaMgDl?: number;
  temperaturaC?: number;
  notas?: string;
}
