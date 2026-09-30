// Respuestas de `/auth`: la cuenta autenticada y su token.

import type { Rol } from './sesion.types';

/** Cuenta autenticada tal como la resume la API. */
export interface Usuario {
  id: string;
  rol: Rol;
  email: string;
  nombre: string;
  apellidos: string;
  /** `activa`, `suspendida`, … tal como lo reporta el servidor. */
  estadoCuenta: string | null;
  /** Sólo para médicos; en pacientes siempre es null. */
  especialidad: string | null;
}

/** Lo que devuelve el login: el token JWT y el usuario dueño de ese token. */
export interface Sesion {
  token: string;
  usuario: Usuario;
}
