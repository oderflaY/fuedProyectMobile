import type { EstadoAlerta, EstadoCita, EstadoRiesgo, EstadoToma, Segmento, SeveridadAlerta } from '../models';

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

export const COLOR_SEGMENTO: Record<Segmento, string> = {
  sin_clasificar: 'medium',
  controlado: 'success',
  seguimiento: 'warning',
  riesgo: 'danger',
};

export const COLOR_SEVERIDAD: Record<SeveridadAlerta, string> = {
  informativa: 'medium',
  atencion: 'warning',
  urgente: 'danger',
};

export const COLOR_ESTADO_ALERTA: Record<EstadoAlerta, string> = {
  nueva: 'primary',
  vista: 'medium',
  atendida: 'success',
};
