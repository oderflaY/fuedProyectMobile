import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { Router } from '@angular/router';
import type { Rol } from '../models';
import { SessionService } from './session.service';

/** Permite la ruta sólo a una sesión con el rol indicado. */
export function rolGuard(rol: Rol): CanMatchFn {
  return () => {
    const sesion = inject(SessionService);
    const router = inject(Router);
    if (!sesion.usuario()) {
      return router.parseUrl('/login');
    }
    return sesion.rol() === rol ? true : router.parseUrl(sesion.rutaInicio());
  };
}

/** Pantallas de login y registro: si ya hay sesión se manda al inicio del rol. */
export const invitadoGuard: CanMatchFn = () => {
  const sesion = inject(SessionService);
  return sesion.usuario() ? inject(Router).parseUrl(sesion.rutaInicio()) : true;
};
