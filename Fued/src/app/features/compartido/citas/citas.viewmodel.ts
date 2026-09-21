import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type { Cita, EstadoCita } from '../../../core/models';
import { CitasRepository } from '../../../core/repositories/citas.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

export type FiltroCitas = 'pendientes' | 'proximas' | 'historial';

const ACTIVAS: EstadoCita[] = ['pendiente', 'confirmada'];

export function filtrarCitas(citas: Cita[], filtro: FiltroCitas, ahora = Date.now()): Cita[] {
  const vigente = (c: Cita) => ACTIVAS.includes(c.estado) && new Date(c.fechaHora).getTime() + c.duracionMin * 60_000 >= ahora;
  switch (filtro) {
    case 'pendientes':
      return citas.filter((c) => c.estado === 'pendiente' && vigente(c));
    case 'proximas':
      return citas.filter(vigente);
    case 'historial':
      return citas.filter((c) => !vigente(c)).sort((a, b) => b.fechaHora.localeCompare(a.fechaHora));
  }
}

@Injectable()
export class CitasViewModel {
  private readonly repo = inject(CitasRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly rol = this.sesion.rol;
  readonly filtro = signal<FiltroCitas>(this.sesion.rol() === 'medico' ? 'pendientes' : 'proximas');
  readonly citas = signal<Cita[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly visibles = computed(() => filtrarCitas(this.citas(), this.filtro()));
  readonly totalPendientes = computed(() => filtrarCitas(this.citas(), 'pendientes').length);

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      this.citas.set(await this.repo.listar());
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarEstado(cita: Cita, estado: EstadoCita, notasMedico?: string | null): Promise<void> {
    try {
      const actualizada = await this.repo.cambiarEstado(cita.idCita, estado, notasMedico);
      this.citas.update((citas) => citas.map((c) => (c.idCita === actualizada.idCita ? actualizada : c)));
      await this.avisos.exito(`cita_aviso_${estado}`);
    } catch (error) {
      await this.avisos.error(error);
    }
  }
}
