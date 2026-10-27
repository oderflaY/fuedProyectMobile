import { Component, Input, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonInput,
  IonItem,
  IonList,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { OPCIONES_ACTIVIDAD, OPCIONES_ALCOHOL, OPCIONES_TABAQUISMO, SEGUROS_MEDICOS } from '../../../core/models';
import type { DatosComplementarios } from '../../../core/models';

const VACIOS: DatosComplementarios = {
  seguroMedico: null,
  numeroPoliza: null,
  medicoCabecera: null,
  tabaquismo: null,
  alcohol: null,
  actividadFisica: null,
  discapacidad: null,
  notasMedicas: null,
};

/** Configuración general del expediente: seguro, médico de cabecera y estilo de vida. */
@Component({
  selector: 'app-datos-complementarios',
  templateUrl: 'datos-complementarios.modal.html',
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonTextarea,
    TPipe,
  ],
})
export class DatosComplementariosModal implements OnInit {
  @Input() datos: DatosComplementarios | null = null;

  private readonly modal = inject(ModalController);

  readonly seguros = SEGUROS_MEDICOS;
  readonly tabaquismo = OPCIONES_TABAQUISMO;
  readonly alcohol = OPCIONES_ALCOHOL;
  readonly actividad = OPCIONES_ACTIVIDAD;
  readonly valores = signal<DatosComplementarios>(VACIOS);

  ngOnInit(): void {
    this.valores.set({ ...VACIOS, ...this.datos });
  }

  cambiar<K extends keyof DatosComplementarios>(campo: K, valor: DatosComplementarios[K] | string | null | undefined): void {
    const limpio = typeof valor === 'string' ? valor.trim() || null : (valor ?? null);
    this.valores.update((actuales) => ({ ...actuales, [campo]: limpio }));
  }

  cancelar(): Promise<boolean> {
    return this.modal.dismiss(null, 'cancelar');
  }

  guardar(): Promise<boolean> {
    return this.modal.dismiss(this.valores(), 'guardar');
  }
}
