import { Component, computed, inject, signal } from '@angular/core';
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
import { TPipe } from '../../../core/i18n/pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { NuevoTratamiento } from '../../../core/models';
import { fechaLocalIso, horariosPorFrecuencia } from '../../../core/util/fechas';

export const FRECUENCIAS_HORAS = [4, 6, 8, 12, 24, 48, 72];
export const VIAS_ADMINISTRACION = ['oral', 'sublingual', 'topica', 'inhalada', 'inyectable', 'oftalmica'];

/** Alta de un tratamiento. Devuelve `NuevoTratamiento` con `role = 'guardar'`. */
@Component({
  selector: 'app-tratamiento-form',
  templateUrl: 'tratamiento-form.modal.html',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonSelect, IonSelectOption, IonNote, TPipe],
})
export class TratamientoFormModal {
  private readonly modal = inject(ModalController);
  private readonly i18n = inject(I18nService);

  readonly frecuencias = FRECUENCIAS_HORAS;
  readonly vias = VIAS_ADMINISTRACION;

  readonly medicamento = signal('');
  readonly dosis = signal('');
  readonly frecuenciaHoras = signal(12);
  readonly horarios = signal(horariosPorFrecuencia(12).join(', '));
  readonly via = signal('oral');
  readonly fechaInicio = signal(fechaLocalIso());
  readonly fechaFin = signal('');
  readonly cantidad = signal('');
  readonly umbral = signal('5');

  readonly listaHorarios = computed(() =>
    this.horarios()
      .split(/[,\s]+/)
      .map((h) => h.trim())
      .filter(Boolean),
  );
  readonly horariosValidos = computed(
    () => this.listaHorarios().length > 0 && this.listaHorarios().every((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)),
  );
  readonly puedeGuardar = computed(
    () => this.medicamento().trim() !== '' && this.dosis().trim() !== '' && this.horariosValidos(),
  );

  cambiarFrecuencia(valor: unknown): void {
    const horas = Number(valor);
    this.frecuenciaHoras.set(horas);
    this.horarios.set(horariosPorFrecuencia(horas).join(', '));
  }

  cancelar(): void {
    void this.modal.dismiss(null, 'cancelar');
  }

  guardar(): void {
    const tratamiento: NuevoTratamiento = {
      medicamento: this.medicamento().trim(),
      dosis: this.dosis().trim(),
      frecuenciaHoras: this.frecuenciaHoras(),
      horariosSugeridos: this.listaHorarios(),
      viaAdministracion: this.i18n.t(`via_${this.via()}`),
      fechaInicio: this.fechaInicio() || undefined,
      fechaFin: this.fechaFin() || null,
      inventario: {
        cantidadRestante: Number.parseInt(this.cantidad(), 10) || 0,
        umbralAlerta: Number.parseInt(this.umbral(), 10) || 0,
      },
    };
    void this.modal.dismiss(tratamiento, 'guardar');
  }
}
