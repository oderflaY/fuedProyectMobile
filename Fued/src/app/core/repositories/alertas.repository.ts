import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { Alerta, AtencionAlerta, BandejaAlertas, EstadoAlerta } from '../models';

/** Bandeja de alertas clínicas del médico. */
@Injectable({ providedIn: 'root' })
export class AlertasRepository {
  private readonly api = inject(ApiService);

  bandeja(estado?: EstadoAlerta): Promise<BandejaAlertas> {
    return this.api.get<BandejaAlertas>('/alertas', estado ? { estado } : undefined);
  }

  marcar(idAlerta: string, estado: Exclude<EstadoAlerta, 'nueva'>, notasMedico?: string): Promise<Alerta> {
    const atencion: AtencionAlerta = { estado, notasMedico };
    return this.api.put<Alerta>(`/alertas/${idAlerta}`, atencion);
  }

  /** Transparencia para el paciente: qué se envió en su nombre. */
  delPaciente(idPaciente: string): Promise<Alerta[]> {
    return this.api.get<Alerta[]>(`/pacientes/${idPaciente}/alertas`);
  }
}
