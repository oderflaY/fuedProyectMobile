import { Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import {
  AlertController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import type { Audiencia, SeccionPrivacidad } from '../../../core/models';
import { PrivacidadRepository } from '../../../core/repositories/privacidad.repository';
import { SessionService } from '../../../core/auth/session.service';
import { AvisosService } from '../../../core/ui/avisos.service';
import { PrivacidadViewModel } from './privacidad.viewmodel';

@Component({
  selector: 'app-privacidad',
  templateUrl: 'privacidad.page.html',
  providers: [PrivacidadViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonNote,
    IonToggle,
    IonSpinner,
    TPipe,
  ],
})
export class PrivacidadPage implements OnInit {
  readonly vm = inject(PrivacidadViewModel);
  private readonly i18n = inject(I18nService);
  private readonly alertas = inject(AlertController);
  private readonly repo = inject(PrivacidadRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  ngOnInit(): void {
    void this.vm.cargar();
  }

  cambiarAudiencia(valor: string | number | undefined): void {
    this.vm.cambiarAudiencia((valor ?? 'medico') as Audiencia);
  }

  alternar(seccion: SeccionPrivacidad, visible: boolean): void {
    void this.vm.alternar(seccion, visible);
  }

  /** Muestra qué contiene la copia antes de que el paciente la comparta. */
  async previsualizarExportacion(): Promise<void> {
    try {
      const { expediente } = await this.repo.exportar(this.sesion.usuario()?.id ?? '');
      const omitidas = expediente.privacidad.seccionesOmitidas;
      const alerta = await this.alertas.create({
        header: this.i18n.t('privacidad_exportacion_titulo'),
        message:
          omitidas.length === 0
            ? this.i18n.t('privacidad_exportacion_completa')
            : this.i18n.t('privacidad_exportacion_omitidas', { sesiones: omitidas.length }),
        buttons: [this.i18n.t('aceptar')],
      });
      await alerta.present();
    } catch (error) {
      await this.avisos.error(error);
    }
  }
}
