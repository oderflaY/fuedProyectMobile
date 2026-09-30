import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonBadge,
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
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import type { RefresherCustomEvent, ViewWillEnter } from '@ionic/angular';
import { FechaPipe, InicialesPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import type { Conversacion } from '../../../core/models';
import { ConversacionesViewModel } from './conversaciones.viewmodel';

/** Vista de la bandeja de chats: lista las conversaciones y abre la elegida. */
@Component({
  selector: 'app-conversaciones',
  templateUrl: 'conversaciones.page.html',
  providers: [ConversacionesViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonNote,
    IonBadge,
    IonIcon,
    IonButton,
    IonSpinner,
    TPipe,
    FechaPipe,
    InicialesPipe,
  ],
})
export class ConversacionesPage implements ViewWillEnter {
  readonly vm = inject(ConversacionesViewModel);
  private readonly router = inject(Router);

  ionViewWillEnter(): void {
    void this.vm.cargar();
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  abrir(conversacion: Conversacion): void {
    void this.router.navigate([this.vm.rutaBase(), conversacion.idContraparte]);
  }
}
