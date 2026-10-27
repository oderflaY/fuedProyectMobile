import { Component, ElementRef, afterRenderEffect, computed, input, viewChild } from '@angular/core';
import { arc, easeCubicOut, interpolate, pie, select } from 'd3';
import type { PieArcDatum } from 'd3';

/** Rebanada de la gráfica; `color` es cualquier color CSS, también `var(--ion-color-…)`. */
export interface SegmentoGrafica {
  clave: string;
  etiqueta: string;
  valor: number;
  color: string;
}

type Arco = PieArcDatum<SegmentoGrafica>;

const RADIO = 100;
const DURACION = 750;
/** La ruleta da una vuelta completa cada vez que cambian los datos. */
const DURACION_GIRO = 1200;
const FOCOS = 16;

/**
 * Pastel que se anima al cambiar los datos, como https://observablehq.com/@d3/pie-chart-update:
 * cada rebanada interpola sus ángulos desde donde estaba hasta los nuevos.
 * Las rebanadas que aparecen crecen desde ancho cero y las que se van se cierran.
 * Se viste de ruleta de feria: aro con foquitos, flecha, centro de lámina y un giro al actualizar.
 */
@Component({
  selector: 'app-grafica-pastel',
  template: `
    <svg [attr.viewBox]="caja" role="img" [attr.aria-label]="descripcion()">
      <circle class="aro" [attr.r]="radioAro" />
      @for (foco of focos; track $index) {
        <circle class="foco" [class.par]="$index % 2 === 0" [attr.cx]="foco.x" [attr.cy]="foco.y" r="4.5" />
      }
      <g #ruleta></g>
      <circle class="centro" r="15" />
      <circle class="tornillo" r="4" />
      <path class="flecha" [attr.d]="flecha" />
    </svg>
    <ul class="leyenda">
      @for (segmento of segmentos(); track segmento.clave) {
        <li>
          <span class="muestra" [style.background]="segmento.color" aria-hidden="true"></span>
          <span class="etiqueta">{{ segmento.etiqueta }}</span>
          <strong>{{ segmento.valor }}</strong>
          <span class="porcentaje">{{ porcentaje(segmento.valor) }}%</span>
        </li>
      }
    </ul>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    svg {
      width: 38%;
      max-width: 10rem;
      flex-shrink: 0;
      overflow: visible;
    }

    .aro {
      fill: #7a0033;
      stroke: #000;
      stroke-width: 3;
    }

    .foco {
      fill: #fff6b0;
      stroke: #000;
      stroke-width: 1.5;
    }

    .foco.par {
      fill: #ffd700;
    }

    .centro {
      fill: #ffd700;
      stroke: #000;
      stroke-width: 3;
    }

    .tornillo {
      fill: #9a7d00;
      stroke: #000;
      stroke-width: 1.5;
    }

    .flecha {
      fill: #fff;
      stroke: #000;
      stroke-width: 3;
      stroke-linejoin: round;
    }

    @media (prefers-reduced-motion: reduce) {
      .foco {
        animation: none;
      }
    }

    .leyenda {
      list-style: none;
      margin: 0;
      padding: 0;
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      font-size: 0.875rem;
      font-family: var(--barrio-marcador, inherit);
    }

    strong {
      font-family: var(--barrio-titulo, inherit);
      font-weight: 400;
      font-size: 1.15rem;
      letter-spacing: 0.04em;
      color: var(--barrio-amarillo, inherit);
      text-shadow: 1px 1px 0 #000;
    }

    li {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .muestra {
      width: 0.75rem;
      height: 0.75rem;
      border-radius: 50%;
      border: 2px solid #000;
      box-shadow: 0 0 6px currentColor;
      flex-shrink: 0;
    }

    .etiqueta {
      flex: 1;
    }

    .porcentaje {
      min-width: 2.25rem;
      text-align: end;
      color: var(--app-texto-secundario);
      font-variant-numeric: tabular-nums;
      font-family: var(--barrio-titulo, inherit);
      letter-spacing: 0.04em;
    }
  `,
})
export class GraficaPastelComponent {
  readonly segmentos = input.required<SegmentoGrafica[]>();
  /** Título accesible de la gráfica; la leyenda lleva los números. */
  readonly titulo = input('');

