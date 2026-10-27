import { Component, inject, signal } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { CargaService } from './core/ui/carga.service';
import { SonidosService } from './core/ui/sonidos.service';
import { PantallaCargaComponent } from './features/compartido/carga/pantalla-carga.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [IonApp, IonRouterOutlet, PantallaCargaComponent],
  host: { '(document:click)': 'tocarTimbre($event)' },
})
export class AppComponent {
  readonly carga = inject(CargaService);
  /** Sigue montada mientras se desvanece, aunque la carga ya haya terminado. */
  readonly pantallaCarga = signal(true);
  private readonly sonidos = inject(SonidosService);

  /** Los botones principales (rellenos) suenan como el timbre del micro. */
  tocarTimbre(evento: Event): void {
    const boton = (evento.target as Element | null)?.closest('ion-button, ion-fab-button');
    const fill = boton?.getAttribute('fill');
    const enBarra = !!boton?.closest('ion-buttons') && fill !== 'solid';
    if (boton && !enBarra && !boton.hasAttribute('disabled') && fill !== 'clear' && fill !== 'outline') {
      this.sonidos.timbre();
    }
  }
}
