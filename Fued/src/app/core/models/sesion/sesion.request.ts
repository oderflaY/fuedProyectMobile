// Cuerpos que se envían a `/auth`.

import type { Rol } from './sesion.types';

/** Cuerpo de `POST /auth/login`. */
export interface Credenciales {
  email: string;
  password: string;
}

/** Cuerpo de `POST /auth/registro`; los opcionales dependen del rol elegido. */
export interface DatosRegistro {
  rol: Rol;
  email: string;
  password: string;
  nombre: string;
  apellidos: string;
  telefono?: string;
  fechaNacimiento?: string;
  /** Sólo paciente. */
  curp?: string;
  /** Sólo médico. */
  cedulaProfesional?: string;
  /** Sólo médico. */
  especialidad?: string;
}
