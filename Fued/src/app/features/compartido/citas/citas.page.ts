import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBadge,
  IonButton,
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonLabel,
  IonList,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import type { ActionSheetButton, RefresherCustomEvent, ViewWillEnter } from '@ionic/angular';
import { TPipe } from '../../../core/i18n/pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { Cita } from '../../../core/models';
import { formatearFecha } from '../../../core/util/fechas';
import { CitaItemComponent } from './cita-item.component';
import type { FiltroCitas } from './citas.viewmodel';
import { CitasViewModel } from './citas.viewmodel';
import { NuevaCitaModal } from './nueva-cita.modal';

@Component({
  selector: 'app-citas',
  templateUrl: 'citas.page.html',
  providers: [CitasViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonBadge,
    IonList,
    IonRefresher,
    IonRefresherContent,
    IonFab,
    IonFabButton,
    IonIcon,
    IonButton,
    IonSpinner,
    CitaItemComponent,
    TPipe,
  ],
})
export class CitasPage implements ViewWillEnter {
  readonly vm = inject(CitasViewModel);
  private readonly i18n = inject(I18nService);
  private readonly hojas = inject(ActionSheetController);
  private readonly alertas = inject(AlertController);
  private readonly modales = inject(ModalController);
  private readonly router = inject(Router);

  ionViewWillEnter(): void {
    void this.vm.cargar();
  }

  cambiarFiltro(valor: unknown): void {
    this.vm.filtro.set(valor as FiltroCitas);
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  async nuevaCita(): Promise<void> {
    const modal = await this.modales.create({ component: NuevaCitaModal });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'creada') {
      await this.vm.cargar();
    }
  }

  async opciones(cita: Cita): Promise<void> {
    const t = (clave: string) => this.i18n.t(clave);
    const esMedico = this.vm.rol() === 'medico';
    const activa = cita.estado === 'pendiente' || cita.estado === 'confirmada';
    const botones: ActionSheetButton[] = [];

    if (esMedico && cita.estado === 'pendiente') {
      botones.push({ text: t('cita_accion_confirmar'), icon: 'checkmark-circle-outline', handler: () => void this.vm.cambiarEstado(cita, 'confirmada') });
    }
    if (esMedico && cita.estado === 'confirmada') {
      botones.push({ text: t('cita_accion_completar'), icon: 'document-text-outline', handler: () => void this.completar(cita) });
    }
    if (esMedico) {
      botones.push({
        text: t('cita_accion_expediente'),
        icon: 'medkit-outline',
        handler: () => void this.router.navigate(['/medico/pacientes', cita.idPaciente]),
      });
    }
    botones.push({
      text: t('cita_accion_mensaje'),
      icon: 'chatbubbles-outline',
      handler: () => void this.router.navigate([esMedico ? '/medico/chat' : '/paciente/chat', esMedico ? cita.idPaciente : cita.idMedico]),
    });
    if (activa) {
      botones.push({
        text: t(esMedico && cita.estado === 'pendiente' ? 'cita_accion_rechazar' : 'cita_accion_cancelar'),
        role: 'destructive',
        icon: 'close-circle-outline',
        handler: () => void this.confirmarCancelacion(cita),
      });
    }
    botones.push({ text: t('cerrar'), role: 'cancel' });

    const hoja = await this.hojas.create({
      header: esMedico ? cita.nombrePaciente : cita.nombreMedico,
      subHeader: formatearFecha(cita.fechaHora, 'fechaHora', this.i18n.locale()),
      buttons: botones,
    });
    await hoja.present();
  }

  private async confirmarCancelacion(cita: Cita): Promise<void> {
    const alerta = await this.alertas.create({
      header: this.i18n.t('cita_cancelar_titulo'),
      message: this.i18n.t('cita_cancelar_mensaje'),
      buttons: [
        { text: this.i18n.t('no'), role: 'cancel' },
        { text: this.i18n.t('cita_cancelar_si'), role: 'destructive', handler: () => void this.vm.cambiarEstado(cita, 'cancelada') },
      ],
    });
    await alerta.present();
  }

  private async completar(cita: Cita): Promise<void> {
    const alerta = await this.alertas.create({
      header: this.i18n.t('cita_completar_titulo'),
      message: this.i18n.t('cita_completar_mensaje'),
      inputs: [{ name: 'notas', type: 'textarea', value: cita.notasMedico ?? '', placeholder: this.i18n.t('cita_notas_placeholder') }],
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        {
          text: this.i18n.t('cita_accion_completar'),
          handler: (datos: { notas: string }) => void this.vm.cambiarEstado(cita, 'completada', datos.notas.trim() || null),
        },
      ],
    });
    await alerta.present();
  }
}
