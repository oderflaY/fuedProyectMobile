// Tipos de los DTO que expone la API (ver DM_HistorialMedico.md y DM_PerfilMedico.md).
// Todas las fechas con hora son ISO 8601 en UTC; las fechas de calendario son YYYY-MM-DD.

export type Rol = 'paciente' | 'medico';
export type NivelAcceso = 'lectura' | 'lectura_escritura';
export type TipoSangre = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type EstadoToma = 'tomado' | 'tomado_tarde' | 'omitido';
export type EstadoCita = 'pendiente' | 'confirmada' | 'cancelada' | 'completada';
export type EstadoRiesgo = 'alto' | 'medio' | 'bajo';

export const TIPOS_SANGRE: TipoSangre[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export interface Usuario {
  id: string;
  rol: Rol;
  email: string;
  nombre: string;
  apellidos: string;
  estadoCuenta: string | null;
  especialidad: string | null;
}

export interface Sesion {
  token: string;
  usuario: Usuario;
}

export interface Alergia {
  id: string;
  alergeno: string;
  severidad: string;
  reaccion: string | null;
}

export interface PerfilEmergencia {
  tipoSangre: TipoSangre | null;
  donadorOrganos: boolean;
  alergias: Alergia[];
  condicionesCriticas: string[];
  medicacionRescate: string[];
}

export interface Inventario {
  cantidadRestante: number;
  umbralAlerta: number;
}

export interface Tratamiento {
  idTratamiento: string;
  medicamento: string;
  dosis: string;
  frecuenciaHoras: number;
  horariosSugeridos: string[];
  viaAdministracion: string;
  fechaInicio: string;
  fechaFin: string | null;
  idMedicoReceta: string | null;
  inventario: Inventario;
  activo: boolean;
}

export interface RegistroToma {
  idToma: string;
  idTratamiento: string;
  fechaHoraProgramada: string;
  fechaHoraReal: string | null;
  estado: EstadoToma;
  sintomasAsociados: string | null;
  medicamento?: string;
}

export interface MetricasActuales {
  pesoKg: number | null;
  alturaCm: number | null;
  imc: number | null;
  ultimaPresionArterial: string | null;
  frecuenciaCardiaca: number | null;
  glucosaMgDl: number | null;
  fechaTomaMetricas: string;
}

export interface Metrica {
  idMetrica: string;
  pesoKg: number | null;
  alturaCm: number | null;
  imc: number | null;
  presionArterial: string | null;
  frecuenciaCardiaca: number | null;
  glucosaMgDl: number | null;
  temperaturaC: number | null;
  notas: string | null;
  fechaToma: string;
  registradoPor: string;
}

export interface NuevaMetrica {
  pesoKg?: number;
  alturaCm?: number;
  presionArterial?: string;
  frecuenciaCardiaca?: number;
  glucosaMgDl?: number;
  temperaturaC?: number;
  notas?: string;
}

export interface Cirugia {
  id: string;
  procedimiento: string;
  fecha: string;
  notas: string | null;
}

export interface ContactoEmergencia {
  id: string;
  nombre: string;
  relacion: string;
  telefono: string;
  prioridad: number;
}

export interface DispositivoRfid {
  idTarjetaRfid: string;
  estado: 'activa' | 'extraviada' | 'inactiva';
  fechaAsignacion: string;
  fechaRevocacion: string | null;
}

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

export interface Expediente {
  idPaciente: string;
  estadoCuenta: string;
  identificaciones: { curp: string | null; nss: string | null };
  dispositivosRfid: DispositivoRfid[];
  datosPersonales: DatosPersonalesPaciente;
  contactosEmergencia: ContactoEmergencia[];
  perfilEmergenciaReducido: PerfilEmergencia;
  metricasVitalesActuales: MetricasActuales | null;
  historialClinico: { cirugias: Cirugia[] };
  tratamientosActivos: Tratamiento[];
  registroAdherencia: RegistroToma[];
  controlAccesos: { medicosAutorizados: MedicoAutorizado[] };
}

/** Colecciones editables del expediente: rutas `/pacientes/{id}/{coleccion}`. */
export type Coleccion = 'alergias' | 'condiciones' | 'medicacion-rescate' | 'cirugias' | 'contactos';

export interface ElementoDescripcion {
  id: string;
  descripcion: string;
}

export interface ResumenAdherencia {
  total: number;
  tomadas: number;
  tomadasTarde: number;
  omitidas: number;
  porcentajeCumplimiento: number | null;
}

export interface TomaDelDia {
  idTratamiento: string;
  medicamento: string;
  dosis: string;
  viaAdministracion: string;
  horario: string;
  fechaHoraProgramada: string;
  registro: RegistroToma | null;
  inventario: Inventario;
  inventarioBajo: boolean;
}

export interface AgendaTomas {
  fecha: string;
  zonaHoraria: string;
  tomas: TomaDelDia[];
  resumen: ResumenAdherencia & { pendientes: number };
}

export interface HistorialAdherencia {
  desde: string;
  hasta: string;
  registros: RegistroToma[];
  resumen: ResumenAdherencia;
}

export interface ResultadoToma {
  registro: RegistroToma;
  inventario: Inventario;
  alertaInventario: boolean;
}

export interface NuevoTratamiento {
  medicamento: string;
  dosis: string;
  frecuenciaHoras: number;
  horariosSugeridos?: string[];
  viaAdministracion: string;
  fechaInicio?: string;
  fechaFin?: string | null;
  inventario: Inventario;
}

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
  creadoPor: string;
  fechaCreacion: string;
  fechaActualizacion: string | null;
}

