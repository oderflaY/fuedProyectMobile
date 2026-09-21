import type { EstadoCita, EstadoRiesgo, EstadoToma } from '../models';

// Colores semánticos de Ionic por estado; siempre se acompañan de texto para no depender sólo del color.

export const COLOR_ESTADO_TOMA: Record<EstadoToma, string> = {
  tomado: 'success',
  tomado_tarde: 'warning',
  omitido: 'danger',
};

export const COLOR_ESTADO_CITA: Record<EstadoCita, string> = {
  pendiente: 'warning',
  confirmada: 'success',
  cancelada: 'medium',
  completada: 'primary',
};

export const COLOR_RIESGO: Record<EstadoRiesgo, string> = {
  alto: 'danger',
  medio: 'warning',
  bajo: 'success',
};
