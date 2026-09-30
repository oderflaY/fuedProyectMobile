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
  IonProgressBar,
  IonRefresher,
  IonRefresherContent,
  IonSkeletonText,
  IonSpinner,
  IonText,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import type { RefresherCustomEvent } from '@ionic/angular';
import { FechaPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { NuevaMetrica, TomaDelDia } from '../../../core/models';
import { COLOR_ESTADO_TOMA } from '../../../core/ui/colores.constants';
import { CitaItemComponent } from '../../compartido/citas/cita-item.component';
import { NuevaCitaModal } from '../../compartido/citas/nueva-cita.modal';
import { RegistrarMetricaModal } from '../../compartido/metricas/registrar-metrica.modal';
import { InicioViewModel, claveToma } from './inicio.viewmodel';

@Component({
  selector: 'app-inicio',
  templateUrl: 'inicio.page.html',
  styleUrls: ['inicio.page.scss'],
  providers: [InicioViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonText,
    IonProgressBar,
    IonSkeletonText,
    IonSpinner,
    CitaItemComponent,
    TPipe,
    FechaPipe,
  ],
})
export class InicioPage implements OnInit {
  readonly vm = inject(InicioViewModel);
  private readonly i18n = inject(I18nService);
  private readonly hojas = inject(ActionSheetController);
  private readonly alertas = inject(AlertController);
  private readonly modales = inject(ModalController);
  private readonly router = inject(Router);

  readonly colorEstado = COLOR_ESTADO_TOMA;
  readonly claveToma = claveToma;

  ngOnInit(): void {
    void this.vm.cargar();
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  async opcionesToma(toma: TomaDelDia): Promise<void> {
    const t = (clave: string) => this.i18n.t(clave);
    const hoja = await this.hojas.create({
      header: `${toma.medicamento} ${toma.dosis}`,
      subHeader: toma.horario,
      buttons: [
        { text: t('inicio_marcar_tomado'), icon: 'checkmark-circle-outline', handler: () => void this.vm.marcarToma(toma, 'tomado') },
        { text: t('inicio_marcar_omitido'), icon: 'close-circle-outline', handler: () => void this.vm.marcarToma(toma, 'omitido') },
        { text: t('inicio_registrar_sintomas'), icon: 'pulse-outline', handler: () => void this.pedirSintomas(toma) },
        { text: t('cancelar'), role: 'cancel' },
      ],
    });
    await hoja.present();
  }

  private async pedirSintomas(toma: TomaDelDia): Promise<void> {
    const alerta = await this.alertas.create({
      header: this.i18n.t('inicio_sintomas_titulo'),
      message: this.i18n.t('inicio_sintomas_mensaje'),
      inputs: [{ name: 'sintomas', type: 'textarea', value: toma.registro?.sintomasAsociados ?? '', attributes: { maxlength: 500 } }],
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        {
          text: this.i18n.t('guardar'),
          handler: (datos: { sintomas: string }) => {
            const estado = toma.registro?.estado === 'omitido' ? 'omitido' : 'tomado';
            void this.vm.marcarToma(toma, estado, datos.sintomas.trim() || null);
          },
        },
      ],
    });
    await alerta.present();
  }

  async registrarMetrica(): Promise<void> {
    const modal = await this.modales.create({ component: RegistrarMetricaModal });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<NuevaMetrica>();
    if (role === 'guardar' && data) {
      await this.vm.registrarMetrica(data);
    }
  }

  async agendarCita(): Promise<void> {
    const modal = await this.modales.create({ component: NuevaCitaModal });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'creada') {
      await this.vm.cargar();
    }
  }

  escribirAlMedico(idMedico: string): void {
    void this.router.navigate(['/paciente/chat', idMedico]);
  }

  verCitas(): void {
    void this.router.navigateByUrl('/paciente/citas');
  }
}