export interface HorarioDisponible {
  fechaHora: string;
  horaLocal: string;
  disponible: boolean;
}

export interface Disponibilidad {
  idMedico: string;
  fecha: string;
  zonaHoraria: string;
  duracionMin: number;
  horarios: HorarioDisponible[];
}

export interface MedicoPublico {
  idMedico: string;
  nombreCompleto: string;
  especialidad: string | null;
  nombreClinica: string | null;
  direccion: string | null;
  telefonoRecepcion: string | null;
}

export interface PacienteVinculado {
  idPaciente: string;
  nombreCompleto: string;
  nivelAcceso: NivelAcceso;
  fechaVinculacion: string;
  estadoRiesgo: EstadoRiesgo;
  porcentajeAdherencia: number | null;
}

export interface PerfilMedico {
  idMedico: string;
  estadoCuenta: string;
  datosPersonales: { nombre: string; apellidos: string; genero: string | null; telefono: string | null; email: string };
  credenciales: {
    cedulaProfesional: string;
    cedulaEspecialidad: string | null;
    especialidad: string | null;
    universidad: string | null;
    estadoVerificacion: string;
    fechaVerificacion: string | null;
  };
  lugarTrabajo: { nombreClinica: string | null; direccion: string | null; telefonoRecepcion: string | null };
  pacientesVinculados: PacienteVinculado[];
  configuracionDashboard: { alertasAdherenciaBaja: boolean; notificacionesUrgencia: boolean; temaVisual: 'sistema' | 'claro' | 'oscuro' };
  metadatos: { fechaRegistro: string; ultimoAcceso: string | null };
}

export type TipoMensaje = 'texto' | 'audio' | 'imagen' | 'archivo';

export interface Conversacion {
  idContraparte: string;
  rolContraparte: Rol;
  nombre: string;
  subtitulo: string | null;
  ultimoMensaje: string | null;
  tipoUltimoMensaje: TipoMensaje | null;
  fechaUltimoMensaje: string | null;
  noLeidos: number;
}

export interface AdjuntoMensaje {
  nombre: string;
  mime: string;
  bytes: number;
  duracionSeg: number | null;
  /** Ruta en la API; se descarga con el token de sesión. */
  url: string;
}

export interface Mensaje {
  idMensaje: string;
  remitente: Rol;
  propio: boolean;
  tipo: TipoMensaje;
  contenido: string;
  adjunto: AdjuntoMensaje | null;
  fechaEnvio: string;
  leido: boolean;
}

export interface DatosRegistro {
  rol: Rol;
  email: string;
  password: string;
  nombre: string;
  apellidos: string;
  telefono?: string;
  fechaNacimiento?: string;
  curp?: string;
  cedulaProfesional?: string;
  especialidad?: string;
}
