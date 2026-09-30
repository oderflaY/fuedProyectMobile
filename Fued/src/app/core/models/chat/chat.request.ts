// Cuerpos que se envían a `/chat`.
// El adjunto no está aquí: viaja como `FormData`, no como JSON.

/** Cuerpo de `POST /chat/{id}/mensajes`. */
export interface NuevoMensaje {
  contenido: string;
}

/** Campos que acompañan al archivo en `POST /chat/{id}/adjuntos`. */
export interface DatosAdjunto {
  contenido?: string;
  /** Sólo en notas de voz; se manda redondeado a segundos. */
  duracionSeg?: number;
}
