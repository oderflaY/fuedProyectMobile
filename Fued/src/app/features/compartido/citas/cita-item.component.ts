import { Component, computed, input } from '@angular/core';
import { IonBadge, IonIcon, IonItem, IonLabel } from '@ionic/angular';
import { FechaPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import type { Cita, Rol } from '../../../core/models';
import { COLOR_ESTADO_CITA } from '../../../core/ui/colores.constants';

/** Fila de una cita; muestra al médico o al paciente según quién la mira. */
@Component({
  selector: 'app-cita-item',
  template: `
    <ion-item [button]="true" [detail]="false">
      <div slot="start" class="fecha">
        <span class="dia">{{ cita().fechaHora | fecha: 'diaSemana' }}</span>
        <span class="hora">{{ cita().fechaHora | fecha: 'hora' }}</span>
      </div>
      <ion-label>
        <h3>{{ contraparte() }}</h3>
        @if (rol() === 'paciente' && cita().especialidad) {
          <p>{{ cita().especialidad }}</p>
        }
        <p>{{ cita().motivo }}</p>
        @if (cita().notasMedico) {
          <p><ion-icon name="document-text-outline" aria-hidden="true"></ion-icon> {{ cita().notasMedico }}</p>
        }
      </ion-label>
      <ion-badge slot="end" [color]="color()">{{ 'cita_estado_' + cita().estado | t }}</ion-badge>
    </ion-item>
  `,
  styles: `
    .fecha {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 3.5rem;
      margin-inline-end: 0.75rem;
    }
    .dia {
      font-size: 0.75rem;
      text-transform: capitalize;
      color: var(--app-texto-secundario);
    }
    .hora {
      font-weight: 600;
    }
  `,
  imports: [IonItem, IonLabel, IonBadge, IonIcon, TPipe, FechaPipe],
})
export class CitaItemComponent {
  readonly cita = input.required<Cita>();
  readonly rol = input.required<Rol>();

  readonly contraparte = computed(() => (this.rol() === 'paciente' ? this.cita().nombreMedico : this.cita().nombrePaciente));
  readonly color = computed(() => COLOR_ESTADO_CITA[this.cita().estado]);
}
