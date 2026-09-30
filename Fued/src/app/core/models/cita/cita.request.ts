// Cuerpos que se envían a `/citas`.

import type { EstadoCita } from './cita.types';

/** Cuerpo de `POST /citas`: se manda `idMedico` o `idPaciente` según quién agenda. */
export interface SolicitudCita {
  fechaHora: string;
  motivo: string;
  idMedico?: string;
  idPaciente?: string;
}

/** Cuerpo de `PUT /citas/{id}`: confirmar, cancelar, cerrar o reprogramar. */
export interface CambioCita {
  estado?: EstadoCita;
  notasMedico?: string | null;
  fechaHora?: string;
}
