import { Injectable, inject, signal } from '@angular/core';
import { ChatRepository } from '../repositories/chat.repository';
import type { Mensaje } from '../models';

/**
 * Descarga los adjuntos del chat con el token de sesión y los mantiene como
 * URLs locales para reproducirlos o abrirlos sin volver a pedirlos.
 */
@Injectable()
export class AdjuntosService {
  private readonly chat = inject(ChatRepository);
  private readonly urls = signal<Record<string, string>>({});
  private readonly enCurso = new Set<string>();

  url(idMensaje: string): string | null {
    return this.urls()[idMensaje] ?? null;
  }

  /** Descarga el adjunto una sola vez y publica su URL local. */
  async precargar(mensaje: Mensaje): Promise<string | null> {
    if (!mensaje.adjunto) {
      return null;
    }
    const existente = this.url(mensaje.idMensaje);
    if (existente) {
      return existente;
    }
    if (this.enCurso.has(mensaje.idMensaje)) {
      return null;
    }
    this.enCurso.add(mensaje.idMensaje);
    try {
      const blob = await this.chat.descargarAdjunto(mensaje.adjunto.url);
      const url = URL.createObjectURL(blob);
      this.urls.update((actuales) => ({ ...actuales, [mensaje.idMensaje]: url }));
      return url;
    } finally {
      this.enCurso.delete(mensaje.idMensaje);
    }
  }

  liberar(): void {
    for (const url of Object.values(this.urls())) {
      URL.revokeObjectURL(url);
    }
    this.urls.set({});
  }
}
