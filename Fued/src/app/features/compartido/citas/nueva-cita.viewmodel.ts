import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type { Cita, Disponibilidad } from '../../../core/models';
import { CitasRepository } from '../../../core/repositories/citas.repository';
import { MedicosRepository } from '../../../core/repositories/medicos.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import { fechaLocalIso } from '../../../core/util/fechas.util';

export interface OpcionContraparte {
  id: string;
  nombre: string;
  detalle: string | null;
}

@Injectable()
export class NuevaCitaViewModel {
  private readonly citas = inject(CitasRepository);
  private readonly medicos = inject(MedicosRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly rol = this.sesion.rol;
  readonly opciones = signal<OpcionContraparte[]>([]);
  readonly seleccion = signal<string | null>(null);
  readonly fecha = signal(fechaLocalIso());
  readonly disponibilidad = signal<Disponibilidad | null>(null);
  readonly horario = signal<string | null>(null);
  readonly motivo = signal('');
  readonly cargandoHorarios = signal(false);
  readonly guardando = signal(false);
  readonly error = signal<string | null>(null);

  readonly hoy = fechaLocalIso();
  readonly idMedico = computed(() => (this.rol() === 'paciente' ? this.seleccion() : (this.sesion.usuario()?.id ?? null)));
  readonly hayHorariosLibres = computed(() => this.disponibilidad()?.horarios.some((h) => h.disponible) ?? false);
  readonly puedeGuardar = computed(
    () => this.seleccion() !== null && this.horario() !== null && this.motivo().trim().length >= 3 && !this.guardando(),
  );

  async iniciar(preseleccion?: string): Promise<void> {
    try {
      if (this.rol() === 'paciente') {
        const directorio = await this.medicos.directorio();
        this.opciones.set(directorio.map((m) => ({ id: m.idMedico, nombre: m.nombreCompleto, detalle: m.especialidad })));
      } else {
        const perfil = await this.medicos.miPerfil();
        this.opciones.set(perfil.pacientesVinculados.map((p) => ({ id: p.idPaciente, nombre: p.nombreCompleto, detalle: null })));
      }
      if (preseleccion && this.opciones().some((o) => o.id === preseleccion)) {
        this.seleccion.set(preseleccion);
      }
      await this.cargarHorarios();
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    }
  }

  async elegir(id: string | null): Promise<void> {
    this.seleccion.set(id);
    if (this.rol() === 'paciente') {
      this.horario.set(null);
      await this.cargarHorarios();
    }
  }

  async cambiarFecha(fecha: string): Promise<void> {
    this.fecha.set(fecha.slice(0, 10));
    this.horario.set(null);
    await this.cargarHorarios();
  }

  async cargarHorarios(): Promise<void> {
    const idMedico = this.idMedico();
    if (!idMedico) {
      this.disponibilidad.set(null);
      return;
    }
    this.cargandoHorarios.set(true);
    try {
      this.disponibilidad.set(await this.citas.disponibilidad(idMedico, this.fecha()));
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargandoHorarios.set(false);
    }
  }

  async guardar(): Promise<Cita | null> {
    const seleccion = this.seleccion();
    const horario = this.horario();
    if (!this.puedeGuardar() || !seleccion || !horario) {
      return null;
    }
    this.guardando.set(true);
    this.error.set(null);
    try {
      const cita = await this.citas.crear({
        fechaHora: horario,
        motivo: this.motivo().trim(),
        ...(this.rol() === 'paciente' ? { idMedico: seleccion } : { idPaciente: seleccion }),
      });
      await this.avisos.exito(cita.estado === 'pendiente' ? 'cita_solicitada' : 'cita_agendada');
      return cita;
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
      await this.cargarHorarios();
      return null;
    } finally {
      this.guardando.set(false);
    }
  }
}
