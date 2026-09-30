// Respuestas de `/citas`: lo agendado y los huecos libres.

import type { EstadoCita } from './cita.types';

/**
 * Cita agendada. Trae los nombres de ambas partes para pintar la lista
 * sin pedir el perfil del médico ni el del paciente.
 */
export interface Cita {
  idCita: string;
  idPaciente: string;
  nombrePaciente: string;
  idMedico: string;
  nombreMedico: string;
  especialidad: string | null;
  nombreClinica: string | null;
  direccion: string | null;
  fechaHora: string;
  duracionMin: number;
  motivo: string;
  estado: EstadoCita;
  notasMedico: string | null;
  /** Rol de quien la creó. */
  creadoPor: string;
  fechaCreacion: string;
  fechaActualizacion: string | null;
}

/** Un hueco de la agenda; `horaLocal` ya viene formateada para mostrar. */
export interface HorarioDisponible {
  fechaHora: string;
  horaLocal: string;
  disponible: boolean;
}

/** Agenda de un médico en un día: todos los huecos, libres y ocupados. */
export interface Disponibilidad {
  idMedico: string;
  fecha: string;
  zonaHoraria: string;
  duracionMin: number;
  horarios: HorarioDisponible[];
}
