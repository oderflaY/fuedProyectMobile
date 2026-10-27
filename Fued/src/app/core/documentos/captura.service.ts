import { Injectable, inject } from '@angular/core';
import { Camera, MediaTypeSelection } from '@capacitor/camera';
import { ModalController } from '@ionic/angular';
import type { ResultadoEscaneo } from '../../features/compartido/documentos/escaner.modal';
import type { MetadatosDocumento, OrigenDocumento } from '../models';
import { exifDelPlugin, leerExif, leerInfoPdf, unirMetadatos } from './metadatos.util';

/** Un archivo listo para subir al expediente, con lo que se pudo leer de él. */
export interface ArchivoCapturado {
  archivo: File;
  origen: OrigenDocumento;
  metadatos: MetadatosDocumento;
  /** URL local para la vista previa; quien la usa la libera con `URL.revokeObjectURL`. */
  vistaPrevia: string;
}

/** El usuario cerró la cámara, el escáner o la galería sin elegir nada. */
export class CapturaCancelada extends Error {}

const ACEPTADOS = 'image/jpeg,image/png,image/webp,image/heic,application/pdf';

/**
 * Consigue fotos y documentos para el expediente: cámara, escáner de documentos
 * de la propia app (detecta, endereza y limpia la hoja), galería o un PDF del teléfono.
 */
@Injectable({ providedIn: 'root' })
export class CapturaService {
  private readonly modales = inject(ModalController);

  /** El escáner usa la cámara en vivo del WebView. */
  readonly escanerDisponible = !!navigator.mediaDevices?.getUserMedia;

  async tomarFoto(): Promise<ArchivoCapturado> {
    const foto = await this.cancelable(() => Camera.takePhoto({ quality: 85, correctOrientation: true, includeMetadata: true }));
    const blob = await this.leerRuta(foto.webPath);
    return this.preparar(blob, `foto_${this.marca()}.jpg`, 'camara', exifDelPlugin(foto.metadata?.exif));
  }

  async elegirDeGaleria(): Promise<ArchivoCapturado> {
    const { results } = await this.cancelable(() =>
      Camera.chooseFromGallery({ mediaType: MediaTypeSelection.Photo, limit: 1, includeMetadata: true, quality: 100 }),
    );
    const foto = results[0];
    if (!foto) {
      throw new CapturaCancelada();
    }
    const blob = await this.leerRuta(foto.webPath);
    const extension = (foto.metadata?.format || blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    return this.preparar(blob, `imagen_${this.marca()}.${extension}`, 'galeria', exifDelPlugin(foto.metadata?.exif));
  }

  /** Abre el escáner de la app; una hoja sale como JPEG y varias como un solo PDF. */
  async escanear(idPaciente: string): Promise<ArchivoCapturado> {
    // El escáner va en su propio chunk: sólo se descarga la primera vez que se usa.
    const { EscanerModal } = await import('../../features/compartido/documentos/escaner.modal');
    const modal = await this.modales.create({ component: EscanerModal, cssClass: 'modal-escaner', componentProps: { idPaciente } });
    await modal.present();
    const { data, role } = await modal.onWillDismiss<ResultadoEscaneo>();
    if (role !== 'listo' || !data) {
      throw new CapturaCancelada();
    }
    return this.preparar(data.blob, data.nombre, 'escaner', data.metadatos);
  }

  /** Selector de archivos del sistema (PDF de laboratorio, imágenes descargadas…). */
  elegirArchivo(): Promise<ArchivoCapturado> {
    return new Promise((resolver, rechazar) => {
      const entrada = document.createElement('input');
      entrada.type = 'file';
      entrada.accept = ACEPTADOS;
      entrada.addEventListener('change', () => {
        const archivo = entrada.files?.[0];
        if (archivo) {
          this.preparar(archivo, archivo.name, 'archivo', {}).then(resolver, rechazar);
        } else {
          rechazar(new CapturaCancelada());
        }
      });
      entrada.addEventListener('cancel', () => rechazar(new CapturaCancelada()));
      entrada.click();
    });
  }

  private async preparar(
    blob: Blob,
    nombre: string,
    origen: OrigenDocumento,
    extra: MetadatosDocumento,
  ): Promise<ArchivoCapturado> {
    const mime = blob.type || (nombre.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
    const archivo = blob instanceof File ? blob : new File([blob], nombre, { type: mime });
    const esPdf = mime === 'application/pdf';
    const leidos = esPdf ? await leerInfoPdf(archivo) : await leerExif(archivo);
    const datosArchivo: MetadatosDocumento = {
      archivo: { nombre: archivo.name, tipo: mime, bytes: archivo.size },
    };
    if (!esPdf && !leidos['imagen']) {
      const medidas = await this.medidas(archivo);
      if (medidas) {
        datosArchivo['imagen'] = medidas;
      }
    }
    return {
      archivo,
      origen,
      metadatos: unirMetadatos(leidos, extra, datosArchivo),
      vistaPrevia: URL.createObjectURL(archivo),
    };
  }

  private async medidas(archivo: Blob): Promise<{ ancho: number; alto: number } | null> {
    try {
      const imagen = await createImageBitmap(archivo);
      const medidas = { ancho: imagen.width, alto: imagen.height };
      imagen.close();
      return medidas;
    } catch {
      return null;
    }
  }

  private async leerRuta(ruta: string | undefined): Promise<Blob> {
    if (!ruta) {
      throw new CapturaCancelada();
    }
    return (await fetch(ruta)).blob();
  }

  /** Los plugins rechazan con un error al cancelar; aquí se vuelve `CapturaCancelada`. */
  private async cancelable<T>(accion: () => Promise<T>): Promise<T> {
    try {
      return await accion();
    } catch (error) {
      const mensaje = String((error as { message?: string })?.message ?? error).toLowerCase();
      if (/cancel/.test(mensaje)) {
        throw new CapturaCancelada();
      }
      throw error;
    }
  }

  private marca(): string {
    return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
  }
}
