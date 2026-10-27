// Respuestas de `POST /graphql`: agregados de todo el sistema para el tablero de estadísticas.

import type { CondicionCronica } from '../segmentacion/segmentacion.types';

/** Cuántos registros caen en una categoría (género, tipo de sangre, especialidad…). */
export interface Conteo {
  clave: string;
  valor: number;
}

export interface ResumenSistema {
  pacientes: number;
  medicos: number;
  citas: number;
  metricasVitales: number;
  tomas: number;
  tratamientos: number;
  perfilesCronicos: number;
  alertas: number;
}

/** `mes` en formato YYYY-MM. */
export interface RegistrosMes {
  mes: string;
  pacientes: number;
  medicos: number;
}

export interface CitasMes {
  mes: string;
  completadas: number;
  canceladas: number;
  pendientes: number;
  confirmadas: number;
  total: number;
}

export interface AdherenciaMes {
  mes: string;
  tomado: number;
  tomadoTarde: number;
  omitido: number;
  porcentaje: number | null;
}

/** Promedios del mes; `null` si no hubo tomas. */
export interface SignosVitalesMes {
  mes: string;
  glucosa: number | null;
  frecuenciaCardiaca: number | null;
  sistolica: number | null;
  diastolica: number | null;
  imc: number | null;
  tomas: number;
}

export interface SegmentosCondicion {
  condicion: CondicionCronica;
  controlado: number;
  seguimiento: number;
  riesgo: number;
  sinClasificar: number;
}

export interface MedicoCarga {
  nombre: string;
  especialidad: string | null;
  pacientes: number;
  citas: number;
}

export interface EstadisticasSistema {
  resumen: ResumenSistema;
  pacientesPorGenero: Conteo[];
  pacientesPorEdad: Conteo[];
  pacientesPorTipoSangre: Conteo[];
  registrosPorMes: RegistrosMes[];
  citasPorMes: CitasMes[];
  adherenciaPorMes: AdherenciaMes[];
  signosVitalesPorMes: SignosVitalesMes[];
  segmentosPorCondicion: SegmentosCondicion[];
  alertasPorSeveridad: Conteo[];
  alertasPorOrigen: Conteo[];
  medicosPorEspecialidad: Conteo[];
  topMedicos: MedicoCarga[];
}
