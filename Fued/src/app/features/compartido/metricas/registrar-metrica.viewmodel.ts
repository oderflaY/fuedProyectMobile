import { Injectable, computed, signal } from '@angular/core';
import type { NuevaMetrica } from '../../../core/models';

/** Signos vitales que el formulario captura como número suelto. */
export type CampoNumerico = 'pesoKg' | 'alturaCm' | 'frecuenciaCardiaca' | 'glucosaMgDl' | 'temperaturaC';

/**
 * Estado del formulario de signos vitales: guarda todo como texto,
 * y sólo al final lo convierte al `NuevaMetrica` que espera la API.
 */
@Injectable()
export class RegistrarMetricaViewModel {
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

  /** La presión va completa o no va: media lectura no significa nada. */
  readonly presionIncompleta = computed(() => (this.sistolica() === '') !== (this.diastolica() === ''));

  /** Sólo viajan los campos que se llenaron y que son números válidos. */
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

  /** Unas notas sin ninguna medición no son una toma. */
  readonly puedeGuardar = computed(
    () => !this.presionIncompleta() && Object.keys(this.metrica()).some((clave) => clave !== 'notas'),
  );

  actualizar(campo: CampoNumerico, valor: string | null | undefined): void {
    this.numeros.update((n) => ({ ...n, [campo]: valor ?? '' }));
  }
}
