import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import type { PerfilMedico } from '../../../core/models';
import { MedicosRepository } from '../../../core/repositories/medicos.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import { SonidosService } from '../../../core/ui/sonidos.service';

/** Estado del perfil propio del médico: lo carga, lo guarda y cierra la sesión. */
@Injectable()
export class PerfilMedicoViewModel {
  private readonly medicos = inject(MedicosRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);
  private readonly sonidos = inject(SonidosService);
  private readonly router = inject(Router);

  readonly perfil = signal<PerfilMedico | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      this.perfil.set(await this.medicos.miPerfil());
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Guarda un parche del perfil; la sesión se sincroniza porque pinta el encabezado. */
  async actualizar(cambios: Record<string, unknown>): Promise<void> {
    try {
      const perfil = await this.medicos.actualizarMiPerfil(cambios);
      this.perfil.set(perfil);
      const usuario = this.sesion.usuario();
      if (usuario) {
        this.sesion.actualizarUsuario({
          ...usuario,
          nombre: perfil.datosPersonales.nombre,
          apellidos: perfil.datosPersonales.apellidos,
          especialidad: perfil.credenciales.especialidad,
        });
      }
      await this.avisos.exito('perfil_guardado');
    } catch (error) {
      await this.avisos.error(error);
    }
  }

  async cerrarSesion(): Promise<void> {
    this.sonidos.silbatazo();
    this.sesion.cerrar();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
