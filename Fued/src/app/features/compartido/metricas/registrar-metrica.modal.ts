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
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { TPipe } from '../../../core/i18n/pipes';
import type { NuevaMetrica } from '../../../core/models';

type CampoNumerico = 'pesoKg' | 'alturaCm' | 'frecuenciaCardiaca' | 'glucosaMgDl' | 'temperaturaC';

/** Formulario de signos vitales. Devuelve un `NuevaMetrica` con `role = 'guardar'`. */
@Component({
  selector: 'app-registrar-metrica',
  templateUrl: 'registrar-metrica.modal.html',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonList, IonItem, IonInput, IonTextarea, IonNote, TPipe],
})
export class RegistrarMetricaModal {
  private readonly modal = inject(ModalController);

  readonly sistolica = signal('');
  readonly diastolica = signal('');
  readonly numeros = signal<Record<CampoNumerico, string>>({
    pesoKg: '',
    alturaCm: '',
    frecuenciaCardiaca: '',
    glucosaMgDl: '',
    temperaturaC: '',
  });
  readonly notas = signal('');

  readonly presionIncompleta = computed(() => (this.sistolica() === '') !== (this.diastolica() === ''));
  readonly metrica = computed<NuevaMetrica>(() => {
    const resultado: NuevaMetrica = {};
    for (const [campo, valor] of Object.entries(this.numeros()) as [CampoNumerico, string][]) {
      const numero = Number.parseFloat(valor.replace(',', '.'));
      if (valor.trim() !== '' && Number.isFinite(numero)) {
        resultado[campo] = numero;
      }
    }
    if (this.sistolica() !== '' && this.diastolica() !== '') {
      resultado.presionArterial = `${this.sistolica()}/${this.diastolica()}`;
    }
    if (this.notas().trim() !== '') {
      resultado.notas = this.notas().trim();
    }
    return resultado;
  });
  readonly puedeGuardar = computed(
    () => !this.presionIncompleta() && Object.keys(this.metrica()).some((clave) => clave !== 'notas'),
  );

  actualizar(campo: CampoNumerico, valor: string | null | undefined): void {
    this.numeros.update((n) => ({ ...n, [campo]: valor ?? '' }));
  }

  cancelar(): Promise<boolean> {
    return this.modal.dismiss(null, 'cancelar');
  }

  guardar(): Promise<boolean> {
    return this.modal.dismiss(this.metrica(), 'guardar');
  }
}
