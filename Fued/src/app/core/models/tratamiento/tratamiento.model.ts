// Respuestas de `/pacientes/{id}/tratamientos`: recetas y sus existencias.

/** Existencias del medicamento; por debajo del umbral se avisa al paciente. */
export interface Inventario {
  cantidadRestante: number;
  umbralAlerta: number;
}

/** Receta vigente o pasada; `activo` es false cuando ya se suspendió. */
export interface Tratamiento {
  idTratamiento: string;
  medicamento: string;
  dosis: string;
  frecuenciaHoras: number;
  /** Horas locales `HH:mm` en que toca la toma. */
  horariosSugeridos: string[];
  viaAdministracion: string;
  fechaInicio: string;
  fechaFin: string | null;
  /** null cuando lo capturó el propio paciente. */
  idMedicoReceta: string | null;
  inventario: Inventario;
  activo: boolean;
}
