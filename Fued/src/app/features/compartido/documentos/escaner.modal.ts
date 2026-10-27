import { Component, ElementRef, Input, inject, signal, viewChild } from '@angular/core';
import type { OnDestroy, OnInit } from '@angular/core';
import {
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonSegment,
  IonSegmentButton,
  IonSpinner,
  IonTitle,
  IonToolbar,
  ModalController,
} from '@ionic/angular';
import type { Cuadrilatero, FiltroEscaneo, PaginaPdf } from '../../../core/documentos/escaner.util';
import {
  aplicarFiltro,
  crearPdf,
  cuadroPorDefecto,
  detectarHoja,
  enderezar,
  rotar90,
} from '../../../core/documentos/escaner.util';
import { SessionService } from '../../../core/auth/session.service';
import type { DatosRastreo } from '../../../core/documentos/exif-escritura.util';
import {
  crearTiffExif,
  datosDispositivo,
  incrustarExif,
  nuevoIdEscaneo,
  ubicacionActual,
} from '../../../core/documentos/exif-escritura.util';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { MetadatosDocumento } from '../../../core/models';
import { AvisosService } from '../../../core/ui/avisos.service';

const MAX_PAGINAS = 10;
const LADO_MAXIMO = 1800;
const CALIDAD_JPEG = 0.85;

interface Pagina {
  hoja: ImageData;
  filtro: FiltroEscaneo;
  vista: string;
}

/** Lo que devuelve el escáner con `role = 'listo'`. */
export interface ResultadoEscaneo {
  blob: Blob;
  nombre: string;
  metadatos: MetadatosDocumento;
}

type Fase = 'camara' | 'ajuste' | 'revision' | 'procesando';

/**
 * Escáner de documentos de la propia app: cámara en vivo con el contorno de la hoja,
 * ajuste fino de las cuatro esquinas, enderezado, filtro de documento y varias páginas
 * que salen como un PDF (o un JPEG si es una sola).
 */
@Component({
  selector: 'app-escaner',
  templateUrl: 'escaner.modal.html',
  styleUrls: ['escaner.modal.scss'],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonIcon,
    IonSpinner,
    IonSegment,
    IonSegmentButton,
    TPipe,
  ],
})
export class EscanerModal implements OnInit, OnDestroy {
  /** Expediente al que va el escaneo; queda escrito en el EXIF para rastrearlo. */
  @Input() idPaciente = '';

  private readonly sesion = inject(SessionService);
  private readonly modal = inject(ModalController);
  private readonly i18n = inject(I18nService);
  private readonly avisos = inject(AvisosService);

  private readonly video = viewChild<ElementRef<HTMLVideoElement>>('video');
  private readonly lienzoAjuste = viewChild<ElementRef<SVGSVGElement>>('ajusteSvg');

  readonly fase = signal<Fase>('camara');
  readonly paginas = signal<Pagina[]>([]);
  readonly actual = signal(0);
  readonly sinCamara = signal(false);
  readonly linterna = signal(false);
  readonly linternaDisponible = signal(false);
  /** Guardar dónde se escaneó (GPS) en el EXIF de cada página. */
  readonly guardarUbicacion = signal(true);
  private ubicacion?: ReturnType<typeof ubicacionActual>;
  private readonly dispositivo = datosDispositivo();

  /** Contorno detectado en vivo, en coordenadas del video. */
  readonly contornoVivo = signal<Cuadrilatero | null>(null);
  readonly medidasVideo = signal({ ancho: 1, alto: 1 });

  /** Foto recién tomada y sus esquinas editables. */
  readonly foto = signal<{ url: string; ancho: number; alto: number } | null>(null);
  readonly esquinas = signal<Cuadrilatero>(cuadroPorDefecto(1, 1));

  private flujo?: MediaStream;
  private datosFoto?: ImageData;
  private temporizador?: ReturnType<typeof setInterval>;
  private arrastrando: number | null = null;
  private nombreCamara = '';

  readonly maxPaginas = MAX_PAGINAS;
  readonly filtros: FiltroEscaneo[] = ['documento', 'gris', 'color'];

