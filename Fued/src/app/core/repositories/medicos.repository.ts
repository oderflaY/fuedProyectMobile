import { Injectable, inject } from '@angular/core';
import { ApiService } from '../api/api.service';
import type { MedicoPublico, PerfilMedico } from '../models';

@Injectable({ providedIn: 'root' })
export class MedicosRepository {
  private readonly api = inject(ApiService);

  directorio(busqueda?: string): Promise<MedicoPublico[]> {
    return this.api.get<MedicoPublico[]>('/medicos', { q: busqueda });
  }

  miPerfil(): Promise<PerfilMedico> {
    return this.api.get<PerfilMedico>('/medicos/yo');
  }

  actualizarMiPerfil(cambios: Record<string, unknown>): Promise<PerfilMedico> {
    return this.api.put<PerfilMedico>('/medicos/yo', cambios);
  }
}
