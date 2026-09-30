import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { Conversacion, DatosAdjunto, Mensaje, NuevoMensaje } from '../models';

@Injectable({ providedIn: 'root' })
export class ChatRepository {
  private readonly api = inject(ApiService);

  conversaciones(): Promise<Conversacion[]> {
    return this.api.get<Conversacion[]>('/chat/conversaciones');
  }

  mensajes(idContraparte: string, despuesDe?: string): Promise<Mensaje[]> {
    return this.api.get<Mensaje[]>(`/chat/${idContraparte}/mensajes`, { despuesDe });
  }

  enviar(idContraparte: string, contenido: string): Promise<Mensaje> {
    const mensaje: NuevoMensaje = { contenido };
    return this.api.post<Mensaje>(`/chat/${idContraparte}/mensajes`, mensaje);
  }

  /** Envía una nota de voz, un PDF, una foto o un documento. */
  enviarAdjunto(idContraparte: string, archivo: File, opciones: DatosAdjunto = {}): Promise<Mensaje> {
    const datos = new FormData();
    datos.append('archivo', archivo, archivo.name);
    if (opciones.contenido) {
      datos.append('contenido', opciones.contenido);
    }
    if (opciones.duracionSeg) {
      datos.append('duracionSeg', String(Math.round(opciones.duracionSeg)));
    }
    return this.api.post<Mensaje>(`/chat/${idContraparte}/adjuntos`, datos);
  }

  descargarAdjunto(ruta: string): Promise<Blob> {
    return this.api.getBlob(ruta);
  }
}
