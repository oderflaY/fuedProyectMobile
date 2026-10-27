import { Component, computed, input } from '@angular/core';

/** Una fila de la gráfica horizontal; `detalle` es texto secundario opcional (p. ej. la especialidad). */
export interface FilaBarra {
  clave: string;
  etiqueta: string;
  valor: number;
  detalle?: string;
}

/**
 * Ranking en barras horizontales: una sola serie, así que no lleva leyenda.
 * Es HTML (no SVG) para que las etiquetas largas se acomoden solas en el ancho del teléfono.
 */
@Component({
  selector: 'app-grafica-barras-h',
  template: `
    <ol class="ranking" [attr.aria-label]="titulo()">
      @for (fila of filas(); track fila.clave) {
        <li>
          <span class="nombre">
            {{ fila.etiqueta }}
            @if (fila.detalle) {
              <small>{{ fila.detalle }}</small>
            }
          </span>
          <span class="pista" aria-hidden="true">
            <span class="barra" [style.width.%]="fila.porcentaje" [style.background]="color()"></span>
          </span>
          <b>{{ fila.texto }}</b>
        </li>
      }
    </ol>
  `,
  styleUrl: 'graficas.scss',
})
export class GraficaBarrasHComponent {
  readonly datos = input.required<FilaBarra[]>();
  readonly titulo = input('');
  readonly color = input('var(--ion-color-primary)');

  readonly filas = computed(() => {
    const maximo = Math.max(1, ...this.datos().map((d) => d.valor));
    return this.datos().map((d) => ({
      ...d,
      porcentaje: (d.valor / maximo) * 100,
      texto: d.valor.toLocaleString('es-MX'),
    }));
  });
}
