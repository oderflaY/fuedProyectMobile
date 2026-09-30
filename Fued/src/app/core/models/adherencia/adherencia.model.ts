// Respuestas de `/pacientes/{id}/tomas` y `/adherencia`: qué tocaba y qué se cumplió.

import type { EstadoToma } from './adherencia.types';
import type { Inventario } from '../tratamiento/tratamiento.model';

/** Una toma programada y lo que pasó con ella. */
export interface RegistroToma {
  idToma: string;
  idTratamiento: string;
  fechaHoraProgramada: string;
  /** null mientras no se registre; entonces la toma sigue pendiente. */
  fechaHoraReal: string | null;
  estado: EstadoToma;
  sintomasAsociados: string | null;
  /** Lo agrega la API para no tener que buscar el tratamiento. */
  medicamento?: string;
}

/** Conteo de cumplimiento de un periodo. */
export interface ResumenAdherencia {
  total: number;
  tomadas: number;
  tomadasTarde: number;
  omitidas: number;
  /** null cuando no hubo tomas que contar. */
  porcentajeCumplimiento: number | null;
}

/** Fila de la agenda del día: el tratamiento, su horario y su registro. */
export interface TomaDelDia {
  idTratamiento: string;
  medicamento: string;
  dosis: string;
  viaAdministracion: string;
  horario: string;
  fechaHoraProgramada: string;
  /** null si todavía no se marca. */
  registro: RegistroToma | null;
  inventario: Inventario;
  inventarioBajo: boolean;
}

/** Resumen del día: el de siempre más lo que aún no se marca. */
export interface ResumenDelDia extends ResumenAdherencia {
  pendientes: number;
}

/** Agenda diaria; la zona horaria es la que mandó la app al pedirla. */
export interface AgendaTomas {
  fecha: string;
  zonaHoraria: string;
  tomas: TomaDelDia[];
  resumen: ResumenDelDia;
}

/** Histórico de tomas entre dos fechas. */
export interface HistorialAdherencia {
  desde: string;
  hasta: string;
  registros: RegistroToma[];
  resumen: ResumenAdherencia;
}

/** Lo que devuelve marcar una toma: descuenta inventario y puede avisar. */
export interface ResultadoToma {
  registro: RegistroToma;
  inventario: Inventario;
  alertaInventario: boolean;
}
