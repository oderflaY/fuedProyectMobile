import { Injectable, computed, inject, signal } from '@angular/core';
import type { EstadoRiesgo, PerfilMedico } from '../../../core/models';
import { MedicosRepository } from '../../../core/repositories/medicos.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

/** Los de riesgo alto encabezan la lista: es el orden en que hay que atenderlos. */
const ORDEN_RIESGO: Record<EstadoRiesgo, number> = { alto: 0, medio: 1, bajo: 2 };

/** Estado del tablero de pacientes del médico: la lista, su búsqueda y su conteo. */
@Injectable()
export class PacientesViewModel {
  private readonly medicos = inject(MedicosRepository);
  private readonly avisos = inject(AvisosService);

  readonly perfil = signal<PerfilMedico | null>(null);
  readonly busqueda = signal('');
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  /** Sin cédula aprobada no hay pacientes que mostrar. */
  readonly verificado = computed(() => this.perfil()?.credenciales.estadoVerificacion === 'aprobado');
  readonly pacientes = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase();
    return [...(this.perfil()?.pacientesVinculados ?? [])]
      .filter((p) => p.nombreCompleto.toLocaleLowerCase().includes(texto))
      .sort((a, b) => ORDEN_RIESGO[a.estadoRiesgo] - ORDEN_RIESGO[b.estadoRiesgo] || a.nombreCompleto.localeCompare(b.nombreCompleto));
  });
  /** Cuántos hay por nivel de riesgo; la búsqueda no lo altera. */
  readonly conteo = computed(() => {
    const conteo: Record<EstadoRiesgo, number> = { alto: 0, medio: 0, bajo: 0 };
    for (const p of this.perfil()?.pacientesVinculados ?? []) {
      conteo[p.estadoRiesgo]++;
    }
    return conteo;
  });

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      this.perfil.set(await this.medicos.miPerfil());
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }
}
