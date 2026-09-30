import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type {
  AgendaTomas,
  Coleccion,
  DispositivoRfid,
  ElementoDescripcion,
  Expediente,
  HistorialAdherencia,
  MedicoAutorizado,
  Metrica,
  NivelAcceso,
  NuevaMetrica,
  NuevaToma,
  NuevoAcceso,
  NuevoTratamiento,
  ResultadoToma,
  Tratamiento,
} from '../models';
import { zonaHorariaLocal } from '../util/fechas.util';

@Injectable({ providedIn: 'root' })
export class PacientesRepository {
  private readonly api = inject(ApiService);

  expediente(idPaciente: string): Promise<Expediente> {
    return this.api.get<Expediente>(`/pacientes/${idPaciente}`);
  }

  actualizar(idPaciente: string, cambios: Record<string, unknown>): Promise<Expediente> {
    return this.api.put<Expediente>(`/pacientes/${idPaciente}`, cambios);
  }

  listarColeccion<T = ElementoDescripcion>(idPaciente: string, coleccion: Coleccion): Promise<T[]> {
    return this.api.get<T[]>(`/pacientes/${idPaciente}/${coleccion}`);
  }

  agregarAColeccion(idPaciente: string, coleccion: Coleccion, datos: Record<string, unknown>): Promise<unknown> {
    return this.api.post(`/pacientes/${idPaciente}/${coleccion}`, datos);
  }

  eliminarDeColeccion(idPaciente: string, coleccion: Coleccion, idElemento: string): Promise<void> {
    return this.api.delete(`/pacientes/${idPaciente}/${coleccion}/${idElemento}`);
  }

  // Tarjetas RFID
  asignarRfid(idPaciente: string, idTarjetaRfid?: string): Promise<DispositivoRfid> {
    return this.api.post<DispositivoRfid>(`/pacientes/${idPaciente}/rfid`, idTarjetaRfid ? { idTarjetaRfid } : {});
  }

  reportarRfidExtraviada(idPaciente: string, idTarjetaRfid: string): Promise<DispositivoRfid[]> {
    return this.api.put<DispositivoRfid[]>(`/pacientes/${idPaciente}/rfid/${idTarjetaRfid}`, { estado: 'extraviada' });
  }

  // Control de accesos
  otorgarAcceso(idPaciente: string, idMedico: string, nivelAcceso: NivelAcceso): Promise<MedicoAutorizado[]> {
    const acceso: NuevoAcceso = { idMedico, nivelAcceso };
    return this.api.post<MedicoAutorizado[]>(`/pacientes/${idPaciente}/accesos`, acceso);
  }

  revocarAcceso(idPaciente: string, idMedico: string): Promise<void> {
    return this.api.delete(`/pacientes/${idPaciente}/accesos/${idMedico}`);
  }

  // Tratamientos
  tratamientos(idPaciente: string): Promise<Tratamiento[]> {
    return this.api.get<Tratamiento[]>(`/pacientes/${idPaciente}/tratamientos`);
  }

  recetar(idPaciente: string, tratamiento: NuevoTratamiento): Promise<Tratamiento> {
    return this.api.post<Tratamiento>(`/pacientes/${idPaciente}/tratamientos`, tratamiento, { tz: zonaHorariaLocal() });
  }

  actualizarTratamiento(idTratamiento: string, cambios: Partial<NuevoTratamiento>): Promise<Tratamiento> {
    return this.api.put<Tratamiento>(`/tratamientos/${idTratamiento}`, cambios);
  }

  suspenderTratamiento(idTratamiento: string): Promise<void> {
    return this.api.delete(`/tratamientos/${idTratamiento}`, { tz: zonaHorariaLocal() });
  }

  // Tomas diarias
  tomasDelDia(idPaciente: string, fecha: string): Promise<AgendaTomas> {
    return this.api.get<AgendaTomas>(`/pacientes/${idPaciente}/tomas`, { fecha, tz: zonaHorariaLocal() });
  }

  registrarToma(idPaciente: string, toma: NuevaToma): Promise<ResultadoToma> {
    return this.api.post<ResultadoToma>(`/pacientes/${idPaciente}/tomas`, toma);
  }

  adherencia(idPaciente: string, desde?: string, hasta?: string): Promise<HistorialAdherencia> {
    return this.api.get<HistorialAdherencia>(`/pacientes/${idPaciente}/adherencia`, { desde, hasta, tz: zonaHorariaLocal() });
  }

  // Signos vitales
  metricas(idPaciente: string, limite = 30): Promise<Metrica[]> {
    return this.api.get<Metrica[]>(`/pacientes/${idPaciente}/metricas`, { limite });
  }

  registrarMetrica(idPaciente: string, metrica: NuevaMetrica): Promise<Metrica> {
    return this.api.post<Metrica>(`/pacientes/${idPaciente}/metricas`, metrica);
  }
}
