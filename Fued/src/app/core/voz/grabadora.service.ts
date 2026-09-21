import { Injectable, signal } from '@angular/core';

const DURACION_MAXIMA_SEG = 300;

/**
 * Grabación de notas de voz con MediaRecorder (funciona en navegador y en el
 * WebView de Android; requiere el permiso RECORD_AUDIO en el manifiesto).
 */
@Injectable({ providedIn: 'root' })
export class GrabadoraService {
  readonly grabando = signal(false);
  readonly segundos = signal(0);

  private grabadora: MediaRecorder | null = null;
  private pistas: MediaStream | null = null;
  private fragmentos: Blob[] = [];
  private cronometro: ReturnType<typeof setInterval> | null = null;

  get soportado(): boolean {
    return typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
  }

  /** Pide el micrófono y empieza a grabar. Lanza error si el usuario no da permiso. */
  async iniciar(): Promise<void> {
    if (this.grabando()) {
      return;
    }
    this.pistas = await navigator.mediaDevices.getUserMedia({ audio: true });
    const formato = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find((tipo) => MediaRecorder.isTypeSupported(tipo));
    this.grabadora = new MediaRecorder(this.pistas, formato ? { mimeType: formato } : undefined);
    this.fragmentos = [];
    this.grabadora.ondataavailable = (evento) => {
      if (evento.data.size > 0) {
        this.fragmentos.push(evento.data);
      }
    };
    this.grabadora.start();
    this.grabando.set(true);
    this.segundos.set(0);
    this.cronometro = setInterval(() => {
      this.segundos.update((s) => s + 1);
      if (this.segundos() >= DURACION_MAXIMA_SEG) {
        this.grabadora?.stop();
      }
    }, 1000);
  }

  /** Detiene la grabación y devuelve el audio listo para enviarse. */
  async detener(): Promise<{ archivo: File; duracionSeg: number } | null> {
    const grabadora = this.grabadora;
    if (!grabadora || !this.grabando()) {
      this.liberar();
      return null;
    }
    const duracionSeg = Math.max(1, this.segundos());
    const audio = await new Promise<Blob>((resolve) => {
      grabadora.onstop = () => resolve(new Blob(this.fragmentos, { type: grabadora.mimeType || 'audio/webm' }));
      if (grabadora.state !== 'inactive') {
        grabadora.stop();
      } else {
        resolve(new Blob(this.fragmentos, { type: grabadora.mimeType || 'audio/webm' }));
      }
    });
    this.liberar();
    if (audio.size === 0) {
      return null;
    }
    const extension = audio.type.includes('mp4') ? 'm4a' : 'webm';
    return { archivo: new File([audio], `nota-de-voz.${extension}`, { type: audio.type }), duracionSeg };
  }

  cancelar(): void {
    if (this.grabadora && this.grabadora.state !== 'inactive') {
      this.grabadora.onstop = null;
      this.grabadora.stop();
    }
    this.liberar();
  }

  private liberar(): void {
    if (this.cronometro !== null) {
      clearInterval(this.cronometro);
      this.cronometro = null;
    }
    this.pistas?.getTracks().forEach((pista) => pista.stop());
    this.pistas = null;
    this.grabadora = null;
    this.fragmentos = [];
    this.grabando.set(false);
  }
}
