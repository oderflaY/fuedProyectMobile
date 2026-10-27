import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../../environments/environment';
import { SessionService } from '../../../core/auth/session.service';
import type { Rol } from '../../../core/models';
import { AuthRepository } from '../../../core/repositories/auth.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import { SonidosService } from '../../../core/ui/sonidos.service';

export interface CuentaDemo {
  nombre: string;
  email: string;
  rol: Rol;
}

const CUENTAS_DEMO: CuentaDemo[] = [
  { nombre: 'Juan Pérez Gómez', email: 'juan.perez@correo.com', rol: 'paciente' },
  { nombre: 'Elena Ruiz Santos', email: 'dr.elena.ruiz@hospital.com', rol: 'medico' },
];
const PASSWORD_DEMO = 'Fued12345';

@Injectable()
export class LoginViewModel {
  private readonly auth = inject(AuthRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);
  private readonly sonidos = inject(SonidosService);
  private readonly router = inject(Router);

  readonly email = signal('');
  readonly password = signal('');
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly puedeEnviar = computed(() => this.email().trim() !== '' && this.password() !== '' && !this.enviando());
  readonly cuentasDemo = environment.mostrarCuentasDemo ? CUENTAS_DEMO : [];

  usarCuentaDemo(cuenta: CuentaDemo): void {
    this.email.set(cuenta.email);
    this.password.set(PASSWORD_DEMO);
    this.error.set(null);
  }

  async iniciarSesion(): Promise<void> {
    if (!this.puedeEnviar()) {
      return;
    }
    this.enviando.set(true);
    this.error.set(null);
    try {
      this.sesion.iniciar(await this.auth.login(this.email().trim(), this.password()));
      this.sonidos.claxon();
      await this.router.navigateByUrl(this.sesion.rutaInicio(), { replaceUrl: true });
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
      this.sonidos.trompetaTriste();
    } finally {
      this.enviando.set(false);
    }
  }
}
