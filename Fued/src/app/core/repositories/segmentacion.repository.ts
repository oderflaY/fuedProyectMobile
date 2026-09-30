import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type {
  CambioPerfilCronico,
  CondicionCronica,
  Cuestionario,
  Evaluacion,
  NuevaEvaluacion,
  NuevoPerfilCronico,
  PerfilCronico,
  RespuestasCuestionario,
  ResultadoEvaluacion,
} from '../models';

/** Enfermedades crónicas del paciente y su cuestionario de seguimiento. */
@Injectable({ providedIn: 'root' })
export class SegmentacionRepository {
  private readonly api = inject(ApiService);

  /** Catálogo completo: la app no decide qué se pregunta, sólo lo pinta. */
  catalogo(): Promise<Cuestionario[]> {
    return this.api.get<Cuestionario[]>('/segmentacion/catalogo');
  }

  perfiles(idPaciente: string): Promise<PerfilCronico[]> {
    return this.api.get<PerfilCronico[]>(`/pacientes/${idPaciente}/cronicas`);
  }

  declarar(idPaciente: string, condicion: CondicionCronica, datosBasales: RespuestasCuestionario): Promise<PerfilCronico> {
    const perfil: NuevoPerfilCronico = { condicion, datosBasales };
    return this.api.post<PerfilCronico>(`/pacientes/${idPaciente}/cronicas`, perfil);
  }

  actualizar(
    idPaciente: string,
    condicion: CondicionCronica,
    cambios: CambioPerfilCronico,
  ): Promise<PerfilCronico> {
    return this.api.put<PerfilCronico>(`/pacientes/${idPaciente}/cronicas/${condicion}`, cambios);
  }

  /** Cuestionario con los datos basales del paciente ya resueltos. */
  cuestionario(idPaciente: string, condicion: CondicionCronica): Promise<Cuestionario> {
    return this.api.get<Cuestionario>(`/pacientes/${idPaciente}/cronicas/${condicion}/cuestionario`);
  }

  responder(idPaciente: string, condicion: CondicionCronica, respuestas: RespuestasCuestionario): Promise<ResultadoEvaluacion> {
    const cuestionario: NuevaEvaluacion = { respuestas };
    return this.api.post<ResultadoEvaluacion>(`/pacientes/${idPaciente}/cronicas/${condicion}/evaluaciones`, cuestionario);
  }

  evaluaciones(idPaciente: string, condicion: CondicionCronica): Promise<Evaluacion[]> {
    return this.api.get<Evaluacion[]>(`/pacientes/${idPaciente}/cronicas/${condicion}/evaluaciones`);
  }
}
