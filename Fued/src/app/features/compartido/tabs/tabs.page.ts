import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';

export interface PestanaConfig {
  tab: string;
  icono: string;
  etiqueta: string;
}

/** Barra de pestañas nativa; cada rol la configura con `data.pestanas` en sus rutas. */
@Component({
  selector: 'app-tabs',
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" [class.compacta]="pestanas.length > 5">
        @for (pestana of pestanas; track pestana.tab) {
          <ion-tab-button [tab]="pestana.tab" [attr.aria-label]="pestana.etiqueta | t">
            <ion-icon aria-hidden="true" [name]="pestana.icono"></ion-icon>
            <ion-label>{{ pestana.etiqueta | t }}</ion-label>
          </ion-tab-button>
        }
      </ion-tab-bar>
    </ion-tabs>
  `,
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel, TPipe],
})
export class TabsPage {
  readonly pestanas = (inject(ActivatedRoute).snapshot.data['pestanas'] ?? []) as PestanaConfig[];
}
