import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { CambioCita, Cita, Disponibilidad, EstadoCita, SolicitudCita } from '../models';
import { zonaHorariaLocal } from '../util/fechas.util';


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
    const cambios: CambioCita = notasMedico !== undefined ? { estado, notasMedico } : { estado };
    return this.api.put<Cita>(`/citas/${idCita}`, cambios);
  }

  reprogramar(idCita: string, fechaHora: string): Promise<Cita> {
    const cambios: CambioCita = { fechaHora };
    return this.api.put<Cita>(`/citas/${idCita}`, cambios);
  }
}
