// Respuestas de `/chat`: la bandeja y los mensajes de una charla.

import type { Rol } from '../sesion/sesion.types';
import type { Remitente, TipoMensaje } from './chat.types';

/** Fila de la bandeja: la contraparte y el estado de la charla. */
export interface Conversacion {
  idContraparte: string;
  rolContraparte: Rol;
  nombre: string;
  subtitulo: string | null;
  ultimoMensaje: string | null;
  tipoUltimoMensaje: TipoMensaje | null;
  fechaUltimoMensaje: string | null;
  noLeidos: number;
}

/** Archivo que viaja con un mensaje (audio dictado, foto, documento). */
export interface AdjuntoMensaje {
  nombre: string;
  mime: string;
  bytes: number;
  /** Sólo en audio; null en el resto. */
  duracionSeg: number | null;
  /** Ruta en la API; se descarga con el token de sesión. */
  url: string;
}

export interface Mensaje {
  idMensaje: string;
  remitente: Remitente;
  /** true cuando lo escribió quien tiene la sesión abierta. */
  propio: boolean;
  tipo: TipoMensaje;
  contenido: string;
  adjunto: AdjuntoMensaje | null;
  fechaEnvio: string;
  leido: boolean;
}
