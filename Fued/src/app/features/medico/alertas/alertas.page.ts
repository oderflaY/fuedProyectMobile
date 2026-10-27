import { Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import type { RefresherCustomEvent } from '@ionic/angular';
import type { ParametrosTexto } from '../../../core/i18n/i18n.service';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FechaPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import type { Alerta } from '../../../core/models';
import { COLOR_ESTADO_ALERTA, COLOR_SEVERIDAD } from '../../../core/ui/colores.constants';
import { GraficaPastelComponent } from '../../compartido/graficas/grafica-pastel.component';
import { AlertasViewModel } from './alertas.viewmodel';
import type { FiltroAlertas, VistaGraficaAlertas } from './alertas.viewmodel';

@Component({
  selector: 'app-alertas',
  templateUrl: 'alertas.page.html',
  styleUrls: ['alertas.page.scss'],
  providers: [AlertasViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonSegment,
    IonSegmentButton,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonSpinner,
    GraficaPastelComponent,
    TPipe,
    FechaPipe,
  ],
})
export class AlertasPage implements OnInit {
  readonly vm = inject(AlertasViewModel);
  private readonly i18n = inject(I18nService);
  private readonly hojas = inject(ActionSheetController);
  private readonly alertasUi = inject(AlertController);
  private readonly router = inject(Router);

  readonly colorSeveridad = COLOR_SEVERIDAD;
  readonly colorEstado = COLOR_ESTADO_ALERTA;
  readonly filtros: FiltroAlertas[] = ['nueva', 'vista', 'atendida', 'todas'];

  ngOnInit(): void {
    void this.vm.cargar();
  }

  cambiarFiltro(valor: string | number | undefined): void {
    void this.vm.cambiarFiltro((valor ?? 'nueva') as FiltroAlertas);
  }

  cambiarVistaGrafica(valor: string | number | undefined): void {
    this.vm.vistaGrafica.set((valor ?? 'severidad') as VistaGraficaAlertas);
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  /** Los datos de la alerta traen listas y banderas; al texto sólo pasan los escalares. */
  parametros(alerta: Alerta): ParametrosTexto {
    const parametros: ParametrosTexto = {};
    for (const [clave, valor] of Object.entries(alerta.datos)) {
      if (typeof valor === 'string' || typeof valor === 'number') {
        parametros[clave] = valor;
      }
    }
    return parametros;
  }

  /** Los hallazgos vienen como códigos; se traducen aquí, no llegan como texto. */
  hallazgos(alerta: Alerta): string[] {
    const banderas = alerta.datos['banderas'];
    return Array.isArray(banderas) ? banderas.map((codigo) => this.i18n.t(`bandera_${codigo}`)) : [];
  }

  async opciones(alerta: Alerta): Promise<void> {
    const hoja = await this.hojas.create({
      header: this.i18n.t(alerta.claveTitulo),
      subHeader: alerta.nombrePaciente,
      buttons: [
        {
          text: this.i18n.t('alertas_ver_expediente'),
          icon: 'document-text-outline',
          handler: () => void this.router.navigate(['/medico/pacientes', alerta.idPaciente]),
        },
        {
          text: this.i18n.t('alertas_escribir'),
          icon: 'chatbubbles-outline',
          handler: () => void this.router.navigate(['/medico/chat', alerta.idPaciente]),
        },
        {
          text: this.i18n.t('alertas_marcar_vista'),
          icon: 'eye-outline',
          handler: () => void this.vm.marcar(alerta, 'vista'),
        },
        {
          text: this.i18n.t('alertas_marcar_atendida'),
          icon: 'checkmark-circle-outline',
          handler: () => void this.pedirNotas(alerta),
        },
        { text: this.i18n.t('cancelar'), role: 'cancel' },
      ],
    });
    await hoja.present();
  }

  private async pedirNotas(alerta: Alerta): Promise<void> {
    const dialogo = await this.alertasUi.create({
      header: this.i18n.t('alertas_notas_titulo'),
      message: this.i18n.t('alertas_notas_mensaje'),
      inputs: [{ name: 'notas', type: 'textarea', attributes: { maxlength: 500 } }],
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        {
          text: this.i18n.t('guardar'),
          handler: (datos: { notas: string }) => void this.vm.marcar(alerta, 'atendida', datos.notas.trim() || undefined),
        },
      ],
    });
    await dialogo.present();
  }
}
