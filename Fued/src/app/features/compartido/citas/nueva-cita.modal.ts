import { Component, Input, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonDatetime,
  IonHeader,
  IonItem,
  IonList,
  IonNote,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { FechaPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { NuevaCitaViewModel } from './nueva-cita.viewmodel';

/**
 * Agenda una cita. El paciente elige médico (queda pendiente);
 * el médico elige a uno de sus pacientes (queda confirmada).
 * Se cierra con `role = 'creada'` y la cita como `data`.
 */
@Component({
  selector: 'app-nueva-cita',
  templateUrl: 'nueva-cita.modal.html',
  providers: [NuevaCitaViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonDatetime,
    IonTextarea,
    IonNote,
    IonSpinner,
    TPipe,
    FechaPipe,
  ],
})
export class NuevaCitaModal implements OnInit {
  /** Médico o paciente con el que se abre preseleccionado. */
  @Input() preseleccion?: string;

  readonly vm = inject(NuevaCitaViewModel);
  readonly locale = inject(I18nService).locale();
  private readonly modal = inject(ModalController);

  ngOnInit(): void {
    void this.vm.iniciar(this.preseleccion);
  }

  cambiarFecha(valor: string | string[] | null | undefined): void {
    if (typeof valor === 'string') {
      void this.vm.cambiarFecha(valor);
    }
  }

  cancelar(): void {
    void this.modal.dismiss(null, 'cancelar');
  }

  async guardar(): Promise<void> {
    const cita = await this.vm.guardar();
    if (cita) {
      await this.modal.dismiss(cita, 'creada');
    }
  }
}
