import type { HttpInterceptorFn } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { ApiService } from '../api/api.service';
import { SessionService } from './session.service';

/** Adjunta el JWT a las peticiones de la API y cierra la sesión si el servidor la rechaza. */
export const authInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const api = inject(ApiService);
  const sesion = inject(SessionService);
  const router = inject(Router);

  if (!api.esUrlApi(peticion.url)) {
    return siguiente(peticion);
  }
  const token = sesion.token();
  const autenticada = token ? peticion.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : peticion;

  return siguiente(autenticada).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && token) {
        sesion.cerrar();
        void router.navigateByUrl('/login', { replaceUrl: true });
      }
      return throwError(() => error);
    }),
  );
};
