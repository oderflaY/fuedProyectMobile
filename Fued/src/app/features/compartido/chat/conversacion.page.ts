import { Component, Input, computed, effect, inject, signal, viewChild } from '@angular/core';
import type { ElementRef, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import {
  ActionSheetController,
  IonBackButton,
  IonButton,
  IonButtons,
  IonChip,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonLabel,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import type { ViewDidEnter, ViewWillLeave } from '@ionic/angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FechaPipe, TPipe } from '../../../core/i18n/pipes';
import type { Mensaje } from '../../../core/models';
import { AvisosService } from '../../../core/ui/avisos.service';
import { AdjuntosService } from '../../../core/voz/adjuntos.service';
import { DictadoService } from '../../../core/voz/dictado.service';
import { GrabadoraService } from '../../../core/voz/grabadora.service';
import { NuevaCitaModal } from '../citas/nueva-cita.modal';
import { ConversacionViewModel } from './conversacion.viewmodel';

/** Acciones rápidas del chat: abren un modal o dejan una plantilla lista para editar. */
interface AccionRapida {
  clave: string;
  icono: string;
  plantilla?: string;
  accion?: () => void;
}

const DOCUMENTOS_ACEPTADOS = 'application/pdf,image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt';

@Component({
  selector: 'app-conversacion',
  templateUrl: 'conversacion.page.html',
  styleUrls: ['conversacion.page.scss'],
  providers: [ConversacionViewModel, AdjuntosService],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonContent,
    IonFooter,
    IonTextarea,
    IonButton,
    IonIcon,
    IonChip,
    IonLabel,
    IonSpinner,
    TPipe,
    FechaPipe,
  ],
})
export class ConversacionPage implements OnInit, OnDestroy, ViewDidEnter, ViewWillLeave {
  @Input() idContraparte = '';

  readonly vm = inject(ConversacionViewModel);
  readonly grabadora = inject(GrabadoraService);
  readonly dictado = inject(DictadoService);
  readonly adjuntos = inject(AdjuntosService);
  private readonly i18n = inject(I18nService);
  private readonly avisos = inject(AvisosService);
  private readonly hojas = inject(ActionSheetController);
  private readonly modales = inject(ModalController);
  private readonly router = inject(Router);

  private readonly contenido = viewChild(IonContent);
  private readonly selector = viewChild<ElementRef<HTMLInputElement>>('selectorArchivo');
  private textoAntesDeDictar = '';

  readonly acciones = computed<AccionRapida[]>(() =>
    this.vm.rol() === 'medico'
      ? [
          { clave: 'chat_accion_agendar', icono: 'calendar-outline', accion: () => void this.agendarCita() },
          { clave: 'chat_accion_indicaciones', icono: 'document-text-outline', plantilla: this.i18n.t('chat_plantilla_indicaciones') },
          { clave: 'chat_accion_expediente', icono: 'medkit-outline', accion: () => this.verExpediente() },
        ]
      : [
          { clave: 'chat_accion_agendar', icono: 'calendar-outline', accion: () => void this.agendarCita() },
          { clave: 'chat_accion_recordatorio', icono: 'alarm-outline', plantilla: this.i18n.t('chat_plantilla_recordatorio') },
          { clave: 'chat_accion_duda', icono: 'medkit-outline', plantilla: this.i18n.t('chat_plantilla_duda') },
        ],
  );

  readonly aceptaArchivos = signal(DOCUMENTOS_ACEPTADOS);

  constructor() {
    // Cada vez que llegan mensajes se baja al final y se precargan los adjuntos.
    effect(() => {
      const mensajes = this.vm.mensajes();
      if (mensajes.length === 0) {
        return;
      }
      for (const mensaje of mensajes) {
        if (mensaje.adjunto && mensaje.tipo !== 'archivo') {
          void this.adjuntos.precargar(mensaje);
        }
      }
      setTimeout(() => void this.contenido()?.scrollToBottom(200));
    });
  }

  ngOnInit(): void {
    void this.vm.iniciar(this.idContraparte);
  }

  ionViewDidEnter(): void {
    this.vm.iniciarSondeo();
  }

  ionViewWillLeave(): void {
    this.vm.detenerSondeo();
    this.dictado.detener();
  }

  ngOnDestroy(): void {
    this.vm.detenerSondeo();
    this.dictado.detener();
    this.grabadora.cancelar();
    this.adjuntos.liberar();
  }

  alPresionarTecla(evento: KeyboardEvent): void {
    if (evento.key === 'Enter' && !evento.shiftKey) {
      evento.preventDefault();
      void this.vm.enviar();
    }
  }

  ejecutar(accion: AccionRapida): void {
    if (accion.accion) {
      accion.accion();
    } else if (accion.plantilla) {
      this.vm.usarPlantilla(accion.plantilla);
    }
  }

  // --- Dictado por voz -------------------------------------------------

  alternarDictado(): void {
    if (this.dictado.escuchando()) {
      this.dictado.detener();
      return;
    }
    if (!this.dictado.soportado) {
      // En algunos teléfonos el dictado vive en el teclado: se le indica al usuario.
      void this.avisos.info('chat_dictado_no_disponible');
      return;
    }
    this.textoAntesDeDictar = this.vm.borrador().trim();
    this.dictado.iniciar(
      this.i18n.locale(),
      (texto) => {
        const base = this.textoAntesDeDictar;
        this.vm.borrador.set(base ? `${base} ${texto}` : texto);
      },
      () => void this.avisos.info('chat_dictado_error'),
    );
  }

  // --- Nota de voz -----------------------------------------------------

  async grabarVoz(): Promise<void> {
    if (!this.grabadora.soportado) {
      await this.avisos.info('chat_audio_no_disponible');
      return;
    }
    try {
      await this.grabadora.iniciar();
    } catch {
      await this.avisos.info('chat_microfono_denegado');
    }
  }

  async detenerYEnviarVoz(): Promise<void> {
    const grabacion = await this.grabadora.detener();
    if (grabacion) {
      await this.vm.enviarArchivo(grabacion.archivo, { duracionSeg: grabacion.duracionSeg });
    }
  }

  cancelarGrabacion(): void {
    this.grabadora.cancelar();
  }

  // --- Adjuntos --------------------------------------------------------

  async opcionesAdjunto(): Promise<void> {
    const t = (clave: string) => this.i18n.t(clave);
    const hoja = await this.hojas.create({
      header: t('chat_adjuntar'),
      buttons: [
        { text: t('chat_adjuntar_audio'), icon: 'mic-outline', handler: () => void this.grabarVoz() },
        { text: t('chat_adjuntar_foto'), icon: 'camera-outline', handler: () => void this.tomarFoto() },
        { text: t('chat_adjuntar_documento'), icon: 'document-attach-outline', handler: () => this.abrirSelector() },
        { text: t('cancelar'), role: 'cancel' },
      ],
    });
    await hoja.present();
  }

  private abrirSelector(): void {
    this.selector()?.nativeElement.click();
  }

  async tomarFoto(): Promise<void> {
    try {
      const foto = await Camera.getPhoto({ quality: 70, resultType: CameraResultType.Uri, source: CameraSource.Prompt });
      if (!foto.webPath) {
        return;
      }
      const blob = await (await fetch(foto.webPath)).blob();
      const extension = foto.format || 'jpeg';
      await this.vm.enviarArchivo(new File([blob], `foto.${extension}`, { type: blob.type || `image/${extension}` }));
    } catch {
      // El usuario canceló la cámara.
    }
  }

  async archivoSeleccionado(evento: Event): Promise<void> {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files?.[0];
    entrada.value = '';
    if (archivo) {
      await this.vm.enviarArchivo(archivo);
    }
  }

  // --- Adjuntos recibidos ---------------------------------------------

  async abrirAdjunto(mensaje: Mensaje): Promise<void> {
    if (!mensaje.adjunto) {
      return;
    }
    try {
      const url = this.adjuntos.url(mensaje.idMensaje) ?? (await this.adjuntos.precargar(mensaje));
      if (!url) {
        return;
      }
      const ventana = window.open(url, '_blank');
      if (!ventana) {
        const enlace = document.createElement('a');
        enlace.href = url;
        enlace.download = mensaje.adjunto.nombre;
        enlace.click();
      }
    } catch (error) {
      await this.avisos.error(error);
    }
  }

  tamano(bytes: number): string {
    return bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  duracion(segundos: number | null): string {
    const total = segundos ?? 0;
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
  }

  // --- Acciones rápidas ------------------------------------------------

  private async agendarCita(): Promise<void> {
    const modal = await this.modales.create({ component: NuevaCitaModal, componentProps: { preseleccion: this.vm.idContraparte() } });
    await modal.present();
    const { role } = await modal.onWillDismiss();
    if (role === 'creada') {
      this.vm.usarPlantilla(this.i18n.t('chat_plantilla_cita_creada'));
    }
  }

  private verExpediente(): void {
    void this.router.navigate(['/medico/pacientes', this.vm.idContraparte()]);
  }
}
