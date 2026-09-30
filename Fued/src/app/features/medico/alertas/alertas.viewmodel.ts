import { Injectable, computed, inject, signal } from '@angular/core';
import type { Alerta, BandejaAlertas, EstadoAlerta } from '../../../core/models';
import { AlertasRepository } from '../../../core/repositories/alertas.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

export type FiltroAlertas = EstadoAlerta | 'todas';

@Injectable()
export class AlertasViewModel {
  private readonly repo = inject(AlertasRepository);
  private readonly avisos = inject(AvisosService);

  readonly bandeja = signal<BandejaAlertas | null>(null);
  readonly filtro = signal<FiltroAlertas>('nueva');
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly alertas = computed(() => this.bandeja()?.alertas ?? []);
  readonly pendientes = computed(() => this.bandeja()?.pendientes ?? 0);
  /** Las urgentes primero: el orden por fecha no basta cuando hay varias. */
  readonly ordenadas = computed(() => {
    const peso = { urgente: 0, atencion: 1, informativa: 2 };
    return [...this.alertas()].sort((a, b) => peso[a.severidad] - peso[b.severidad]);
  });

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      const filtro = this.filtro();
      this.bandeja.set(await this.repo.bandeja(filtro === 'todas' ? undefined : filtro));
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarFiltro(filtro: FiltroAlertas): Promise<void> {
    this.filtro.set(filtro);
    await this.cargar();
  }

  async marcar(alerta: Alerta, estado: 'vista' | 'atendida', notas?: string): Promise<void> {
    try {
      await this.repo.marcar(alerta.idAlerta, estado, notas);
      await this.cargar();
      await this.avisos.exito(estado === 'atendida' ? 'alertas_atendida' : 'alertas_vista');
    } catch (error) {
      await this.avisos.error(error);
    }
  }
}
