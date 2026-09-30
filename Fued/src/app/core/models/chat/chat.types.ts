/** Uniones de la mensajería. */

import type { Rol } from '../sesion/sesion.types';

export type TipoMensaje = 'texto' | 'audio' | 'imagen' | 'archivo';

/** Quién escribió: `sistema` son los avisos automáticos, no son propios de nadie. */
export type Remitente = Rol | 'sistema';
