import { Injectable, computed, inject, signal } from '@angular/core';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { NuevoTratamiento } from '../../../core/models';
import { fechaLocalIso, horariosPorFrecuencia } from '../../../core/util/fechas.util';

/** Frecuencias que ofrece el selector, en horas. */
export const FRECUENCIAS_HORAS = [4, 6, 8, 12, 24, 48, 72];

/** Vías de administración; el texto visible sale de `via_<clave>` en strings.xml. */
export const VIAS_ADMINISTRACION = ['oral', 'sublingual', 'topica', 'inhalada', 'inyectable', 'oftalmica'];

/**
 * Estado del alta de un tratamiento: valida los horarios que teclea el usuario
 * y arma el `NuevoTratamiento` que espera la API.
 */
@Injectable()
export class TratamientoFormViewModel {
  private readonly i18n = inject(I18nService);

  readonly frecuencias = FRECUENCIAS_HORAS;
  readonly vias = VIAS_ADMINISTRACION;

  readonly medicamento = signal('');
  readonly dosis = signal('');
  readonly frecuenciaHoras = signal(12);
  /** Se teclean separados por coma; la frecuencia propone un juego inicial. */
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
  /** Todos deben ser horas `HH:mm` de 24 horas, y tiene que haber al menos una. */
  readonly horariosValidos = computed(
    () => this.listaHorarios().length > 0 && this.listaHorarios().every((h) => /^([01]\d|2[0-3]):[0-5]\d$/.test(h)),
  );
  readonly puedeGuardar = computed(
    () => this.medicamento().trim() !== '' && this.dosis().trim() !== '' && this.horariosValidos(),
  );

  /** Cambiar la frecuencia reescribe los horarios: los anteriores ya no cuadran. */
  cambiarFrecuencia(valor: unknown): void {
    const horas = Number(valor);
    this.frecuenciaHoras.set(horas);
    this.horarios.set(horariosPorFrecuencia(horas).join(', '));
  }

  /** La vía viaja ya traducida porque la API la guarda como texto libre. */
  armar(): NuevoTratamiento {
    return {
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
  }
}
