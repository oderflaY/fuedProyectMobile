import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { Cita, Disponibilidad, EstadoCita } from '../models';
import { zonaHorariaLocal } from '../util/fechas';

export interface SolicitudCita {
  fechaHora: string;
  motivo: string;
  idMedico?: string;
  idPaciente?: string;
}

@Injectable({ providedIn: 'root' })
export class CitasRepository {
  private readonly api = inject(ApiService);

  listar(filtro: { estado?: EstadoCita[]; proximas?: boolean } = {}): Promise<Cita[]> {
    return this.api.get<Cita[]>('/citas', {
      estado: filtro.estado?.join(','),
      proximas: filtro.proximas ? 1 : undefined,
    });
  }

  disponibilidad(idMedico: string, fecha: string): Promise<Disponibilidad> {
    return this.api.get<Disponibilidad>('/citas/disponibilidad', { idMedico, fecha, tz: zonaHorariaLocal() });
  }

  crear(solicitud: SolicitudCita): Promise<Cita> {
    return this.api.post<Cita>('/citas', solicitud);
  }

  cambiarEstado(idCita: string, estado: EstadoCita, notasMedico?: string | null): Promise<Cita> {
    return this.api.put<Cita>(`/citas/${idCita}`, notasMedico !== undefined ? { estado, notasMedico } : { estado });
  }

  reprogramar(idCita: string, fechaHora: string): Promise<Cita> {
    return this.api.put<Cita>(`/citas/${idCita}`, { fechaHora });
  }
}
