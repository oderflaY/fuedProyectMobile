// Respuestas de `/pacientes`: el expediente y todo lo que cuelga de él.

import type { AvisoPrivacidad } from '../privacidad/privacidad.model';
import type { MetricasActuales } from '../metrica/metrica.model';
import type { EstadoRfid, NivelAcceso, TipoSangre } from './paciente.types';
import type { PerfilCronico } from '../segmentacion/segmentacion.model';
import type { RegistroToma } from '../adherencia/adherencia.model';
import type { Tratamiento } from '../tratamiento/tratamiento.model';

export interface Alergia {
  id: string;
  alergeno: string;
  severidad: string;
  reaccion: string | null;
}

/** Lo mínimo que necesita ver un socorrista: se lee sin sesión, vía RFID. */
export interface PerfilEmergencia {
  tipoSangre: TipoSangre | null;
  donadorOrganos: boolean;
  alergias: Alergia[];
  condicionesCriticas: string[];
  medicacionRescate: string[];
}

export interface Cirugia {
  id: string;
  procedimiento: string;
  fecha: string;
  notas: string | null;
}

/** A quién llamar; `prioridad` 1 es el primer contacto. */
export interface ContactoEmergencia {
  id: string;
  nombre: string;
  relacion: string;
  telefono: string;
  prioridad: number;
}

/** Tarjeta o pulsera que abre el perfil de emergencia. */
export interface DispositivoRfid {
  idTarjetaRfid: string;
  estado: EstadoRfid;
  fechaAsignacion: string;
  fechaRevocacion: string | null;
}

/** Médico al que el paciente le dio acceso, y hasta cuándo. */
export interface MedicoAutorizado {
  idMedico: string;
  nombreCompleto: string;
  especialidad: string | null;
  nivelAcceso: NivelAcceso;
  fechaExpiracion: string | null;
}

export interface DatosPersonalesPaciente {
  nombre: string;
  apellidos: string;
  fechaNacimiento: string | null;
  genero: string | null;
  telefono: string | null;
}

/** Fila genérica de las colecciones que sólo guardan un texto. */
export interface ElementoDescripcion {
  id: string;
  descripcion: string;
}

/** Identificadores oficiales del paciente. */
export interface Identificaciones {
  curp: string | null;
  nss: string | null;
}

/** Antecedentes clínicos; hoy sólo guarda cirugías. */
export interface HistorialClinico {
  cirugias: Cirugia[];
}

/** Quién puede leer el expediente además del propio paciente. */
export interface ControlAccesos {
  medicosAutorizados: MedicoAutorizado[];
}

/**
 * Expediente completo: la respuesta de `GET /pacientes/{id}`.
 * Lo que trae depende de quién lo pide; `privacidad` dice qué se omitió.
 */
export interface Expediente {
  idPaciente: string;
  estadoCuenta: string;
  identificaciones: Identificaciones;
  dispositivosRfid: DispositivoRfid[];
  datosPersonales: DatosPersonalesPaciente;
  contactosEmergencia: ContactoEmergencia[];
  perfilEmergenciaReducido: PerfilEmergencia;
  metricasVitalesActuales: MetricasActuales | null;
  historialClinico: HistorialClinico;
  tratamientosActivos: Tratamiento[];
  registroAdherencia: RegistroToma[];
  controlAccesos: ControlAccesos;
  /** Enfermedades crónicas declaradas y su último tamizaje. */
  segmentacion: PerfilCronico[];
  /** Qué se retuvo al armar este expediente y para quién. */
  privacidad: AvisoPrivacidad;
}
