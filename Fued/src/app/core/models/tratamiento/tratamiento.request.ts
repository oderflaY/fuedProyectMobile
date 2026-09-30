// Cuerpos que se envían a `/pacientes/{id}/tratamientos` y `/tratamientos/{id}`.

import type { Inventario } from './tratamiento.model';

/** Cuerpo del alta; al editar se manda un `Partial` de esto. */
export interface NuevoTratamiento {
  medicamento: string;
  dosis: string;
  frecuenciaHoras: number;
  horariosSugeridos?: string[];
  viaAdministracion: string;
  fechaInicio?: string;
  fechaFin?: string | null;
  inventario: Inventario;
}
