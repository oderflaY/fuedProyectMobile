import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type { AgendaTomas, Cita, Metrica, NuevaMetrica, TomaDelDia } from '../../../core/models';
import { CitasRepository } from '../../../core/repositories/citas.repository';
import { PacientesRepository } from '../../../core/repositories/pacientes.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import { fechaLocalIso, sumarDias } from '../../../core/util/fechas';

export function claveToma(toma: TomaDelDia): string {
  return `${toma.idTratamiento}|${toma.fechaHoraProgramada}`;
}

@Injectable()
export class InicioViewModel {
  private readonly pacientes = inject(PacientesRepository);
  private readonly citas = inject(CitasRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly usuario = this.sesion.usuario;
  readonly fecha = signal(fechaLocalIso());
  readonly agenda = signal<AgendaTomas | null>(null);
  readonly proximaCita = signal<Cita | null>(null);
  readonly ultimaMetrica = signal<Metrica | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly tomaEnProceso = signal<string | null>(null);

  readonly esHoy = computed(() => this.fecha() === fechaLocalIso());
  readonly progreso = computed(() => {
    const agenda = this.agenda();
    if (!agenda || agenda.tomas.length === 0) {
      return 0;
    }
    return (agenda.tomas.length - agenda.resumen.pendientes) / agenda.tomas.length;
  });

  private get idPaciente(): string {
    return this.sesion.usuario()?.id ?? '';
  }

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      const [agenda, citas, metricas] = await Promise.all([
        this.pacientes.tomasDelDia(this.idPaciente, this.fecha()),
        this.citas.listar({ proximas: true }),
        this.pacientes.metricas(this.idPaciente, 1),
      ]);
      this.agenda.set(agenda);
      this.proximaCita.set(citas[0] ?? null);
      this.ultimaMetrica.set(metricas[0] ?? null);
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  async cambiarDia(dias: number): Promise<void> {
    this.fecha.update((fecha) => sumarDias(fecha, dias));
    try {
      this.agenda.set(await this.pacientes.tomasDelDia(this.idPaciente, this.fecha()));
    } catch (error) {
      await this.avisos.error(error);
    }
  }

  async marcarToma(toma: TomaDelDia, estado: 'tomado' | 'omitido', sintomas?: string | null): Promise<void> {
    this.tomaEnProceso.set(claveToma(toma));
    try {
      const resultado = await this.pacientes.registrarToma(this.idPaciente, {
        idTratamiento: toma.idTratamiento,
        fechaHoraProgramada: toma.fechaHoraProgramada,
        estado,
        sintomasAsociados: sintomas ?? toma.registro?.sintomasAsociados ?? null,
      });
      this.agenda.set(await this.pacientes.tomasDelDia(this.idPaciente, this.fecha()));
      if (resultado.alertaInventario) {
        await this.avisos.info('inicio_aviso_inventario', { medicamento: toma.medicamento, cantidad: resultado.inventario.cantidadRestante });
      } else {
        await this.avisos.exito(resultado.registro.estado === 'omitido' ? 'inicio_toma_omitida' : 'inicio_toma_registrada');
      }
    } catch (error) {
      await this.avisos.error(error);
    } finally {
      this.tomaEnProceso.set(null);
    }
  }

  async registrarMetrica(metrica: NuevaMetrica): Promise<void> {
    try {
      this.ultimaMetrica.set(await this.pacientes.registrarMetrica(this.idPaciente, metrica));
      await this.avisos.exito('metrica_guardada');
    } catch (error) {
      await this.avisos.error(error);
    }
  }
}
