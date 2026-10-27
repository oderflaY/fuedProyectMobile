import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionService } from '../../../core/auth/session.service';
import type { Expediente, MedicoPublico, NivelAcceso } from '../../../core/models';
import { MedicosRepository } from '../../../core/repositories/medicos.repository';
import { PacientesRepository } from '../../../core/repositories/pacientes.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import { SonidosService } from '../../../core/ui/sonidos.service';

@Injectable()
export class PerfilPacienteViewModel {
  private readonly pacientes = inject(PacientesRepository);
  private readonly medicos = inject(MedicosRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);
  private readonly sonidos = inject(SonidosService);
  private readonly router = inject(Router);

  readonly usuario = this.sesion.usuario;
  readonly expediente = signal<Expediente | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly medicosAutorizados = computed(() => this.expediente()?.controlAccesos.medicosAutorizados ?? []);
  readonly tarjetas = computed(() => this.expediente()?.dispositivosRfid ?? []);

  private get id(): string {
    return this.sesion.usuario()?.id ?? '';
  }

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      this.expediente.set(await this.pacientes.expediente(this.id));
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  async actualizar(cambios: Record<string, unknown>): Promise<void> {
    try {
      const expediente = await this.pacientes.actualizar(this.id, cambios);
      this.expediente.set(expediente);
      const usuario = this.sesion.usuario();
      if (usuario) {
        this.sesion.actualizarUsuario({ ...usuario, nombre: expediente.datosPersonales.nombre, apellidos: expediente.datosPersonales.apellidos });
      }
      await this.avisos.exito('perfil_guardado');
    } catch (error) {
      await this.avisos.error(error);
    }
  }

  /** Médicos del directorio que todavía no tienen acceso. */
  async medicosDisponibles(): Promise<MedicoPublico[]> {
    try {
      const autorizados = new Set(this.medicosAutorizados().map((m) => m.idMedico));
      const disponibles = (await this.medicos.directorio()).filter((m) => !autorizados.has(m.idMedico));
      if (disponibles.length === 0) {
        await this.avisos.info('perfil_sin_medicos_disponibles');
      }
      return disponibles;
    } catch (error) {
      await this.avisos.error(error);
      return [];
    }
  }

  private async ejecutar(accion: () => Promise<unknown>, aviso: string): Promise<void> {
    try {
      await accion();
      await this.cargar();
      await this.avisos.exito(aviso);
    } catch (error) {
      await this.avisos.error(error);
    }
  }

  otorgarAcceso(idMedico: string, nivel: NivelAcceso): Promise<void> {
    return this.ejecutar(() => this.pacientes.otorgarAcceso(this.id, idMedico, nivel), 'perfil_acceso_otorgado');
  }

  revocarAcceso(idMedico: string): Promise<void> {
    return this.ejecutar(() => this.pacientes.revocarAcceso(this.id, idMedico), 'perfil_acceso_revocado');
  }

  asignarTarjeta(idTarjeta?: string): Promise<void> {
    return this.ejecutar(() => this.pacientes.asignarRfid(this.id, idTarjeta), 'perfil_tarjeta_asignada');
  }

  reportarExtraviada(idTarjeta: string): Promise<void> {
    return this.ejecutar(() => this.pacientes.reportarRfidExtraviada(this.id, idTarjeta), 'perfil_tarjeta_revocada');
  }

  async cerrarSesion(): Promise<void> {
    this.sonidos.silbatazo();
    this.sesion.cerrar();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}
