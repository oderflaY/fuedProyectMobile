// Cuerpos que se envían a `/pacientes`.

import type { CategoriaDocumento, NivelAcceso, OrigenDocumento } from './paciente.types';
import type { MetadatosDocumento } from './paciente.model';

/** Cuerpo de `POST /pacientes/{id}/accesos`: a qué médico se le abre el expediente. */
export interface NuevoAcceso {
  idMedico: string;
  nivelAcceso: NivelAcceso;
}

/** Campos que acompañan al archivo en `POST /pacientes/{id}/documentos` (multipart). */
export interface NuevoDocumento {
  titulo: string;
  categoria: CategoriaDocumento;
  origen: OrigenDocumento;
  fechaDocumento: string | null;
  notas: string | null;
  metadatos: MetadatosDocumento | null;
}
