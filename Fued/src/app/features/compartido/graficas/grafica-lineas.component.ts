import { Component, computed, input, signal } from '@angular/core';
import { area, curveMonotoneX, extent, line, scaleLinear, scalePoint } from 'd3';
import type { SerieGrafica } from './grafica-barras.component';

const ANCHO = 340;
const ALTO = 180;
const MARGEN = { arriba: 10, derecha: 10, abajo: 22, izquierda: 38 };

type Punto = [number, number | null];

/**
 * Líneas de una misma unidad a lo largo de los meses (un solo eje Y).
 * Con una sola serie se rellena el área bajo la línea. Al tocar se muestra una guía vertical
 * con el valor de cada serie en ese mes.
 */
@Component({
  selector: 'app-grafica-lineas',
  template: `
    @if (series().length > 1) {
      <ul class="leyenda">
        @for (serie of series(); track serie.clave) {
          <li><span class="muestra linea" [style.background]="serie.color" aria-hidden="true"></span>{{ serie.etiqueta }}</li>
        }
      </ul>
    }
    <div class="lienzo">
      <svg [attr.viewBox]="caja" role="img" [attr.aria-label]="titulo()" (mouseleave)="activo.set(null)">
        @for (tick of ticks(); track tick.valor) {
          <line class="rejilla" [attr.x1]="margen.izquierda" [attr.x2]="ancho - margen.derecha" [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="eje" [attr.x]="margen.izquierda - 6" [attr.y]="tick.y" dy="0.32em" text-anchor="end">{{ tick.texto }}</text>
        }
        @for (etiqueta of etiquetasX(); track etiqueta.indice) {
          <text class="eje" [attr.x]="etiqueta.x" [attr.y]="alto - 6" text-anchor="middle">{{ etiqueta.texto }}</text>
        }
        @for (trazo of trazos(); track trazo.clave) {
          @if (trazo.area) {
            <path class="area" [attr.d]="trazo.area" [attr.fill]="trazo.color" />
          }
          <path class="linea" [attr.d]="trazo.linea" [attr.stroke]="trazo.color" />
        }
        @if (guia(); as g) {
          <line class="guia" [attr.x1]="g.x" [attr.x2]="g.x" [attr.y1]="margen.arriba" [attr.y2]="alto - margen.abajo" />
          @for (punto of g.puntos; track punto.clave) {
            <circle class="marcador" [attr.cx]="g.x" [attr.cy]="punto.y" r="4.5" [attr.fill]="punto.color" />
          }
        }
        @for (zona of zonas(); track zona.indice) {
          <rect
            class="zona"
            [attr.x]="zona.x"
            [attr.width]="zona.ancho"
            [attr.y]="margen.arriba"
            [attr.height]="alto - margen.arriba - margen.abajo"
            (mouseenter)="activo.set(zona.indice)"
            (click)="alternar(zona.indice)"
          />
        }
      </svg>
      @if (guia(); as g) {
        <div class="detalle" [style.left.%]="g.izquierda" role="status">
          <strong>{{ g.categoria }}</strong>
          @for (punto of g.puntos; track punto.clave) {
            <span><span class="muestra" [style.background]="punto.color" aria-hidden="true"></span>{{ punto.etiqueta }} <b>{{ punto.texto }}</b></span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: 'graficas.scss',
})
export class GraficaLineasComponent {
  readonly categorias = input.required<string[]>();
  readonly series = input.required<SerieGrafica[]>();
  readonly titulo = input('');
  /** Se agrega a cada valor del detalle, p. ej. "mg/dL". */
  readonly unidad = input('');
  /** El eje Y arranca en cero (conteos) en vez de ajustarse a los datos (promedios). */
  readonly desdeCero = input(false);
  readonly saltoEtiquetas = input(1);

  readonly activo = signal<number | null>(null);
  readonly ancho = ANCHO;
  readonly alto = ALTO;
  readonly margen = MARGEN;
  readonly caja = `0 0 ${ANCHO} ${ALTO}`;

  private readonly escalaX = computed(() =>
    scalePoint<number>()
      .domain(this.categorias().map((_, i) => i))
      .range([MARGEN.izquierda + 6, ANCHO - MARGEN.derecha - 4]),
  );

  private readonly escalaY = computed(() => {
    const valores = this.series().flatMap((s) => s.valores.filter((v): v is number => v !== null));
    const [minimo = 0, maximo = 1] = extent(valores);
    const holgura = (maximo - minimo) * 0.15 || 1;
    const desde = this.desdeCero() ? 0 : minimo - holgura;
    return scaleLinear([desde, maximo + holgura], [ALTO - MARGEN.abajo, MARGEN.arriba]).nice();
  });

  readonly ticks = computed(() => {
    const y = this.escalaY();
    return y.ticks(4).map((valor) => ({ valor, y: y(valor), texto: valor.toLocaleString('es-MX') }));
  });

  readonly etiquetasX = computed(() => {
    const x = this.escalaX();
    const paso = Math.max(1, this.saltoEtiquetas());
    const total = this.categorias().length;
    return this.categorias()
      .map((texto, indice) => ({ indice, texto, x: x(indice) ?? 0 }))
      .filter((e) => e.indice % paso === 0 || e.indice === total - 1);
  });

  readonly trazos = computed(() => {
    const x = this.escalaX();
    const y = this.escalaY();
    const definido = (p: Punto) => p[1] !== null;
    const generarLinea = line<Punto>()
      .defined(definido)
      .x((p) => x(p[0]) ?? 0)
      .y((p) => y(p[1] ?? 0))
      .curve(curveMonotoneX);
    const generarArea = area<Punto>()
      .defined(definido)
      .x((p) => x(p[0]) ?? 0)
      .y0(y.range()[0])
      .y1((p) => y(p[1] ?? 0))
      .curve(curveMonotoneX);
    const unaSola = this.series().length === 1;
    return this.series().map((serie) => {
      const puntos = serie.valores.map((v, i): Punto => [i, v]);
      return {
        clave: serie.clave,
        color: serie.color,
        linea: generarLinea(puntos) ?? '',
        area: unaSola ? (generarArea(puntos) ?? '') : '',
      };
    });
  });

  readonly zonas = computed(() => {
    const x = this.escalaX();
    const paso = x.step();
    return this.categorias().map((_, indice) => ({ indice, x: (x(indice) ?? 0) - paso / 2, ancho: paso }));
  });

  readonly guia = computed(() => {
    const i = this.activo();
    if (i === null || i >= this.categorias().length) {
      return null;
    }
    const x = this.escalaX()(i) ?? 0;
    const y = this.escalaY();
    const unidad = this.unidad() ? ` ${this.unidad()}` : '';
    return {
      x,
      categoria: this.categorias()[i],
      izquierda: Math.min(72, Math.max(4, (x / ANCHO) * 100 - 14)),
      puntos: this.series()
        .filter((s) => s.valores[i] !== null)
        .map((s) => ({
          clave: s.clave,
          etiqueta: s.etiqueta,
          color: s.color,
          y: y(s.valores[i] ?? 0),
          texto: `${(s.valores[i] ?? 0).toLocaleString('es-MX')}${unidad}`,
        })),
    };
  });

  alternar(indice: number): void {
    this.activo.update((actual) => (actual === indice ? null : indice));
  }
}
