import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

/** Error normalizado de la API: `codigo` se usa como clave `error_<codigo>` en strings.xml. */
export class ApiError extends Error {
  constructor(
    readonly estado: number,
    readonly codigo: string,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

export function aApiError(error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) {
      return new ApiError(0, 'sin_conexion', error.message);
    }
    const cuerpo = error.error?.error;
    return new ApiError(error.status, cuerpo?.codigo ?? 'generico', cuerpo?.mensaje ?? error.message);
  }
  return new ApiError(-1, 'generico', String(error));
}

type Parametros = Record<string, string | number | boolean | null | undefined>;

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  readonly base = environment.apiUrl.replace(/\/$/, '');

  get<T>(ruta: string, parametros?: Parametros): Promise<T> {
    return this.enviar(this.http.get<T>(this.url(ruta), { params: this.params(parametros) }));
  }

  post<T>(ruta: string, cuerpo: unknown = {}, parametros?: Parametros): Promise<T> {
    return this.enviar(this.http.post<T>(this.url(ruta), cuerpo, { params: this.params(parametros) }));
  }

  put<T>(ruta: string, cuerpo: unknown = {}): Promise<T> {
    return this.enviar(this.http.put<T>(this.url(ruta), cuerpo));
  }

  /** Descarga binaria (adjuntos del chat); el interceptor agrega el token. */
  getBlob(ruta: string): Promise<Blob> {
    return this.enviar(this.http.get(this.url(ruta), { responseType: 'blob' }));
  }

  delete(ruta: string, parametros?: Parametros): Promise<void> {
    return this.enviar(this.http.delete<void>(this.url(ruta), { params: this.params(parametros) }));
  }

  esUrlApi(url: string): boolean {
    return url.startsWith(this.base);
  }

  private url(ruta: string): string {
    return `${this.base}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
  }

  private params(parametros?: Parametros): HttpParams {
    let params = new HttpParams();
    for (const [clave, valor] of Object.entries(parametros ?? {})) {
      if (valor !== null && valor !== undefined && valor !== '') {
        params = params.set(clave, String(valor));
      }
    }
    return params;
  }

  private async enviar<T>(peticion: Observable<T>): Promise<T> {
    try {
      return await firstValueFrom(peticion);
    } catch (error) {
      throw aApiError(error);
    }
  }
}
