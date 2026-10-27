import { Component, computed, inject, input } from '@angular/core';
import { IonButton, IonIcon, IonItem, IonLabel, IonList, IonNote } from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { MetadatosDocumento } from '../../../core/models';
import { formatearFecha } from '../../../core/util/fechas.util';

/** Orden en que se muestran los grupos; lo que no esté aquí va al final. */
const ORDEN_GRUPOS = ['rastreo', 'camara', 'captura', 'imagen', 'ubicacion', 'escaneo', 'pdf', 'archivo'];

interface FilaMetadato {
  etiqueta: string;
  valor: string;
}

interface GrupoMetadatos {
  clave: string;
  titulo: string;
  filas: FilaMetadato[];
}

/**
 * Tabla con los metadatos (EXIF) de una foto o la info de un PDF: cámara, fecha de captura,
 * exposición, resolución y, si la foto la trae, la ubicación GPS con liga al mapa.
 */
@Component({
  selector: 'app-metadatos-documento',
  template: `
    @if (grupos().length === 0) {
      <ion-note class="ion-padding-horizontal sin-datos">{{ 'meta_sin_datos' | t }}</ion-note>
    }
    @for (grupo of grupos(); track grupo.clave) {
      <div class="titulo-seccion">{{ grupo.titulo }}</div>
      <ion-list [inset]="true" lines="full">
        @for (fila of grupo.filas; track fila.etiqueta) {
          <ion-item>
            <ion-label class="ion-text-wrap">
              <p>{{ fila.etiqueta }}</p>
              <h3 class="valor">{{ fila.valor }}</h3>
            </ion-label>
          </ion-item>
        }
        @if (grupo.clave === 'ubicacion' && mapa(); as url) {
          <ion-item>
            <ion-button fill="clear" [href]="url" target="_blank" rel="noopener">
              <ion-icon slot="start" name="map-outline" aria-hidden="true"></ion-icon>
              {{ 'meta_ver_mapa' | t }}
            </ion-button>
          </ion-item>
        }
      </ion-list>
    }
    @if (tieneUbicacion()) {
      <ion-note class="ion-padding-horizontal aviso" color="warning">{{ 'meta_aviso_ubicacion' | t }}</ion-note>
    }
  `,
  styles: `
    .valor {
      font-variant-numeric: tabular-nums;
      word-break: break-word;
    }
    .aviso,
    .sin-datos {
      display: block;
      margin: 0.5rem 0 1rem;
    }
  `,
  imports: [IonList, IonItem, IonLabel, IonNote, IonButton, IonIcon, TPipe],
})
export class MetadatosDocumentoComponent {
  readonly metadatos = input<MetadatosDocumento | null>(null);
  private readonly i18n = inject(I18nService);

  readonly grupos = computed<GrupoMetadatos[]>(() => {
    const datos = this.metadatos() ?? {};
    const claves = Object.keys(datos).sort((a, b) => this.posicion(a) - this.posicion(b));
    return claves
      .map((clave) => ({
        clave,
        titulo: this.etiqueta(`meta_grupo_${clave}`, clave),
        filas: Object.entries(datos[clave] ?? {}).map(([campo, valor]) => ({
          etiqueta: this.etiqueta(`meta_${campo}`, campo),
          valor: this.formatear(campo, valor),
        })),
      }))
      .filter((grupo) => grupo.filas.length > 0);
  });

  readonly tieneUbicacion = computed(() => !!this.metadatos()?.['ubicacion']);

  readonly mapa = computed(() => {
    const ubicacion = this.metadatos()?.['ubicacion'];
    const lat = Number(ubicacion?.['latitud']);
    const lng = Number(ubicacion?.['longitud']);
    return Number.isFinite(lat) && Number.isFinite(lng) && ubicacion ? `https://www.google.com/maps?q=${lat},${lng}` : null;
  });

  private posicion(grupo: string): number {
    const i = ORDEN_GRUPOS.indexOf(grupo);
    return i === -1 ? ORDEN_GRUPOS.length : i;
  }

  private etiqueta(clave: string, respaldo: string): string {
    return this.i18n.existe(clave) ? this.i18n.t(clave) : respaldo;
  }

  private formatear(campo: string, valor: string | number | boolean): string {
    if (typeof valor === 'boolean') {
      return this.i18n.t(valor ? 'si' : 'no');
    }
    const numero = typeof valor === 'number' ? valor : Number.NaN;
    switch (campo) {
      case 'bytes':
        return numero >= 1024 * 1024 ? `${(numero / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(numero / 1024))} KB`;
      case 'exposicion':
        return numero > 0 && numero < 1 ? `1/${Math.round(1 / numero)} s` : `${valor} s`;
      case 'apertura':
        return `ƒ/${valor}`;
      case 'distanciaFocal':
        return `${valor} mm`;
      case 'altitud':
        return `${Math.round(Number(valor))} m`;
      case 'ancho':
      case 'alto':
        return `${valor} px`;
      case 'latitud':
      case 'longitud':
        return Number.isFinite(numero) ? numero.toFixed(6) : String(valor);
    }
    if (typeof valor === 'string' && /fecha/i.test(campo)) {
      // EXIF escribe "2026:10:07 09:30:00" (hora local de la cámara, sin zona).
      const iso = valor.replace(/^(\d{4}):(\d{2}):(\d{2}) /, '$1-$2-$3T');
      if (!Number.isNaN(Date.parse(iso))) {
        return formatearFecha(iso, 'fechaHora', this.i18n.locale());
      }
    }
    return String(valor);
  }
}
