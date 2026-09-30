import { Injectable, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type { CondicionCronica, Cuestionario, PerfilCronico, RespuestasCuestionario } from '../../../core/models';
import { SegmentacionRepository } from '../../../core/repositories/segmentacion.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

@Injectable()
export class SegmentacionViewModel {
  private readonly repo = inject(SegmentacionRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly perfiles = signal<PerfilCronico[]>([]);
  readonly catalogo = signal<Cuestionario[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  private get idPaciente(): string {
    return this.sesion.usuario()?.id ?? '';
  }

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      const [perfiles, catalogo] = await Promise.all([this.repo.perfiles(this.idPaciente), this.repo.catalogo()]);
      this.perfiles.set(perfiles);
      this.catalogo.set(catalogo);
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Condiciones del catálogo que el paciente todavía no ha declarado. */
  disponibles(): Cuestionario[] {
    const declaradas = new Set(this.perfiles().map((p) => p.condicion));
    return this.catalogo().filter((c) => !declaradas.has(c.condicion));
  }

  cuestionarioDe(condicion: CondicionCronica): Cuestionario | undefined {
    return this.catalogo().find((c) => c.condicion === condicion);
  }

  async declarar(condicion: CondicionCronica, datosBasales: RespuestasCuestionario): Promise<boolean> {
    try {
      await this.repo.declarar(this.idPaciente, condicion, datosBasales);
      await this.cargar();
      await this.avisos.exito('cronicas_condicion_agregada');
      return true;
    } catch (error) {
      await this.avisos.error(error);
      return false;
    }
  }

  async archivar(perfil: PerfilCronico): Promise<void> {
    try {
      await this.repo.actualizar(this.idPaciente, perfil.condicion, { estado: 'archivado' });
      await this.cargar();
      await this.avisos.exito('cronicas_condicion_archivada');
    } catch (error) {
      await this.avisos.error(error);
    }
  }
}
