// Respuestas de `/medicos`: el directorio público y el perfil propio.

import type { EstadoRiesgo, TemaVisual } from './medico.types';
import type { NivelAcceso } from '../paciente/paciente.types';

/** Ficha visible para cualquier paciente al buscar con quién agendar. */
export interface MedicoPublico {
  idMedico: string;
  nombreCompleto: string;
  especialidad: string | null;
  nombreClinica: string | null;
  direccion: string | null;
  telefonoRecepcion: string | null;
}

/** Fila del tablero: un paciente que le dio acceso al médico. */
export interface PacienteVinculado {
  idPaciente: string;
  nombreCompleto: string;
  nivelAcceso: NivelAcceso;
  fechaVinculacion: string;
  estadoRiesgo: EstadoRiesgo;
  /** null cuando el paciente aún no tiene tomas registradas. */
  porcentajeAdherencia: number | null;
}

/** Datos de contacto del médico; el email es el de la cuenta. */
export interface DatosPersonalesMedico {
  nombre: string;
  apellidos: string;
  genero: string | null;
  telefono: string | null;
  email: string;
}

/** Cédulas y estudios; los valida el administrador, no la app. */
export interface CredencialesMedico {
  cedulaProfesional: string;
  cedulaEspecialidad: string | null;
  especialidad: string | null;
  universidad: string | null;
  /** `aprobado` es lo que habilita ver pacientes. */
  estadoVerificacion: string;
  fechaVerificacion: string | null;
}

/** Consultorio o clínica donde atiende. */
export interface LugarTrabajo {
  nombreClinica: string | null;
  direccion: string | null;
  telefonoRecepcion: string | null;
}

/** Preferencias del tablero del médico. */
export interface ConfiguracionDashboard {
  alertasAdherenciaBaja: boolean;
  notificacionesUrgencia: boolean;
  temaVisual: TemaVisual;
}

/** Huellas de la cuenta que la app sólo muestra. */
export interface MetadatosCuenta {
  fechaRegistro: string;
  ultimoAcceso: string | null;
}

/**
 * Perfil propio del médico: `GET /medicos/yo`.
 * Cada bloque es su propia interfaz porque las ediciones van por bloque.
 */
export interface PerfilMedico {
  idMedico: string;
  estadoCuenta: string;
  datosPersonales: DatosPersonalesMedico;
  credenciales: CredencialesMedico;
  lugarTrabajo: LugarTrabajo;
  pacientesVinculados: PacienteVinculado[];
  configuracionDashboard: ConfiguracionDashboard;
  metadatos: MetadatosCuenta;
}