  private readonly ruleta = viewChild.required<ElementRef<SVGGElement>>('ruleta');

  readonly radioAro = RADIO + 14;
  readonly caja = `${-(RADIO + 18)} ${-(RADIO + 30)} ${(RADIO + 18) * 2} ${(RADIO + 18) * 2 + 12}`;
  readonly focos = Array.from({ length: FOCOS }, (_, i) => {
    const angulo = (i / FOCOS) * 2 * Math.PI;
    return { x: Math.sin(angulo) * (RADIO + 7), y: -Math.cos(angulo) * (RADIO + 7) };
  });
  /** Flecha que apunta hacia abajo, clavada arriba del aro. */
  readonly flecha = `M 0 ${-RADIO + 4} L -11 ${-RADIO - 22} L 11 ${-RADIO - 22} Z`;
  readonly total = computed(() => this.segmentos().reduce((suma, s) => suma + s.valor, 0));
  readonly descripcion = computed(() =>
    [this.titulo(), ...this.segmentos().map((s) => `${s.etiqueta}: ${s.valor}`)].filter(Boolean).join('. '),
  );

  private readonly generarPastel = pie<SegmentoGrafica>()
    .sort(null)
    .value((s) => s.valor);
  private readonly generarArco = arc<Arco>().innerRadius(0).outerRadius(RADIO);
  /** El arco que pinta cada <path> ahora mismo; de ahí parte la siguiente transición. */
  private readonly actual = new WeakMap<Element, Arco>();
  private primeraVez = true;

  constructor() {
    afterRenderEffect(() => this.dibujar(this.segmentos()));
  }

  porcentaje(valor: number): number {
    const total = this.total();
    return total ? Math.round((valor / total) * 100) : 0;
  }

  private dibujar(segmentos: SegmentoGrafica[]): void {
    const arcos = this.generarPastel(segmentos);
    const generarArco = this.generarArco;
    const actual = this.actual;
    // Ancho cero sobre un ángulo: punto de partida de lo que entra y destino de lo que sale.
    const cerrado = (arco: Arco, angulo: number): Arco => ({ ...arco, startAngle: angulo, endAngle: angulo });

    const ruleta = select(this.ruleta().nativeElement);
    if (!this.primeraVez && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ruleta
        .interrupt('giro')
        .transition('giro')
        .duration(DURACION_GIRO)
        .ease(easeCubicOut)
        .attrTween('transform', () => (t) => `rotate(${t * 360})`);
    }
    this.primeraVez = false;

    ruleta
      .selectAll<SVGPathElement, Arco>('path')
      .data(arcos, (arco) => arco.data.clave)
      .join(
        (entrada) =>
          entrada
            .append('path')
            .style('stroke', '#000')
            .style('stroke-width', 3)
            .style('stroke-linejoin', 'round')
            .each(function (arco) {
              actual.set(this, cerrado(arco, arco.startAngle));
            }),
        (actualizacion) => actualizacion,
        (salida) =>
          salida
            .transition()
            .duration(DURACION)
            .attrTween('d', function () {
              const desde = actual.get(this)!;
              const i = interpolate(desde, cerrado(desde, desde.startAngle));
              return (t) => generarArco(i(t)) ?? '';
            })
            .remove(),
      )
      .style('fill', (arco) => arco.data.color)
      .transition()
      .duration(DURACION)
      .attrTween('d', function (arco) {
        const i = interpolate(actual.get(this)!, arco);
        return (t) => {
          const intermedio = i(t);
          actual.set(this, intermedio);
          return generarArco(intermedio) ?? '';
        };
      });
  }
}
