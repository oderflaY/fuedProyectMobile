import { Component, Input, inject, signal } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import {
  AlertController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import { FechaPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { DocumentoMedico } from '../../../core/models';
import { PacientesRepository } from '../../../core/repositories/pacientes.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import { MetadatosDocumentoComponent } from './metadatos-documento.component';

/** Muestra un documento del expediente con sus datos y su EXIF. Cierra con `role = 'eliminar'` si se borra. */
@Component({
  selector: 'app-documento-visor',
  templateUrl: 'documento-visor.modal.html',
  styleUrls: ['documentos.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    TPipe,
    FechaPipe,
    MetadatosDocumentoComponent,
  ],
})
export class DocumentoVisorModal implements OnInit, OnDestroy {
  @Input({ required: true }) documento!: DocumentoMedico;
  @Input() puedeEliminar = false;

  private readonly modal = inject(ModalController);
  private readonly alertas = inject(AlertController);
  private readonly repo = inject(PacientesRepository);
  private readonly avisos = inject(AvisosService);
  private readonly i18n = inject(I18nService);

  readonly url = signal<string | null>(null);
  readonly cargando = signal(true);
  readonly pestana = signal<'documento' | 'metadatos'>('documento');
  private blob?: Blob;

  get esImagen(): boolean {
    return this.documento.archivo.mime.startsWith('image/');
  }

  async ngOnInit(): Promise<void> {
    try {
      this.blob = await this.repo.descargarDocumento(this.documento);
      this.url.set(URL.createObjectURL(this.blob));
    } catch (error) {
      await this.avisos.error(error);
    } finally {
      this.cargando.set(false);
    }
  }

  ngOnDestroy(): void {
    const url = this.url();
    if (url) {
      URL.revokeObjectURL(url);
    }
  }

  cerrar(): Promise<boolean> {
    return this.modal.dismiss(null, 'cerrar');
  }

  /** En el teléfono se guarda en Documentos (el WebView no abre PDF); en el navegador se abre en otra pestaña. */
  async guardarEnTelefono(): Promise<void> {
    if (!this.blob) {
      return;
    }
    if (!Capacitor.isNativePlatform()) {
      window.open(this.url() ?? '', '_blank');
      return;
    }
    try {
      const datos = await this.base64(this.blob);
      const ruta = `Fued/${this.documento.archivo.nombre}`;
      await Filesystem.writeFile({ path: ruta, data: datos, directory: Directory.Documents, recursive: true });
      await this.avisos.exito('documento_guardado_telefono', { ruta: `Documentos/${ruta}` });
    } catch (error) {
      await this.avisos.error(error);
    }
  }

  async eliminar(): Promise<void> {
    const alerta = await this.alertas.create({
      header: this.i18n.t('expediente_eliminar_titulo'),
      message: this.i18n.t('expediente_eliminar_mensaje', { elemento: this.documento.titulo }),
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        { text: this.i18n.t('eliminar'), role: 'destructive', handler: () => void this.modal.dismiss(this.documento, 'eliminar') },
      ],
    });
    await alerta.present();
  }

  private base64(blob: Blob): Promise<string> {
    return new Promise((resolver, rechazar) => {
      const lector = new FileReader();
      lector.onload = () => resolver(String(lector.result).split(',')[1] ?? '');
      lector.onerror = () => rechazar(lector.error);
      lector.readAsDataURL(blob);
    });
  }
}
