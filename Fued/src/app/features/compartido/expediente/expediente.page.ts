import { Component, Input, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import type { ActionSheetButton, AlertInput, RefresherCustomEvent } from '@ionic/angular';
import { FechaPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { COLOR_ESTADO_TOMA, COLOR_SEGMENTO } from '../../../core/ui/colores.constants';
import type { Coleccion, NuevaMetrica, NuevoTratamiento, Tratamiento } from '../../../core/models';
import { NuevaCitaModal } from '../citas/nueva-cita.modal';
import { RegistrarMetricaModal } from '../metricas/registrar-metrica.modal';
import { ExpedienteViewModel } from './expediente.viewmodel';
import { TratamientoFormModal } from './tratamiento-form.modal';

interface CampoDialogo {
  nombre: string;
  etiqueta: string;
  tipo?: AlertInput['type'];
  requerido?: boolean;
}

const CAMPOS_COLECCION: Record<Coleccion, CampoDialogo[]> = {
  alergias: [
    { nombre: 'alergeno', etiqueta: 'alergia_alergeno', requerido: true },
    { nombre: 'severidad', etiqueta: 'alergia_severidad', requerido: true },
    { nombre: 'reaccion', etiqueta: 'alergia_reaccion' },
  ],
  condiciones: [{ nombre: 'descripcion', etiqueta: 'condicion_descripcion', requerido: true }],
  'medicacion-rescate': [{ nombre: 'descripcion', etiqueta: 'rescate_descripcion', requerido: true }],
  cirugias: [
    { nombre: 'procedimiento', etiqueta: 'cirugia_procedimiento', requerido: true },
    { nombre: 'fecha', etiqueta: 'cirugia_fecha', tipo: 'date', requerido: true },
    { nombre: 'notas', etiqueta: 'cirugia_notas' },
  ],
  contactos: [
    { nombre: 'nombre', etiqueta: 'contacto_nombre', requerido: true },
    { nombre: 'relacion', etiqueta: 'contacto_relacion', requerido: true },
    { nombre: 'telefono', etiqueta: 'contacto_telefono', tipo: 'tel', requerido: true },
  ],
};

@Component({
  selector: 'app-expediente',
  templateUrl: 'expediente.page.html',
  styleUrls: ['expediente.page.scss'],
  providers: [ExpedienteViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonChip,
    IonNote,
    IonSpinner,
    TPipe,
    FechaPipe,
  ],
})
export class ExpedientePage implements OnInit {
  /** Presente cuando un médico abre el expediente de un paciente (`/medico/pacientes/:idPaciente`). */
  @Input() idPaciente?: string;

  readonly vm = inject(ExpedienteViewModel);
  private readonly i18n = inject(I18nService);
  private readonly alertas = inject(AlertController);
  private readonly hojas = inject(ActionSheetController);
  private readonly modales = inject(ModalController);
  private readonly router = inject(Router);

  readonly colorToma = COLOR_ESTADO_TOMA;
  readonly colorSegmento = COLOR_SEGMENTO;

  ngOnInit(): void {
    void this.vm.iniciar(this.idPaciente);
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  async agregar(coleccion: Coleccion): Promise<void> {
    const campos = CAMPOS_COLECCION[coleccion];
    const alerta = await this.alertas.create({
      header: this.i18n.t(`expediente_agregar_${coleccion}`),
      inputs: campos.map((campo) => ({
        name: campo.nombre,
        type: campo.tipo ?? 'text',
        placeholder: this.i18n.t(campo.etiqueta),
        attributes: { 'aria-label': this.i18n.t(campo.etiqueta) },
      })),
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        {
          text: this.i18n.t('guardar'),
          handler: (datos: Record<string, string>) => {
            const faltante = campos.some((c) => c.requerido && !datos[c.nombre]?.trim());
            if (faltante) {
              return false;
            }
            void this.vm.agregar(coleccion, datos);
            return true;
          },
        },
      ],
    });
    await alerta.present();
  }

  async eliminar(coleccion: Coleccion, idElemento: string, descripcion: string): Promise<void> {
    const alerta = await this.alertas.create({
      header: this.i18n.t('expediente_eliminar_titulo'),
      message: this.i18n.t('expediente_eliminar_mensaje', { elemento: descripcion }),
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        { text: this.i18n.t('eliminar'), role: 'destructive', handler: () => void this.vm.eliminar(coleccion, idElemento) },
      ],
    });
    await alerta.present();
  }

  async nuevoTratamiento(): Promise<void> {
    const modal = await this.modales.create({ component: TratamientoFormModal });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<NuevoTratamiento>();
    if (role === 'guardar' && data) {
      await this.vm.recetar(data);
    }
  }

  async opcionesTratamiento(tratamiento: Tratamiento): Promise<void> {
    if (!this.vm.puedeEscribir()) {
      return;
    }
    const botones: ActionSheetButton[] = [
      { text: this.i18n.t('tratamiento_actualizar_inventario'), icon: 'cube-outline', handler: () => void this.pedirInventario(tratamiento) },
    ];
    if (this.vm.puedeGestionarTratamiento(tratamiento)) {
      botones.push({
        text: this.i18n.t('tratamiento_suspender'),
        role: 'destructive',
        icon: 'close-circle-outline',
        handler: () => void this.vm.suspender(tratamiento),
      });
    }
    botones.push({ text: this.i18n.t('cancelar'), role: 'cancel' });
    const hoja = await this.hojas.create({ header: `${tratamiento.medicamento} ${tratamiento.dosis}`, buttons: botones });
    await hoja.present();
  }

  private async pedirInventario(tratamiento: Tratamiento): Promise<void> {
    const alerta = await this.alertas.create({
      header: this.i18n.t('tratamiento_actualizar_inventario'),
      message: this.i18n.t('tratamiento_inventario_mensaje', { medicamento: tratamiento.medicamento }),
      inputs: [
        {
          name: 'cantidad',
          type: 'number',
          value: tratamiento.inventario.cantidadRestante,
          min: 0,
          attributes: { 'aria-label': this.i18n.t('tratamiento_cantidad') },
        },
      ],
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        {
          text: this.i18n.t('guardar'),
          handler: (datos: { cantidad: string }) => {
            const cantidad = Number.parseInt(datos.cantidad, 10);
            if (!Number.isFinite(cantidad) || cantidad < 0) {
              return false;
            }
            void this.vm.actualizarInventario(tratamiento, cantidad);
            return true;
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
    const modal = await this.modales.create({ component: NuevaCitaModal, componentProps: { preseleccion: this.vm.idPaciente() } });
    await modal.present();
  }

  abrirChat(): void {
    void this.router.navigate(['/medico/chat', this.vm.idPaciente()]);
  }
}
