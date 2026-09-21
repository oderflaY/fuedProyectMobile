import { Injectable, computed, signal } from '@angular/core';
import type { Rol, Sesion, Usuario } from '../models';

const CLAVE_SESION = 'fued.sesion';

function leerSesion(): Sesion | null {
  try {
    const guardada = localStorage.getItem(CLAVE_SESION);
    return guardada ? (JSON.parse(guardada) as Sesion) : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly estado = signal<Sesion | null>(leerSesion());

  readonly usuario = computed<Usuario | null>(() => this.estado()?.usuario ?? null);
  readonly token = computed<string | null>(() => this.estado()?.token ?? null);
  readonly rol = computed<Rol | null>(() => this.estado()?.usuario.rol ?? null);

  iniciar(sesion: Sesion): void {
    try {
      localStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
    } catch {
      // Sin almacenamiento persistente la sesión dura hasta cerrar la app.
    }
    this.estado.set(sesion);
  }

  actualizarUsuario(usuario: Usuario): void {
    const actual = this.estado();
    if (actual) {
      this.iniciar({ ...actual, usuario });
    }
  }

  cerrar(): void {
    try {
      localStorage.removeItem(CLAVE_SESION);
    } catch {
      // Nada que limpiar.
    }
    this.estado.set(null);
  }

  /** Ruta de inicio según el rol de la sesión. */
  rutaInicio(): string {
    switch (this.rol()) {
      case 'paciente':
        return '/paciente/inicio';
      case 'medico':
        return '/medico/pacientes';
      default:
        return '/login';
    }
  }
}
