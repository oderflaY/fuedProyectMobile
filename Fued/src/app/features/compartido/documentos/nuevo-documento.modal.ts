import { Component, Input, computed, inject, signal } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonList,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import type { ArchivoCapturado } from '../../../core/documentos/captura.service';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import { CATEGORIAS_DOCUMENTO } from '../../../core/models';
import type { CategoriaDocumento, NuevoDocumento } from '../../../core/models';
import { MetadatosDocumentoComponent } from './metadatos-documento.component';

/**
 * Antes de subir una foto o escaneo: vista previa, título, categoría y sus metadatos EXIF.
 * Devuelve un `NuevoDocumento` con `role = 'guardar'`.
 */
@Component({
  selector: 'app-nuevo-documento',
  templateUrl: 'nuevo-documento.modal.html',
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
    IonInput,
    IonTextarea,
    IonSelect,
    IonSelectOption,
    IonSegment,
    IonSegmentButton,
    IonIcon,
    TPipe,
    MetadatosDocumentoComponent,
  ],
})
export class NuevoDocumentoModal implements OnInit, OnDestroy {
  @Input({ required: true }) capturado!: ArchivoCapturado;

  private readonly modal = inject(ModalController);
  private readonly i18n = inject(I18nService);

  readonly categorias = CATEGORIAS_DOCUMENTO;
  readonly titulo = signal('');
  readonly categoria = signal<CategoriaDocumento>('otro');
  readonly fecha = signal('');
  readonly notas = signal('');
  readonly pestana = signal<'datos' | 'metadatos'>('datos');
  readonly puedeGuardar = computed(() => this.titulo().trim().length > 0);

  get esImagen(): boolean {
    return this.capturado.archivo.type.startsWith('image/');
  }

  ngOnInit(): void {
    this.categoria.set(this.capturado.origen === 'escaner' ? 'laboratorio' : 'receta');
    this.titulo.set(this.i18n.t(`documento_origen_${this.capturado.origen}`));
    // La fecha de captura del EXIF es la mejor pista de cuándo es el documento.
    const original = this.capturado.metadatos['captura']?.['fechaOriginal'];
    const fecha = typeof original === 'string' ? original.slice(0, 10).replace(/:/g, '-') : '';
    this.fecha.set(/^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : new Date().toISOString().slice(0, 10));
  }

  ngOnDestroy(): void {
    URL.revokeObjectURL(this.capturado.vistaPrevia);
  }

  cancelar(): Promise<boolean> {
    return this.modal.dismiss(null, 'cancelar');
  }

  guardar(): Promise<boolean> {
    const documento: NuevoDocumento = {
      titulo: this.titulo().trim(),
      categoria: this.categoria(),
      origen: this.capturado.origen,
      fechaDocumento: this.fecha() || null,
      notas: this.notas().trim() || null,
      metadatos: this.capturado.metadatos,
    };
    return this.modal.dismiss(documento, 'guardar');
  }
}
