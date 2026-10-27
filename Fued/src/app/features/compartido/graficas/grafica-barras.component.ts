import { Component, computed, input, signal } from '@angular/core';
import { format, scaleBand, scaleLinear } from 'd3';

/** Una serie de la gráfica: un valor por categoría, en el mismo orden que `categorias`. */
export interface SerieGrafica {
  clave: string;
  etiqueta: string;
  color: string;
  valores: (number | null)[];
}

const ANCHO = 340;
const ALTO = 190;
const MARGEN = { arriba: 8, derecha: 6, abajo: 22, izquierda: 38 };
/** Separación entre segmentos apilados, del color de la tarjeta. */
const HUECO = 2;

const abreviar = format('~s');

/**
 * Barras verticales apiladas (una barra por categoría, un segmento por serie).
 * Con `normalizada` cada barra suma 100% y se grafica la proporción.
 * Al tocar una barra aparece el detalle con los valores de cada serie.
 */
@Component({
  selector: 'app-grafica-barras',
  template: `
    @if (series().length > 1) {
      <ul class="leyenda">
        @for (serie of series(); track serie.clave) {
          <li><span class="muestra" [style.background]="serie.color" aria-hidden="true"></span>{{ serie.etiqueta }}</li>
        }
      </ul>
    }
    <div class="lienzo">
      <svg [attr.viewBox]="caja" role="img" [attr.aria-label]="titulo()" (mouseleave)="activo.set(null)">
        @for (tick of ejeY().ticks; track tick.valor) {
          <line class="rejilla" [attr.x1]="margen.izquierda" [attr.x2]="ancho - margen.derecha" [attr.y1]="tick.y" [attr.y2]="tick.y" />
          <text class="eje" [attr.x]="margen.izquierda - 6" [attr.y]="tick.y" dy="0.32em" text-anchor="end">{{ tick.texto }}</text>
        }
        @for (barra of barras(); track barra.indice) {
          <g [class.atenuada]="activo() !== null && activo() !== barra.indice">
            @for (segmento of barra.segmentos; track segmento.clave) {
              <rect [attr.x]="barra.x" [attr.width]="barra.ancho" [attr.y]="segmento.y" [attr.height]="segmento.alto" [attr.fill]="segmento.color" rx="3" />
            }
          </g>
          @if (barra.etiqueta) {
            <text class="eje" [attr.x]="barra.x + barra.ancho / 2" [attr.y]="alto - 6" text-anchor="middle">{{ barra.etiqueta }}</text>
          }
          <rect
            class="zona"
            [attr.x]="barra.zonaX"
            [attr.width]="barra.zonaAncho"
            [attr.y]="margen.arriba"
            [attr.height]="alto - margen.arriba - margen.abajo"
            (mouseenter)="activo.set(barra.indice)"
            (click)="alternar(barra.indice)"
          />
        }
      </svg>
      @if (detalle(); as d) {
        <div class="detalle" [style.left.%]="d.izquierda" role="status">
          <strong>{{ d.categoria }}</strong>
          @for (fila of d.filas; track fila.etiqueta) {
            <span><span class="muestra" [style.background]="fila.color" aria-hidden="true"></span>{{ fila.etiqueta }} <b>{{ fila.texto }}</b></span>
          }
          @if (d.total !== null) {
            <span class="total">{{ etiquetaTotal() }} <b>{{ d.total }}</b></span>
          }
        </div>
      }
    </div>
  `,
  styleUrl: 'graficas.scss',
})
export class GraficaBarrasComponent {
  readonly categorias = input.required<string[]>();
  readonly series = input.required<SerieGrafica[]>();
  /** Título accesible; el detalle visible va en la leyenda y al tocar. */
  readonly titulo = input('');
  /** Cada barra suma 100%: muestra proporciones en vez de cantidades. */
  readonly normalizada = input(false);
  readonly etiquetaTotal = input('Total');
  /** Muestra sólo una de cada N etiquetas del eje X cuando no caben. */
  readonly saltoEtiquetas = input(1);

  readonly activo = signal<number | null>(null);
  readonly ancho = ANCHO;
  readonly alto = ALTO;
  readonly margen = MARGEN;
  readonly caja = `0 0 ${ANCHO} ${ALTO}`;

  private readonly totales = computed(() =>
    this.categorias().map((_, i) => this.series().reduce((suma, s) => suma + (s.valores[i] ?? 0), 0)),
  );

  private readonly escalaX = computed(() =>
    scaleBand<number>()
      .domain(this.categorias().map((_, i) => i))
      .range([MARGEN.izquierda, ANCHO - MARGEN.derecha])
      .paddingInner(0.25)
      .paddingOuter(0.1),
  );

  private readonly escalaY = computed(() => {
    const maximo = this.normalizada() ? 100 : Math.max(1, ...this.totales());
    return scaleLinear([0, maximo], [ALTO - MARGEN.abajo, MARGEN.arriba]).nice();
  });

  readonly ejeY = computed(() => {
    const y = this.escalaY();
    return {
      ticks: y.ticks(4).map((valor) => ({ valor, y: y(valor), texto: this.normalizada() ? `${valor}%` : abreviar(valor) })),
    };
  });

  readonly barras = computed(() => {
    const x = this.escalaX();
    const y = this.escalaY();
    const paso = Math.max(1, this.saltoEtiquetas());
    const total = this.categorias().length;
    return this.categorias().map((categoria, i) => {
      const suma = this.totales()[i];
      let acumulado = 0;
      const segmentos = this.series().map((serie) => {
        const crudo = serie.valores[i] ?? 0;
        const valor = this.normalizada() ? (suma ? (crudo * 100) / suma : 0) : crudo;
        const base = acumulado;
        acumulado += valor;
        const arriba = y(acumulado);
        const abajo = y(base);
        // El hueco sólo entre segmentos, para que la barra siga apoyada en el eje.
        const alto = Math.max(0, abajo - arriba - (base > 0 ? HUECO : 0));
        return { clave: serie.clave, color: serie.color, y: arriba, alto };
      });
      const zonaAncho = x.step();
      return {
        indice: i,
        x: x(i) ?? 0,
        ancho: x.bandwidth(),
        zonaX: (x(i) ?? 0) - (x.step() - x.bandwidth()) / 2,
        zonaAncho,
        etiqueta: i % paso === 0 || i === total - 1 ? categoria : '',
        segmentos: segmentos.filter((s) => s.alto > 0),
      };
    });
  });

  readonly detalle = computed(() => {
    const i = this.activo();
    if (i === null || i >= this.categorias().length) {
      return null;
    }
    const suma = this.totales()[i];
    const x = this.escalaX();
    const centro = ((x(i) ?? 0) + x.bandwidth() / 2) / ANCHO;
    return {
      categoria: this.categorias()[i],
      izquierda: Math.min(72, Math.max(4, centro * 100 - 14)),
      filas: [...this.series()].reverse().filter((serie) => (serie.valores[i] ?? 0) > 0).map((serie) => {
        const valor = serie.valores[i] ?? 0;
        const proporcion = suma ? Math.round((valor * 1000) / suma) / 10 : 0;
        return {
          etiqueta: serie.etiqueta,
          color: serie.color,
          texto: this.normalizada() ? `${proporcion}% (${valor.toLocaleString('es-MX')})` : valor.toLocaleString('es-MX'),
        };
      }),
      total: this.series().length > 1 ? suma.toLocaleString('es-MX') : null,
    };
  });

  /** En pantallas táctiles no hay hover: tocar abre y cierra el detalle. */
  alternar(indice: number): void {
    this.activo.update((actual) => (actual === indice ? null : indice));
  }
}
