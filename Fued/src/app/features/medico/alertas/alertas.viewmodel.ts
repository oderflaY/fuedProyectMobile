import { Injectable, computed, inject, signal } from '@angular/core';
import type { Alerta, BandejaAlertas, EstadoAlerta, OrigenAlerta, SeveridadAlerta } from '../../../core/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { AlertasRepository } from '../../../core/repositories/alertas.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import type { SegmentoGrafica } from '../../compartido/graficas/grafica-pastel.component';

export type FiltroAlertas = EstadoAlerta | 'todas';
export type VistaGraficaAlertas = 'severidad' | 'origen';

const SEVERIDADES: SeveridadAlerta[] = ['urgente', 'atencion', 'informativa'];
const ORIGENES: OrigenAlerta[] = ['segmentacion', 'metrica', 'adherencia'];

const COLOR_GRAFICA: Record<SeveridadAlerta | OrigenAlerta, string> = {
  urgente: 'var(--ion-color-danger)',
  atencion: 'var(--ion-color-warning)',
  informativa: 'var(--ion-color-medium)',
  segmentacion: 'var(--ion-color-primary)',
  metrica: 'var(--ion-color-tertiary)',
  adherencia: 'var(--ion-color-secondary)',
};

@Injectable()
export class AlertasViewModel {
  private readonly repo = inject(AlertasRepository);
  private readonly avisos = inject(AvisosService);
  private readonly i18n = inject(I18nService);

  readonly bandeja = signal<BandejaAlertas | null>(null);
  readonly filtro = signal<FiltroAlertas>('nueva');
  readonly vistaGrafica = signal<VistaGraficaAlertas>('severidad');
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly alertas = computed(() => this.bandeja()?.alertas ?? []);
  readonly pendientes = computed(() => this.bandeja()?.pendientes ?? 0);
  /** Las urgentes primero: el orden por fecha no basta cuando hay varias. */
  readonly ordenadas = computed(() => {
    const peso = { urgente: 0, atencion: 1, informativa: 2 };
    return [...this.alertas()].sort((a, b) => peso[a.severidad] - peso[b.severidad]);
  });

  /** Reparto de las alertas del filtro actual; se omiten las rebanadas vacías. */
  readonly grafica = computed<SegmentoGrafica[]>(() => {
    const porSeveridad = this.vistaGrafica() === 'severidad';
    const categorias: (SeveridadAlerta | OrigenAlerta)[] = porSeveridad ? SEVERIDADES : ORIGENES;
    return categorias
      .map((categoria) => ({
        clave: categoria,
        etiqueta: this.i18n.t(`grafica_alertas_${categoria}`),
        valor: this.alertas().filter((a) => (porSeveridad ? a.severidad : a.origen) === categoria).length,
        color: COLOR_GRAFICA[categoria],
      }))
      .filter((s) => s.valor > 0);
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
