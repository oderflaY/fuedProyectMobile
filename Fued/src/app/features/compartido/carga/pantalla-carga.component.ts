import {
  Component,
  ElementRef,
  OnDestroy,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
  viewChildren,
} from '@angular/core';
import { CargaService } from '../../../core/ui/carga.service';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { EscenaBaile } from './escena-baile';

/** Tempo del coro "zazaza, moviendo el cuerpito" de "La Culebritica" (medido sobre el clip). */
const BPM = 134;
const PERIODO_MS = 60_000 / BPM;
const SALIDA_MS = 500;
const COLORES = ['#ff1f8f', '#00e5ff', '#ffe600', '#7a5cff', '#2bff88', '#ff6a00'];

/**
 * Pantalla de carga con el "zazaza" de La Culebritica, cholos 3D con sombrero bailando
 * y azulitos que caen del cielo. Se muestra mientras `CargaService`
 * diga que hay datos cargando (`activa`); al apagarse se desvanece y emite `terminada`.
 *
 * El ritmo sale del AnalyserNode (energía de graves); si el audio no puede analizarse,
 * se sigue un pulso fijo de 134 BPM para que nada se quede quieto.
 */
@Component({
  selector: 'app-pantalla-carga',
  templateUrl: 'pantalla-carga.component.html',
  styleUrls: ['pantalla-carga.component.scss'],
  imports: [TPipe],
  host: {
    '[class.saliendo]': 'saliendo()',
    '(click)': 'tocar()',
    '(window:resize)': 'escena?.ajustarTamano()',
  },
})
export class PantallaCargaComponent implements OnDestroy {
  readonly activa = input(true);
  readonly terminada = output<void>();

