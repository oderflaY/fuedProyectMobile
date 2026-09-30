import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type { Audiencia, SeccionPrivacidad, TableroPrivacidad } from '../../../core/models';
import { PrivacidadRepository } from '../../../core/repositories/privacidad.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

@Injectable()
export class PrivacidadViewModel {
  private readonly repo = inject(PrivacidadRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly tablero = signal<TableroPrivacidad | null>(null);
  readonly audiencia = signal<Audiencia>('medico');
  readonly cargando = signal(true);
  readonly guardando = signal<string | null>(null);
  readonly error = signal<string | null>(null);

  /** Sólo las secciones que aplican a la audiencia elegida. */
  readonly secciones = computed<SeccionPrivacidad[]>(() =>
    (this.tablero()?.secciones ?? []).filter((seccion) => seccion.audiencias[this.audiencia()] !== undefined),
  );

  /** Las que el paciente no puede apagar; se muestran aparte para que sepa por qué. */
  readonly fijas = computed(() => this.secciones().filter((s) => s.audiencias[this.audiencia()]?.regla === 'siempre'));
  readonly configurables = computed(() =>
    this.secciones().filter((s) => s.audiencias[this.audiencia()]?.regla === 'configurable'),
  );
  readonly ocultas = computed(() => this.configurables().filter((s) => !s.audiencias[this.audiencia()]?.visible).length);

  private get idPaciente(): string {
    return this.sesion.usuario()?.id ?? '';
  }

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      this.tablero.set(await this.repo.tablero(this.idPaciente));
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarAudiencia(audiencia: Audiencia): void {
    this.audiencia.set(audiencia);
  }

  visible(seccion: SeccionPrivacidad): boolean {
    return seccion.audiencias[this.audiencia()]?.visible ?? true;
  }

  async alternar(seccion: SeccionPrivacidad, visible: boolean): Promise<void> {
    if (this.visible(seccion) === visible) {
      return;
    }
    this.guardando.set(seccion.seccion);
    try {
      this.tablero.set(await this.repo.guardar(this.idPaciente, this.audiencia(), { [seccion.seccion]: visible }));
      await this.avisos.exito(visible ? 'privacidad_seccion_visible' : 'privacidad_seccion_oculta');
    } catch (error) {
      await this.avisos.error(error);
      // El tablero del servidor manda: si el cambio no se guardó, el interruptor vuelve a su sitio.
      await this.cargar();
    } finally {
      this.guardando.set(null);
    }
  }
}
