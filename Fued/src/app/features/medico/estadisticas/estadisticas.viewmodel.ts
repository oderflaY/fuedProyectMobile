import { Injectable, computed, inject, signal } from '@angular/core';
import type { Conteo, EstadisticasSistema } from '../../../core/models';
import { I18nService } from '../../../core/i18n/i18n.service';
import { EstadisticasRepository } from '../../../core/repositories/estadisticas.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import type { FilaBarra } from '../../compartido/graficas/grafica-barras-h.component';
import type { SerieGrafica } from '../../compartido/graficas/grafica-barras.component';
import type { SegmentoGrafica } from '../../compartido/graficas/grafica-pastel.component';

export type RangoMeses = 6 | 12 | 18;

/**
 * Paleta categórica para fondo oscuro, en orden fijo (nunca se recorre en ciclo).
 * Los estados clínicos (bien / atención / mal) usan los colores semánticos del tema, no éstos.
 */
const CATEGORICA = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

const FORMATO_MES = new Intl.DateTimeFormat('es-MX', { month: 'short', timeZone: 'UTC' });

/** '2026-01' -> 'ene 26'; los demás meses sólo con su abreviatura. */
function etiquetaMes(mes: string, indice: number): string {
  const fecha = new Date(`${mes}-01T12:00:00Z`);
  const corto = FORMATO_MES.format(fecha).replace('.', '');
  return indice === 0 || mes.endsWith('-01') ? `${corto} ${mes.slice(2, 4)}` : corto;
}

/** Estado del tablero de estadísticas: una consulta GraphQL y su transformación en series. */
@Injectable()
export class EstadisticasViewModel {
  private readonly repositorio = inject(EstadisticasRepository);
  private readonly avisos = inject(AvisosService);
  private readonly i18n = inject(I18nService);

  readonly meses = signal<RangoMeses>(12);
  readonly datos = signal<EstadisticasSistema | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** Muestra una de cada dos etiquetas de mes cuando son muchas. */
  readonly saltoMeses = computed(() => (this.meses() > 12 ? 3 : this.meses() > 6 ? 2 : 1));

  readonly indicadores = computed(() => {
    const r = this.datos()?.resumen;
    if (!r) {
      return [];
    }
    return [
      { clave: 'pacientes', icono: 'people-outline', valor: r.pacientes },
      { clave: 'medicos', icono: 'medkit-outline', valor: r.medicos },
      { clave: 'citas', icono: 'calendar-outline', valor: r.citas },
      { clave: 'metricas', icono: 'pulse-outline', valor: r.metricasVitales },
      { clave: 'tomas', icono: 'checkmark-circle-outline', valor: r.tomas },
      { clave: 'alertas', icono: 'notifications-outline', valor: r.alertas },
    ];
  });

  /** Cuántas filas suman todas las tablas que alimentan el tablero. */
  readonly totalRegistros = computed(() => {
    const r = this.datos()?.resumen;
    return r ? r.pacientes + r.medicos + r.citas + r.metricasVitales + r.tomas + r.tratamientos + r.perfilesCronicos + r.alertas : 0;
  });

  readonly mesesRegistros = computed(() => this.etiquetasMes(this.datos()?.registrosPorMes));
  readonly seriesRegistros = computed<SerieGrafica[]>(() => [
    {
      clave: 'pacientes',
      etiqueta: this.i18n.t('est_serie_pacientes_nuevos'),
      color: CATEGORICA[0],
      valores: this.datos()?.registrosPorMes.map((m) => m.pacientes) ?? [],
    },
  ]);

  readonly mesesCitas = computed(() => this.etiquetasMes(this.datos()?.citasPorMes));
  readonly seriesCitas = computed<SerieGrafica[]>(() => {
    const citas = this.datos()?.citasPorMes ?? [];
    // Orden de apilado = orden de la paleta, para que segmentos vecinos se distingan también con daltonismo.
    return (['completadas', 'canceladas', 'confirmadas', 'pendientes'] as const).map((estado, i) => ({
      clave: estado,
      etiqueta: this.i18n.t(`est_serie_${estado}`),
      color: CATEGORICA[i],
      valores: citas.map((m) => m[estado]),
    }));
  });

  readonly mesesAdherencia = computed(() => this.etiquetasMes(this.datos()?.adherenciaPorMes));
  readonly seriesAdherencia = computed<SerieGrafica[]>(() => {
    const meses = this.datos()?.adherenciaPorMes ?? [];
    return [
      { clave: 'tomado', etiqueta: this.i18n.t('est_serie_tomado'), color: 'var(--ion-color-success)', valores: meses.map((m) => m.tomado) },
      { clave: 'tarde', etiqueta: this.i18n.t('est_serie_tarde'), color: 'var(--ion-color-warning)', valores: meses.map((m) => m.tomadoTarde) },
      { clave: 'omitido', etiqueta: this.i18n.t('est_serie_omitido'), color: 'var(--ion-color-danger)', valores: meses.map((m) => m.omitido) },
    ];
  });
  /** El último mes con datos, para el número grande de la tarjeta. */
  readonly adherenciaActual = computed(() => {
    const meses = (this.datos()?.adherenciaPorMes ?? []).filter((m) => m.porcentaje !== null);
    return meses[meses.length - 1]?.porcentaje ?? null;
  });

