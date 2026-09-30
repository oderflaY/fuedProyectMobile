import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { Audiencia, CambioPrivacidad, Exportacion, TableroPrivacidad } from '../models';

/** Preferencias de privacidad del expediente. Sólo las consulta el propio paciente. */
@Injectable({ providedIn: 'root' })
export class PrivacidadRepository {
  private readonly api = inject(ApiService);

  tablero(idPaciente: string): Promise<TableroPrivacidad> {
    return this.api.get<TableroPrivacidad>(`/pacientes/${idPaciente}/privacidad`);
  }

  /** El servidor rechaza las secciones que no son configurables en esa audiencia. */
  guardar(idPaciente: string, audiencia: Audiencia, secciones: Record<string, boolean>): Promise<TableroPrivacidad> {
    const cambio: CambioPrivacidad = { audiencia, secciones };
    return this.api.put<TableroPrivacidad>(`/pacientes/${idPaciente}/privacidad`, cambio);
  }

  exportar(idPaciente: string): Promise<Exportacion> {
    return this.api.get<Exportacion>(`/pacientes/${idPaciente}/exportacion`);
  }
}
