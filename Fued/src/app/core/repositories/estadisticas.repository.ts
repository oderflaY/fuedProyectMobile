import { Injectable, inject } from '@angular/core';
import { ApiError, ApiService } from '../api/api.service';
import type { EstadisticasSistema } from '../models';

/** Todo el tablero en una sola consulta: GraphQL deja pedir exactamente los campos que se grafican. */
const CONSULTA_ESTADISTICAS = `
  query Estadisticas($meses: Int!) {
    resumen { pacientes medicos citas metricasVitales tomas tratamientos perfilesCronicos alertas }
    pacientesPorGenero { clave valor }
    pacientesPorEdad { clave valor }
    pacientesPorTipoSangre { clave valor }
    registrosPorMes(meses: $meses) { mes pacientes medicos }
    citasPorMes(meses: $meses) { mes completadas canceladas pendientes confirmadas total }
    adherenciaPorMes(meses: $meses) { mes tomado tomadoTarde omitido porcentaje }
    signosVitalesPorMes(meses: $meses) { mes glucosa frecuenciaCardiaca sistolica diastolica imc tomas }
    segmentosPorCondicion { condicion controlado seguimiento riesgo sinClasificar }
    alertasPorSeveridad { clave valor }
    alertasPorOrigen { clave valor }
    medicosPorEspecialidad { clave valor }
    topMedicos(limite: 8) { nombre especialidad pacientes citas }
  }
`;

interface RespuestaGraphql<T> {
  data?: T;
  errors?: { message: string }[];
}

/** Estadísticas de todo el sistema, servidas por `POST /graphql`. */
@Injectable({ providedIn: 'root' })
export class EstadisticasRepository {
  private readonly api = inject(ApiService);

  async delSistema(meses: number): Promise<EstadisticasSistema> {
    return this.consultar<EstadisticasSistema>(CONSULTA_ESTADISTICAS, { meses });
  }

  private async consultar<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const respuesta = await this.api.post<RespuestaGraphql<T>>('/graphql', { query, variables });
    if (respuesta.errors?.length || !respuesta.data) {
      throw new ApiError(200, 'graphql', respuesta.errors?.map((e) => e.message).join('; ') ?? 'Respuesta GraphQL vacía');
    }
    return respuesta.data;
  }
}
