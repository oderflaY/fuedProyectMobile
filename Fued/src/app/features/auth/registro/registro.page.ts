import { Component, inject } from '@angular/core';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonInputPasswordToggle,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { RegistroViewModel } from './registro.viewmodel';

@Component({
  selector: 'app-registro',
  templateUrl: 'registro.page.html',
  providers: [RegistroViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonList,
    IonItem,
    IonInput,
    IonInputPasswordToggle,
    IonNote,
    IonButton,
    IonSpinner,
    TPipe,
  ],
})
export class RegistroPage {
  readonly vm = inject(RegistroViewModel);

  cambiarRol(valor: unknown): void {
    this.vm.rol.set(valor === 'medico' ? 'medico' : 'paciente');
  }
}
