import { Component, inject } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonNote,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { RegistrarMetricaViewModel } from './registrar-metrica.viewmodel';

/** Vista del formulario de signos vitales. Devuelve un `NuevaMetrica` con `role = 'guardar'`. */
@Component({
  selector: 'app-registrar-metrica',
  templateUrl: 'registrar-metrica.modal.html',
  providers: [RegistrarMetricaViewModel],
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonTextarea, IonNote, TPipe],
})
export class RegistrarMetricaModal {
  readonly vm = inject(RegistrarMetricaViewModel);
  private readonly modal = inject(ModalController);

  cancelar(): Promise<boolean> {
    return this.modal.dismiss(null, 'cancelar');
  }

  guardar(): Promise<boolean> {
    return this.modal.dismiss(this.vm.metrica(), 'guardar');
  }
}
