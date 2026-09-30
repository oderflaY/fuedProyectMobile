// Cuerpos que se envían a `/alertas`.

import type { EstadoAlerta } from './alerta.types';

/** Cuerpo de `PUT /alertas/{id}`: el médico la marca vista o atendida. */
export interface AtencionAlerta {
  estado: Exclude<EstadoAlerta, 'nueva'>;
  notasMedico?: string;
}