  readonly mesesVitales = computed(() => this.etiquetasMes(this.datos()?.signosVitalesPorMes));
  readonly seriesPresion = computed<SerieGrafica[]>(() => {
    const meses = this.datos()?.signosVitalesPorMes ?? [];
    return [
      { clave: 'sistolica', etiqueta: this.i18n.t('est_serie_sistolica'), color: CATEGORICA[0], valores: meses.map((m) => m.sistolica) },
      { clave: 'diastolica', etiqueta: this.i18n.t('est_serie_diastolica'), color: CATEGORICA[1], valores: meses.map((m) => m.diastolica) },
    ];
  });
  readonly seriesGlucosa = computed<SerieGrafica[]>(() => [
    {
      clave: 'glucosa',
      etiqueta: this.i18n.t('est_serie_glucosa'),
      color: CATEGORICA[2],
      valores: this.datos()?.signosVitalesPorMes.map((m) => m.glucosa) ?? [],
    },
  ]);

  readonly condiciones = computed(() => (this.datos()?.segmentosPorCondicion ?? []).map((s) => this.i18n.t(`est_cond_${s.condicion}`)));
  readonly seriesSegmentos = computed<SerieGrafica[]>(() => {
    const filas = this.datos()?.segmentosPorCondicion ?? [];
    return [
      { clave: 'controlado', etiqueta: this.i18n.t('segmento_controlado'), color: 'var(--app-riesgo-bajo)', valores: filas.map((f) => f.controlado) },
      { clave: 'seguimiento', etiqueta: this.i18n.t('segmento_seguimiento'), color: 'var(--app-riesgo-medio)', valores: filas.map((f) => f.seguimiento) },
      { clave: 'riesgo', etiqueta: this.i18n.t('segmento_riesgo'), color: 'var(--app-riesgo-alto)', valores: filas.map((f) => f.riesgo) },
      { clave: 'sin_clasificar', etiqueta: this.i18n.t('segmento_sin_clasificar'), color: 'var(--ion-color-medium)', valores: filas.map((f) => f.sinClasificar) },
    ];
  });

  readonly rangosEdad = computed(() => (this.datos()?.pacientesPorEdad ?? []).map((c) => c.clave));
  readonly seriesEdad = computed<SerieGrafica[]>(() => [
    {
      clave: 'edad',
      etiqueta: this.i18n.t('est_serie_pacientes'),
      color: CATEGORICA[0],
      valores: (this.datos()?.pacientesPorEdad ?? []).map((c) => c.valor),
    },
  ]);

  readonly genero = computed<SegmentoGrafica[]>(() =>
    (this.datos()?.pacientesPorGenero ?? []).map((c, i) => ({ clave: c.clave, etiqueta: c.clave, valor: c.valor, color: CATEGORICA[i % 3] })),
  );

  readonly alertas = computed<SegmentoGrafica[]>(() => {
    const color: Record<string, string> = {
      urgente: 'var(--ion-color-danger)',
      atencion: 'var(--ion-color-warning)',
      informativa: 'var(--ion-color-medium)',
    };
    return (this.datos()?.alertasPorSeveridad ?? []).map((c) => ({
      clave: c.clave,
      etiqueta: this.i18n.t(`grafica_alertas_${c.clave}`),
      valor: c.valor,
      color: color[c.clave] ?? 'var(--ion-color-medium)',
    }));
  });

  readonly sangre = computed<FilaBarra[]>(() => this.filas(this.datos()?.pacientesPorTipoSangre));
  readonly especialidades = computed<FilaBarra[]>(() => this.filas(this.datos()?.medicosPorEspecialidad));
  readonly topMedicos = computed<FilaBarra[]>(() =>
    (this.datos()?.topMedicos ?? []).map((m) => ({
      clave: m.nombre,
      etiqueta: m.nombre,
      detalle: this.i18n.t('est_top_detalle', { especialidad: m.especialidad ?? '—', citas: m.citas.toLocaleString('es-MX') }),
      valor: m.pacientes,
    })),
  );

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      this.datos.set(await this.repositorio.delSistema(this.meses()));
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarMeses(meses: RangoMeses): Promise<void> {
    if (meses === this.meses()) {
      return;
    }
    this.meses.set(meses);
    await this.cargar();
  }

  private etiquetasMes(filas?: { mes: string }[]): string[] {
    return (filas ?? []).map((f, i) => etiquetaMes(f.mes, i));
  }

  private filas(conteos?: Conteo[]): FilaBarra[] {
    return (conteos ?? []).map((c) => ({ clave: c.clave, etiqueta: c.clave, valor: c.valor }));
  }
}
