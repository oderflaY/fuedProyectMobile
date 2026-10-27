import { Injectable } from '@angular/core';

/** Notas en Hz que usan las melodías. */
const NOTA = { C5: 523.25, E5: 659.25, G4: 392.0, Bb3: 233.08, A3: 220.0, Ab3: 207.65, G3: 196.0 };

/**
 * Efectos de sonido "de barrio", sintetizados con Web Audio: no hay archivos que cargar.
 * Los navegadores sólo dejan sonar audio después de un toque, y todos estos se disparan por uno.
 */
@Injectable({ providedIn: 'root' })
export class SonidosService {
  private contexto: AudioContext | null = null;

  /** Claxon de "La Cucaracha" al entrar. */
  claxon(): void {
    const { G4, C5, E5 } = NOTA;
    const melodia: [number, number][] = [[G4, 0.13], [G4, 0.13], [G4, 0.13], [C5, 0.38], [E5, 0.3], [G4, 0.13], [G4, 0.13], [G4, 0.13], [C5, 0.38], [E5, 0.45]];
    this.tocar((ctx, inicio) => {
      let t = inicio;
      for (const [frecuencia, duracion] of melodia) {
        // Dos bocinas ligeramente desafinadas: suena a claxon de lámina, no a teclado.
        for (const desafine of [0, 6]) {
          this.tono(ctx, 'square', frecuencia + desafine, t, duracion * 0.9, 0.07);
        }
        t += duracion;
      }
    });
  }

  /** Silbatazo de árbitro al salir. */
  silbatazo(): void {
    this.tocar((ctx, inicio) => {
      const osc = ctx.createOscillator();
      const vibrato = ctx.createOscillator();
      const profundidad = ctx.createGain();
      const volumen = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 2900;
      vibrato.frequency.value = 38;
      profundidad.gain.value = 140;
      vibrato.connect(profundidad).connect(osc.frequency);
      volumen.gain.setValueAtTime(0, inicio);
      volumen.gain.linearRampToValueAtTime(0.18, inicio + 0.02);
      volumen.gain.setValueAtTime(0.18, inicio + 0.5);
      volumen.gain.exponentialRampToValueAtTime(0.001, inicio + 0.6);
      osc.connect(volumen).connect(ctx.destination);
      osc.start(inicio);
      vibrato.start(inicio);
      osc.stop(inicio + 0.62);
      vibrato.stop(inicio + 0.62);
    });
  }

  /** Campana de ring de box: dos campanazos cuando algo sale bien. */
  campana(): void {
    this.tocar((ctx, inicio) => {
      for (const golpe of [0, 0.22]) {
        // Parciales inarmónicos: lo que distingue una campana de un tono limpio.
        for (const [relacion, nivel] of [[1, 0.2], [2.76, 0.09], [5.4, 0.05], [8.93, 0.025]] as const) {
          this.tono(ctx, 'sine', 1180 * relacion, inicio + golpe, 1.1, nivel, true);
        }
      }
    });
  }

  /** Timbre de "¡bajan!" del microbús en los botones principales. */
  timbre(): void {
    this.tocar((ctx, inicio) => {
      this.tono(ctx, 'triangle', 1568, inicio, 0.09, 0.12);
      this.tono(ctx, 'triangle', 1318.5, inicio + 0.1, 0.16, 0.12);
    });
  }

  /** Trompeta triste ("wa, wa, wa, waaa") cuando algo falla. */
  trompetaTriste(): void {
    const { Bb3, A3, Ab3, G3 } = NOTA;
    const notas: [number, number][] = [[Bb3, 0.32], [A3, 0.32], [Ab3, 0.32], [G3, 0.9]];
    this.tocar((ctx, inicio) => {
      let t = inicio;
      for (const [i, [frecuencia, duracion]] of notas.entries()) {
        const osc = ctx.createOscillator();
        const filtro = ctx.createBiquadFilter();
        const volumen = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(frecuencia, t);
        // La última nota se cae y tiembla, como trombón con sordina.
        if (i === notas.length - 1) {
          const lfo = ctx.createOscillator();
          const profundidad = ctx.createGain();
          lfo.frequency.value = 6;
          profundidad.gain.value = 5;
          lfo.connect(profundidad).connect(osc.frequency);
          lfo.start(t);
          lfo.stop(t + duracion);
          osc.frequency.linearRampToValueAtTime(frecuencia * 0.94, t + duracion);
        }
        filtro.type = 'lowpass';
        filtro.Q.value = 6;
        filtro.frequency.setValueAtTime(400, t);
        filtro.frequency.linearRampToValueAtTime(1500, t + duracion * 0.4);
        filtro.frequency.linearRampToValueAtTime(500, t + duracion);
        volumen.gain.setValueAtTime(0, t);
        volumen.gain.linearRampToValueAtTime(0.16, t + 0.04);
        volumen.gain.setValueAtTime(0.16, t + duracion * 0.8);
        volumen.gain.linearRampToValueAtTime(0, t + duracion);
        osc.connect(filtro).connect(volumen).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + duracion);
        t += duracion + 0.03;
      }
    });
  }

  /** Corre la síntesis con el contexto listo; si el dispositivo no tiene audio, se calla. */
  private tocar(sintetizar: (ctx: AudioContext, inicio: number) => void): void {
    try {
      this.contexto ??= new AudioContext();
      const ctx = this.contexto;
      if (ctx.state === 'suspended') {
        void ctx.resume();
      }
      sintetizar(ctx, ctx.currentTime + 0.02);
    } catch {
      // Sin Web Audio la app funciona igual, sólo sin efectos.
    }
  }

  private tono(ctx: AudioContext, tipo: OscillatorType, frecuencia: number, inicio: number, duracion: number, nivel: number, golpe = false): void {
    const osc = ctx.createOscillator();
    const volumen = ctx.createGain();
    osc.type = tipo;
    osc.frequency.value = frecuencia;
    volumen.gain.setValueAtTime(golpe ? nivel : 0, inicio);
    if (!golpe) {
      volumen.gain.linearRampToValueAtTime(nivel, inicio + 0.01);
    }
    volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
    osc.connect(volumen).connect(ctx.destination);
    osc.start(inicio);
    osc.stop(inicio + duracion + 0.02);
  }
}
