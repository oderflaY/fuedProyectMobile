import { Injectable, computed, inject, signal } from '@angular/core';
import type { EstadoRiesgo, PerfilMedico } from '../../../core/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { MedicosRepository } from '../../../core/repositories/medicos.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import type { SegmentoGrafica } from '../../compartido/graficas/grafica-pastel.component';

/** Los de riesgo alto encabezan la lista: es el orden en que hay que atenderlos. */
const ORDEN_RIESGO: Record<EstadoRiesgo, number> = { alto: 0, medio: 1, bajo: 2 };

export type VistaGrafica = 'riesgo' | 'adherencia';

type RangoAdherencia = 'alta' | 'media' | 'baja' | 'sin_datos';

/** Mismos cortes que el semáforo clínico: 80% o más es buena adherencia, menos de 50% es baja. */
function rangoAdherencia(porcentaje: number | null): RangoAdherencia {
  if (porcentaje === null) {
    return 'sin_datos';
  }
  return porcentaje >= 80 ? 'alta' : porcentaje >= 50 ? 'media' : 'baja';
}

const COLOR_ADHERENCIA: Record<RangoAdherencia, string> = {
  alta: 'var(--ion-color-success)',
  media: 'var(--ion-color-warning)',
  baja: 'var(--ion-color-danger)',
  sin_datos: 'var(--ion-color-medium)',
};

/** Estado del tablero de pacientes del médico: la lista, su búsqueda y su conteo. */
@Injectable()
export class PacientesViewModel {
  private readonly medicos = inject(MedicosRepository);
  private readonly avisos = inject(AvisosService);
  private readonly i18n = inject(I18nService);

  readonly perfil = signal<PerfilMedico | null>(null);
  readonly busqueda = signal('');
  readonly vistaGrafica = signal<VistaGrafica>('riesgo');
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** Sin cédula aprobada no hay pacientes que mostrar. */
  readonly verificado = computed(() => this.perfil()?.credenciales.estadoVerificacion === 'aprobado');
  readonly pacientes = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase();
    return [...(this.perfil()?.pacientesVinculados ?? [])]
      .filter((p) => p.nombreCompleto.toLocaleLowerCase().includes(texto))
      .sort((a, b) => ORDEN_RIESGO[a.estadoRiesgo] - ORDEN_RIESGO[b.estadoRiesgo] || a.nombreCompleto.localeCompare(b.nombreCompleto));
  });
  /** Cuántos hay por nivel de riesgo; la búsqueda no lo altera. */
  readonly conteo = computed(() => {
    const conteo: Record<EstadoRiesgo, number> = { alto: 0, medio: 0, bajo: 0 };
    for (const p of this.perfil()?.pacientesVinculados ?? []) {
      conteo[p.estadoRiesgo]++;
    }
    return conteo;
  });
  /** Reparto de todos los pacientes según la vista elegida; se omiten las rebanadas vacías. */
  readonly grafica = computed<SegmentoGrafica[]>(() => {
    if (this.vistaGrafica() === 'riesgo') {
      const conteo = this.conteo();
      return (['alto', 'medio', 'bajo'] as const).map((nivel) => ({
        clave: `riesgo_${nivel}`,
        etiqueta: this.i18n.t(`riesgo_${nivel}`),
        valor: conteo[nivel],
        color: `var(--app-riesgo-${nivel})`,
      })).filter((s) => s.valor > 0);
    }
    const conteo: Record<RangoAdherencia, number> = { alta: 0, media: 0, baja: 0, sin_datos: 0 };
    for (const p of this.perfil()?.pacientesVinculados ?? []) {
      conteo[rangoAdherencia(p.porcentajeAdherencia)]++;
    }
    return (Object.keys(conteo) as RangoAdherencia[]).map((rango) => ({
      clave: `adherencia_${rango}`,
      etiqueta: this.i18n.t(`grafica_adherencia_${rango}`),
      valor: conteo[rango],
      color: COLOR_ADHERENCIA[rango],
    })).filter((s) => s.valor > 0);
  });

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
}