  private readonly carga = inject(CargaService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly lienzo = viewChild.required<ElementRef<HTMLCanvasElement>>('lienzo');
  private readonly letrasRef = viewChildren<ElementRef<HTMLElement>>('letra');

  readonly letras = [...inject(I18nService).t('cargando')].map((caracter, i) => ({
    caracter,
    color: COLORES[i % COLORES.length],
  }));

  readonly sinSonido = signal(false);
  readonly saliendo = signal(false);

  protected escena?: EscenaBaile;
  private audio = new Audio('assets/audio/culebritica-zazaza.mp3');
  private contexto?: AudioContext;
  private ganancia?: GainNode;
  private analizador?: AnalyserNode;
  private datos?: Uint8Array<ArrayBuffer>;

  private frame = 0;
  private temporizadorSalida?: ReturnType<typeof setTimeout>;
  private ultimoFrame = performance.now();
  private destruida = false;
  /** Beats transcurridos (con decimales); se re-sincroniza cuando el análisis detecta un golpe. */
  private fase = 0;
  private pulso = 0;
  private energiaMedia = 0;
  private ultimoGolpe = 0;

  constructor() {
    this.audio.preload = 'auto';
    this.audio.loop = true;
    void this.reproducir();

    effect(() => {
      const activa = this.activa();
      untracked(() => (activa ? this.volver() : this.cerrar()));
    });

    afterNextRender(() => {
      void this.montarEscena();
      this.frame = requestAnimationFrame((t) => this.animar(t));
    });
  }

  ngOnDestroy(): void {
    this.destruida = true;
    cancelAnimationFrame(this.frame);
    clearTimeout(this.temporizadorSalida);
    this.audio.pause();
    void this.contexto?.close();
    this.escena?.destruir();
  }

  /** Si el navegador bloqueó el autoplay, el primer toque arranca la música; después, salta el baile. */
  tocar(): void {
    if (this.sinSonido()) {
      void this.reproducir();
    } else {
      this.carga.ocultar();
    }
  }

  /** three.js va en su propio chunk: sólo se descarga cuando de verdad se muestra la pantalla. */
  private async montarEscena(): Promise<void> {
    try {
      const { EscenaBaile } = await import('./escena-baile');
      if (!this.destruida) {
        this.escena = new EscenaBaile(this.lienzo().nativeElement);
      }
    } catch (error) {
      // Sin WebGL queda el fondo oscuro con las letras bailando.
      console.error('No se pudo montar la escena 3D de la pantalla de carga', error);
    }
  }

  private async reproducir(): Promise<void> {
    try {
      // play() va primero y sin esperar a nada: si viene de un toque, conserva el permiso del gesto.
      await this.audio.play();
      this.sinSonido.set(false);
    } catch {
      this.sinSonido.set(true);
      return;
    }
    await this.conectarAnalizador();
  }

  /**
   * Engancha el AnalyserNode sólo si el AudioContext de verdad está corriendo:
   * createMediaElementSource manda todo el sonido por el contexto, y uno suspendido
   * dejaría la canción muda. Si no arranca, la canción suena directo y el baile usa el pulso fijo.
   */
  private async conectarAnalizador(): Promise<void> {
    if (this.analizador || this.destruida) {
      return;
    }
    try {
      this.contexto ??= new AudioContext();
      if (this.contexto.state !== 'running') {
        // resume() sin gesto se queda pendiente para siempre en Chrome; no lo esperamos de más.
        await Promise.race([this.contexto.resume(), new Promise((r) => setTimeout(r, 300))]);
      }
      if (this.contexto.state !== 'running' || this.analizador) {
        return;
      }
      const fuente = this.contexto.createMediaElementSource(this.audio);
      const analizador = this.contexto.createAnalyser();
      analizador.fftSize = 1024;
      analizador.smoothingTimeConstant = 0.4;
      this.ganancia = this.contexto.createGain();
      fuente.connect(analizador).connect(this.ganancia).connect(this.contexto.destination);
      this.datos = new Uint8Array(analizador.frequencyBinCount);
      this.analizador = analizador;
    } catch {
      // Sin Web Audio la canción suena igual; el baile usa el pulso fijo.
    }
  }

  private animar(ahora: number): void {
    const dt = Math.min(ahora - this.ultimoFrame, 100);
    this.ultimoFrame = ahora;

    const faseAnterior = this.fase;
    this.fase += dt / PERIODO_MS;
    if (this.detectarGolpe(ahora)) {
      // Golpe real en la música: alineamos la fase al beat entero más cercano.
      this.fase = Math.round(this.fase);
      this.pulso = 1;
    } else if (!this.escuchando() && Math.floor(this.fase) !== Math.floor(faseAnterior)) {
      this.pulso = 1;
    }
    this.pulso *= Math.exp(-dt / 180);

    this.pintar();
    this.escena?.renderizar(dt, this.pulso, this.fase);
    this.frame = requestAnimationFrame((t) => this.animar(t));
  }

  private escuchando(): boolean {
    return !!this.analizador && !this.sinSonido() && !this.audio.paused;
  }

  /** Detección simple de beat: energía de graves (≈ <170 Hz) por encima de su promedio reciente. */
  private detectarGolpe(ahora: number): boolean {
    if (!this.escuchando() || !this.analizador || !this.datos) {
      return false;
    }
    this.analizador.getByteFrequencyData(this.datos);
    const binsGraves = Math.max(2, Math.round((170 / this.contexto!.sampleRate) * this.analizador.fftSize));
    let suma = 0;
    for (let i = 0; i < binsGraves; i++) {
      suma += this.datos[i];
    }
    const energia = suma / binsGraves / 255;
    const promedio = this.energiaMedia || energia;
    this.energiaMedia = promedio * 0.92 + energia * 0.08;
    const golpe = energia > promedio * 1.15 && energia > 0.25 && ahora - this.ultimoGolpe > PERIODO_MS * 0.6;
    if (golpe) {
      this.ultimoGolpe = ahora;
    }
    return golpe;
  }

  private pintar(): void {
    this.host.nativeElement.style.setProperty('--pulso', this.pulso.toFixed(3));

    // Cada letra brinca un poquito después que la anterior: una ola que recorre la palabra.
    const meneo = Math.sin(this.fase * Math.PI);
    this.letrasRef().forEach((ref, i) => {
      const p = this.fase - i * 0.12;
      const caida = 1 - (p - Math.floor(p));
      const salto = caida * caida * (20 + 18 * this.pulso);
      const giro = meneo * (i % 2 === 0 ? 8 : -8);
      const escala = 1 + 0.25 * this.pulso * caida;
      ref.nativeElement.style.transform = `translateY(${-salto}px) rotate(${giro}deg) scale(${escala})`;
    });
  }

  /** Volvieron a cargar datos mientras se desvanecía: regresa sin desmontarse. */
  private volver(): void {
    if (!this.saliendo()) {
      return;
    }
    clearTimeout(this.temporizadorSalida);
    this.saliendo.set(false);
    if (this.contexto && this.ganancia) {
      this.ganancia.gain.cancelScheduledValues(this.contexto.currentTime);
      this.ganancia.gain.setTargetAtTime(1, this.contexto.currentTime, 0.05);
    }
    this.audio.volume = 1;
  }

  private cerrar(): void {
    if (this.saliendo()) {
      return;
    }
    this.saliendo.set(true);
    if (this.contexto && this.ganancia) {
      this.ganancia.gain.setTargetAtTime(0, this.contexto.currentTime, SALIDA_MS / 4000);
    } else {
      this.audio.volume = 0;
    }
    this.temporizadorSalida = setTimeout(() => this.terminada.emit(), SALIDA_MS);
  }
}
