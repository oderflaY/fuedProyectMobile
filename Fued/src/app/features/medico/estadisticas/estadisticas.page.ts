import { DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonLabel,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import type { RefresherCustomEvent, ViewWillEnter } from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { GraficaBarrasHComponent } from '../../compartido/graficas/grafica-barras-h.component';
import { GraficaBarrasComponent } from '../../compartido/graficas/grafica-barras.component';
import { GraficaLineasComponent } from '../../compartido/graficas/grafica-lineas.component';
import { GraficaPastelComponent } from '../../compartido/graficas/grafica-pastel.component';
import { EstadisticasViewModel } from './estadisticas.viewmodel';
import type { RangoMeses } from './estadisticas.viewmodel';

/** Tablero con las estadísticas de todo el sistema, servidas por GraphQL. */
@Component({
  selector: 'app-estadisticas',
  templateUrl: 'estadisticas.page.html',
  styleUrls: ['estadisticas.page.scss'],
  providers: [EstadisticasViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonIcon,
    IonButton,
    IonSpinner,
    DecimalPipe,
    GraficaBarrasComponent,
    GraficaBarrasHComponent,
    GraficaLineasComponent,
    GraficaPastelComponent,
    TPipe,
  ],
})
export class EstadisticasPage implements ViewWillEnter {
  readonly vm = inject(EstadisticasViewModel);
  readonly rangos: RangoMeses[] = [6, 12, 18];

  ionViewWillEnter(): void {
    void this.vm.cargar();
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  cambiarMeses(valor: string | number | undefined): void {
    void this.vm.cambiarMeses(Number(valor ?? 12) as RangoMeses);
  }
}
