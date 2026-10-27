import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import type { RefresherCustomEvent, ViewWillEnter } from '@ionic/angular';
import { InicialesPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import type { EstadoRiesgo } from '../../../core/models';
import { GraficaPastelComponent } from '../../compartido/graficas/grafica-pastel.component';
import { PacientesViewModel } from './pacientes.viewmodel';
import type { VistaGrafica } from './pacientes.viewmodel';

/** Vista del tablero de pacientes: lista, busca y abre el expediente. */
@Component({
  selector: 'app-pacientes',
  templateUrl: 'pacientes.page.html',
  styleUrls: ['pacientes.page.scss'],
  providers: [PacientesViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSearchbar,
  IonSegment,
  IonSegmentButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonNote,
    IonIcon,
    IonButton,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    GraficaPastelComponent,
    TPipe,
    InicialesPipe,
  ],
})
export class PacientesPage implements ViewWillEnter {
  readonly vm = inject(PacientesViewModel);
  private readonly router = inject(Router);
  readonly niveles: EstadoRiesgo[] = ['alto', 'medio', 'bajo'];

  ionViewWillEnter(): void {
    void this.vm.cargar();
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  cambiarVista(valor: string | number | undefined): void {
    this.vm.vistaGrafica.set((valor ?? 'riesgo') as VistaGrafica);
  }

  abrir(idPaciente: string): void {
    void this.router.navigate(['/medico/pacientes', idPaciente]);
  }
}
