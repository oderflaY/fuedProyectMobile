// Cuerpos que se envían a `/pacientes/{id}/tomas`.

import type { EstadoToma } from './adherencia.types';

/** Cuerpo de `POST`: el paciente marca `tomado` u `omitido`; el retraso lo decide la API. */
export interface NuevaToma {
  idTratamiento: string;
  fechaHoraProgramada: string;
  estado: Exclude<EstadoToma, 'tomado_tarde'>;
  sintomasAsociados?: string | null;
}
