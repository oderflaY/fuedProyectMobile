import type { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { ApiService, SIN_PANTALLA_CARGA } from '../api/api.service';
import { CargaService } from './carga.service';

/** Muestra la pantalla de carga mientras haya lecturas de datos (GET) a la API en curso. */
export const cargaInterceptor: HttpInterceptorFn = (peticion, siguiente) => {
  const esCargaDeDatos =
    peticion.method === 'GET' &&
    peticion.responseType === 'json' &&
    !peticion.context.get(SIN_PANTALLA_CARGA) &&
    inject(ApiService).esUrlApi(peticion.url);
  if (!esCargaDeDatos) {
    return siguiente(peticion);
  }
  const carga = inject(CargaService);
  carga.inicio();
  return siguiente(peticion).pipe(finalize(() => carga.fin()));
};
