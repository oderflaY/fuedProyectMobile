import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { Credenciales, DatosRegistro, Sesion, Usuario } from '../models';

@Injectable({ providedIn: 'root' })
export class AuthRepository {
  private readonly api = inject(ApiService);

  login(email: string, password: string): Promise<Sesion> {
    const credenciales: Credenciales = { email, password };
    return this.api.post<Sesion>('/auth/login', credenciales);
  }

  registrar(datos: DatosRegistro): Promise<Sesion> {
    return this.api.post<Sesion>('/auth/registro', datos);
  }

  yo(): Promise<Usuario> {
    return this.api.get<Usuario>('/auth/yo');
  }
}
