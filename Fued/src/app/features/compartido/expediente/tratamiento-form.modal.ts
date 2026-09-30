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
  IonSelect,
  IonSelectOption,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { TratamientoFormViewModel } from './tratamiento-form.viewmodel';

/** Vista del alta de un tratamiento. Devuelve `NuevoTratamiento` con `role = 'guardar'`. */
@Component({
  selector: 'app-tratamiento-form',
  templateUrl: 'tratamiento-form.modal.html',
  providers: [TratamientoFormViewModel],
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonSelect, IonSelectOption, IonNote, TPipe],
})
export class TratamientoFormModal {
  readonly vm = inject(TratamientoFormViewModel);
  private readonly modal = inject(ModalController);

  cancelar(): void {
    void this.modal.dismiss(null, 'cancelar');
  }

  guardar(): void {
    void this.modal.dismiss(this.vm.armar(), 'guardar');
  }
}
