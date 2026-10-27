import { Injectable, computed, signal } from '@angular/core';

/** El baile de bienvenida dura lo justo para verse, sin hacer esperar. */
const MINIMO_INICIAL_MS = 2500;
/** Si la red está lenta, la app se muestra igual y sigue cargando con la barrita. */
const MAXIMO_INICIAL_MS = 6000;

/**
 * Lleva la cuenta de las cargas de datos en curso (ver `cargaInterceptor`).
 * La pantalla de carga con el baile sólo se ve al abrir la app (`visible`);
 * las cargas posteriores sólo encienden la barrita superior (`ocupado`).
 */
@Injectable({ providedIn: 'root' })
export class CargaService {
  readonly visible = signal(true);

  private readonly pendientes = signal(0);
  readonly ocupado = computed(() => this.pendientes() > 0 && !this.visible());

  private readonly desde = performance.now();
  private temporizador?: ReturnType<typeof setTimeout>;

  constructor() {
    this.programarCierre();
    setTimeout(() => this.ocultar(), MAXIMO_INICIAL_MS);
  }

  inicio(): void {
    this.pendientes.update((n) => n + 1);
    clearTimeout(this.temporizador);
  }

  fin(): void {
    this.pendientes.update((n) => Math.max(0, n - 1));
    if (this.pendientes() === 0 && this.visible()) {
      this.programarCierre();
    }
  }

  /** El usuario tocó la pantalla para saltarse el baile. */
  ocultar(): void {
    clearTimeout(this.temporizador);
    this.visible.set(false);
  }

  private programarCierre(): void {
    clearTimeout(this.temporizador);
    const restante = Math.max(0, this.desde + MINIMO_INICIAL_MS - performance.now());
    this.temporizador = setTimeout(() => {
      if (this.pendientes() === 0) {
        this.visible.set(false);
      }
    }, restante);
  }
}
