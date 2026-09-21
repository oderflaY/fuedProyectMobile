import { Injectable, signal } from '@angular/core';

// Tipos mínimos de la Web Speech API (no están en las definiciones estándar de TypeScript).
interface ResultadoDictado {
  readonly isFinal: boolean;
  readonly length: number;
  item(indice: number): { transcript: string };
  [indice: number]: { transcript: string };
}

interface EventoDictado {
  readonly resultIndex: number;
  readonly results: { readonly length: number; item(indice: number): ResultadoDictado; [indice: number]: ResultadoDictado };
}

interface ReconocimientoVoz {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((evento: EventoDictado) => void) | null;
  onend: (() => void) | null;
  onerror: ((evento: { error: string }) => void) | null;
}

type ConstructorReconocimiento = new () => ReconocimientoVoz;

function obtenerConstructor(): ConstructorReconocimiento | null {
  const ventana = window as unknown as {
    SpeechRecognition?: ConstructorReconocimiento;
    webkitSpeechRecognition?: ConstructorReconocimiento;
  };
  return ventana.SpeechRecognition ?? ventana.webkitSpeechRecognition ?? null;
}

/**
 * Dictado por voz del teléfono (Web Speech API).
 * Si el dispositivo no lo expone, el usuario siempre puede usar el micrófono
 * de su propio teclado: `soportado` permite avisarlo en la interfaz.
 */
@Injectable({ providedIn: 'root' })
export class DictadoService {
  readonly escuchando = signal(false);
  readonly soportado = obtenerConstructor() !== null;

  private reconocimiento: ReconocimientoVoz | null = null;

  /**
   * Escucha y va entregando el texto reconocido.
   * @param alTranscribir recibe el texto acumulado (parcial y definitivo).
   */
  iniciar(locale: string, alTranscribir: (texto: string, definitivo: boolean) => void, alFallar?: (codigo: string) => void): void {
    const Constructor = obtenerConstructor();
    if (!Constructor || this.escuchando()) {
      return;
    }
    const reconocimiento = new Constructor();
    reconocimiento.lang = locale;
    reconocimiento.continuous = true;
    reconocimiento.interimResults = true;

    reconocimiento.onresult = (evento) => {
      let texto = '';
      let definitivo = false;
      for (let i = evento.resultIndex; i < evento.results.length; i++) {
        const resultado = evento.results[i];
        texto += resultado[0].transcript;
        definitivo = definitivo || resultado.isFinal;
      }
      alTranscribir(texto.trim(), definitivo);
    };
    reconocimiento.onerror = (evento) => {
      this.escuchando.set(false);
      alFallar?.(evento.error);
    };
    reconocimiento.onend = () => this.escuchando.set(false);

    this.reconocimiento = reconocimiento;
    reconocimiento.start();
    this.escuchando.set(true);
  }

  detener(): void {
    this.reconocimiento?.stop();
    this.reconocimiento = null;
    this.escuchando.set(false);
  }
}
