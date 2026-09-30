// Cuerpos que se envían a `/pacientes`.

import type { NivelAcceso } from './paciente.types';

/** Cuerpo de `POST /pacientes/{id}/accesos`: a qué médico se le abre el expediente. */
export interface NuevoAcceso {
  idMedico: string;
  nivelAcceso: NivelAcceso;
}
