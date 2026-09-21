import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import type { DatosRegistro, Rol } from '../../../core/models';
import { AuthRepository } from '../../../core/repositories/auth.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

type CampoRegistro = Exclude<keyof DatosRegistro, 'rol'>;

@Injectable()
export class RegistroViewModel {
  private readonly auth = inject(AuthRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);

  readonly rol = signal<Rol>('paciente');
  readonly datos = signal<Record<CampoRegistro, string>>({
    email: '',
    password: '',
    nombre: '',
    apellidos: '',
    telefono: '',
    fechaNacimiento: '',
    curp: '',
    cedulaProfesional: '',
    especialidad: '',
  });
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);

  readonly passwordValida = computed(() => this.datos().password.length >= 8);
  readonly puedeEnviar = computed(() => {
    const d = this.datos();
    const basicos = d.email.trim() !== '' && d.nombre.trim() !== '' && d.apellidos.trim() !== '' && this.passwordValida();
    return basicos && (this.rol() === 'paciente' || d.cedulaProfesional.trim() !== '') && !this.enviando();
  });

  actualizar(campo: CampoRegistro, valor: string | null | undefined): void {
    this.datos.update((d) => ({ ...d, [campo]: valor ?? '' }));
  }

  async registrar(): Promise<void> {
    if (!this.puedeEnviar()) {
      return;
    }
    const d = this.datos();
    const opcional = (valor: string) => (valor.trim() === '' ? undefined : valor.trim());
    const solicitud: DatosRegistro = {
      rol: this.rol(),
      email: d.email.trim(),
      password: d.password,
      nombre: d.nombre.trim(),
      apellidos: d.apellidos.trim(),
      telefono: opcional(d.telefono),
      ...(this.rol() === 'paciente'
        ? { fechaNacimiento: opcional(d.fechaNacimiento), curp: opcional(d.curp)?.toUpperCase() }
        : { cedulaProfesional: d.cedulaProfesional.trim(), especialidad: opcional(d.especialidad) }),
    };

    this.enviando.set(true);
    this.error.set(null);
    try {
      this.sesion.iniciar(await this.auth.registrar(solicitud));
      await this.avisos.exito('registro_exito');
      await this.router.navigateByUrl(this.sesion.rutaInicio(), { replaceUrl: true });
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.enviando.set(false);
    }
  }
}