  async ngOnInit(): Promise<void> {
    // La ubicación se pide desde el principio para tenerla lista al terminar.
    this.ubicacion = ubicacionActual();
    await this.encenderCamara();
  }

  alternarUbicacion(): void {
    this.guardarUbicacion.update((v) => !v);
  }

  ngOnDestroy(): void {
    this.apagarCamara();
    for (const pagina of this.paginas()) {
      URL.revokeObjectURL(pagina.vista);
    }
    const foto = this.foto();
    if (foto) {
      URL.revokeObjectURL(foto.url);
    }
  }

  // --- Cámara -------------------------------------------------------------

  private async encenderCamara(): Promise<void> {
    this.fase.set('camara');
    this.contornoVivo.set(null);
    try {
      this.flujo = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 2560 }, height: { ideal: 1920 } },
      });
    } catch {
      this.sinCamara.set(true);
      return;
    }
    const pista = this.flujo.getVideoTracks()[0];
    this.nombreCamara = pista?.label ?? '';
    const capacidades = (pista?.getCapabilities?.() ?? {}) as MediaTrackCapabilities & { torch?: boolean };
    this.linternaDisponible.set(!!capacidades.torch);

    // El <video> existe hasta que Angular pinta la fase de cámara.
    await new Promise((r) => requestAnimationFrame(r));
    const video = this.video()?.nativeElement;
    if (!video) {
      return;
    }
    video.srcObject = this.flujo;
    await video.play().catch(() => undefined);
    this.temporizador = setInterval(() => this.detectarEnVivo(), 350);
  }

  private apagarCamara(): void {
    clearInterval(this.temporizador);
    this.flujo?.getTracks().forEach((t) => t.stop());
    this.flujo = undefined;
    this.linterna.set(false);
  }

  private detectarEnVivo(): void {
    const video = this.video()?.nativeElement;
    if (!video || video.readyState < 2 || !video.videoWidth) {
      return;
    }
    this.medidasVideo.set({ ancho: video.videoWidth, alto: video.videoHeight });
    this.contornoVivo.set(detectarHoja(video, video.videoWidth, video.videoHeight));
  }

  async alternarLinterna(): Promise<void> {
    const pista = this.flujo?.getVideoTracks()[0];
    if (!pista) {
      return;
    }
    const encendida = !this.linterna();
    try {
      await pista.applyConstraints({ advanced: [{ torch: encendida } as MediaTrackConstraintSet] });
      this.linterna.set(encendida);
    } catch {
      this.linternaDisponible.set(false);
    }
  }

  puntos(c: Cuadrilatero | null): string {
    return c ? c.map((p) => `${p.x},${p.y}`).join(' ') : '';
  }

  /** Toma la foto a resolución completa y pasa a ajustar las esquinas. */
  async capturar(): Promise<void> {
    const video = this.video()?.nativeElement;
    if (!video?.videoWidth) {
      return;
    }
    const ancho = video.videoWidth;
    const alto = video.videoHeight;
    const lienzo = new OffscreenCanvas(ancho, alto);
    const ctx = lienzo.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(video, 0, 0, ancho, alto);
    this.datosFoto = ctx.getImageData(0, 0, ancho, alto);
    const blob = await lienzo.convertToBlob({ type: 'image/jpeg', quality: 0.8 });

    this.apagarCamara();
    this.esquinas.set(detectarHoja(lienzo, ancho, alto) ?? this.contornoVivo() ?? cuadroPorDefecto(ancho, alto));
    this.foto.set({ url: URL.createObjectURL(blob), ancho, alto });
    this.fase.set('ajuste');
  }

  // --- Ajuste de esquinas ---------------------------------------------------

  tomarEsquina(indice: number, evento: PointerEvent): void {
    this.arrastrando = indice;
    (evento.target as Element).setPointerCapture?.(evento.pointerId);
    evento.preventDefault();
  }

  moverEsquina(evento: PointerEvent): void {
    const svg = this.lienzoAjuste()?.nativeElement;
    const foto = this.foto();
    if (this.arrastrando === null || !svg || !foto) {
      return;
    }
    const matriz = svg.getScreenCTM();
    if (!matriz) {
      return;
    }
    const punto = new DOMPoint(evento.clientX, evento.clientY).matrixTransform(matriz.inverse());
    const x = Math.min(foto.ancho, Math.max(0, punto.x));
    const y = Math.min(foto.alto, Math.max(0, punto.y));
    const indice = this.arrastrando;
    this.esquinas.update((c) => c.map((p, i) => (i === indice ? { x, y } : p)) as Cuadrilatero);
  }

  soltarEsquina(): void {
    this.arrastrando = null;
  }

  usarHojaCompleta(): void {
    const foto = this.foto();
    if (foto) {
      this.esquinas.set(cuadroPorDefecto(foto.ancho, foto.alto, 0));
    }
  }

  radioEsquina(): number {
    const foto = this.foto();
    return foto ? Math.max(foto.ancho, foto.alto) * 0.025 : 10;
  }

  async retomar(): Promise<void> {
    this.descartarFoto();
    await this.encenderCamara();
  }

  /** Endereza la hoja con las esquinas elegidas y la agrega a las páginas. */
  async aceptarAjuste(): Promise<void> {
    if (!this.datosFoto) {
      return;
    }
    this.fase.set('procesando');
    await new Promise((r) => setTimeout(r, 30));
    const hoja = enderezar(this.datosFoto, this.esquinas(), LADO_MAXIMO);
    this.descartarFoto();
    const pagina: Pagina = { hoja, filtro: 'documento', vista: await this.vistaPrevia(hoja, 'documento') };
    this.paginas.update((p) => [...p, pagina]);
    this.actual.set(this.paginas().length - 1);
    this.fase.set('revision');
  }

  private descartarFoto(): void {
    const foto = this.foto();
    if (foto) {
      URL.revokeObjectURL(foto.url);
    }
    this.foto.set(null);
    this.datosFoto = undefined;
  }

  // --- Revisión de páginas --------------------------------------------------

  private async vistaPrevia(hoja: ImageData, filtro: FiltroEscaneo): Promise<string> {
    const blob = await aplicarFiltro(hoja, filtro).convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    return URL.createObjectURL(blob);
  }

  private async reemplazarActual(cambio: (p: Pagina) => Pick<Pagina, 'hoja' | 'filtro'>): Promise<void> {
    const indice = this.actual();
    const pagina = this.paginas()[indice];
    if (!pagina) {
      return;
    }
    const { hoja, filtro } = cambio(pagina);
    const vista = await this.vistaPrevia(hoja, filtro);
    URL.revokeObjectURL(pagina.vista);
    this.paginas.update((ps) => ps.map((p, i) => (i === indice ? { hoja, filtro, vista } : p)));
  }

  cambiarFiltro(filtro: FiltroEscaneo): Promise<void> {
    return this.reemplazarActual((p) => ({ hoja: p.hoja, filtro }));
  }

  girar(): Promise<void> {
    return this.reemplazarActual((p) => ({ hoja: rotar90(p.hoja), filtro: p.filtro }));
  }

  borrarActual(): void {
    const indice = this.actual();
    const pagina = this.paginas()[indice];
    if (!pagina) {
      return;
    }
    URL.revokeObjectURL(pagina.vista);
    this.paginas.update((ps) => ps.filter((_, i) => i !== indice));
    this.actual.set(Math.max(0, Math.min(indice, this.paginas().length - 1)));
    if (this.paginas().length === 0) {
      void this.encenderCamara();
    }
  }

  async agregarPagina(): Promise<void> {
    if (this.paginas().length >= MAX_PAGINAS) {
      await this.avisos.info('escaner_max_paginas', { max: MAX_PAGINAS });
      return;
    }
    await this.encenderCamara();
  }

  verRevision(): void {
    if (this.paginas().length > 0) {
      this.apagarCamara();
      this.fase.set('revision');
    }
  }

  // --- Salida ---------------------------------------------------------------

  cancelar(): Promise<boolean> {
    return this.modal.dismiss(null, 'cancelar');
  }

  /**
   * Una página sale como JPEG; varias, como un PDF con una hoja por página.
   * Cada página lleva EXIF de rastreo: app, teléfono, quién, cuándo, dónde y un id único del escaneo.
   */
  async terminar(): Promise<void> {
    const paginas = this.paginas();
    if (paginas.length === 0) {
      return;
    }
    this.fase.set('procesando');
    await new Promise((r) => setTimeout(r, 30));
    const ahora = new Date();
    const marca = ahora.toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const idEscaneo = nuevoIdEscaneo();
    const usuario = this.sesion.usuario();
    const autor = usuario ? `${usuario.nombre} ${usuario.apellidos}`.trim() : undefined;
    const app = `${this.i18n.t('app_nombre')} (${this.i18n.t('escaner_titulo')})`;
    const [{ marca: marcaTelefono, modelo }, ubicacion] = await Promise.all([
      this.dispositivo,
      this.guardarUbicacion() ? (this.ubicacion ?? ubicacionActual()) : Promise.resolve(null),
    ]);

    const lienzos = paginas.map((p) => aplicarFiltro(p.hoja, p.filtro));
    const jpegs = await Promise.all(
      lienzos.map(async (lienzo, i) => {
        const jpeg = new Uint8Array(await (await lienzo.convertToBlob({ type: 'image/jpeg', quality: CALIDAD_JPEG })).arrayBuffer());
        const rastreo: DatosRastreo = {
          idEscaneo,
          fecha: ahora,
          app,
          marca: marcaTelefono,
          modelo,
          autor,
          descripcion: this.i18n.t('escaner_exif_descripcion', { pagina: i + 1, paginas: paginas.length }),
          ubicacion,
          ancho: lienzo.width,
          alto: lienzo.height,
          comentario: {
            expediente: this.idPaciente,
            escaneadoPor: usuario?.id ?? '',
            rol: usuario?.rol ?? '',
            pagina: i + 1,
            paginas: paginas.length,
            filtro: paginas[i].filtro,
          },
        };
        return incrustarExif(jpeg, crearTiffExif(rastreo));
      }),
    );

    // Lo mismo, a la vista en la pestaña de metadatos (y guardado en la API), también para el PDF.
    const metadatos: MetadatosDocumento = {
      rastreo: {
        idEscaneo,
        app,
        ...(autor ? { autor } : {}),
        expediente: this.idPaciente,
        ...(usuario ? { escaneadoPor: usuario.id, rol: usuario.rol } : {}),
      },
      camara: { ...(marcaTelefono ? { marca: marcaTelefono } : {}), ...(modelo ? { modelo } : {}), ...(this.nombreCamara ? { lente: this.nombreCamara } : {}) },
      captura: { fechaOriginal: ahora.toISOString() },
      escaneo: {
        paginas: paginas.length,
        filtro: [...new Set(paginas.map((p) => this.i18n.t(`escaner_filtro_${p.filtro}`)))].join(', '),
        resolucion: `${paginas[0].hoja.width} × ${paginas[0].hoja.height} px`,
      },
      ...(ubicacion
        ? {
            ubicacion: {
              latitud: ubicacion.latitud,
              longitud: ubicacion.longitud,
              ...(ubicacion.altitud !== null ? { altitud: ubicacion.altitud } : {}),
            },
          }
        : {}),
    };

    let resultado: ResultadoEscaneo;
    if (paginas.length === 1) {
      resultado = { blob: new Blob([jpegs[0] as BlobPart], { type: 'image/jpeg' }), nombre: `escaneo_${marca}.jpg`, metadatos };
    } else {
      const paginasPdf: PaginaPdf[] = jpegs.map((jpeg, i) => ({ jpeg, ancho: lienzos[i].width, alto: lienzos[i].height }));
      const pdf = crearPdf(paginasPdf, this.i18n.t('documento_origen_escaner'), app, { autor, palabrasClave: idEscaneo });
      resultado = { blob: pdf, nombre: `escaneo_${marca}.pdf`, metadatos };
    }
    await this.modal.dismiss(resultado, 'listo');
  }
}
