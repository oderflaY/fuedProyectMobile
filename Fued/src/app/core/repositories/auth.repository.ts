import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { DatosRegistro, Sesion, Usuario } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly api = inject(ApiService);

  login(email: string, password: string): Promise<Sesion> {
    return this.api.post<Sesion>('/auth/login', { email, password });
  }

  registrar(datos: DatosRegistro): Promise<Sesion> {
    return this.api.post<Sesion>('/auth/registro', datos);
  }

  yo(): Promise<Usuario> {
    return this.api.get<Usuario>('/auth/yo');
  }
}
