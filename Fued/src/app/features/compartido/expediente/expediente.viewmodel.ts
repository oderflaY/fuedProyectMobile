import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type {
  Coleccion,
  ElementoDescripcion,
  Expediente,
  HistorialAdherencia,
  Metrica,
  NivelAcceso,
  NuevaMetrica,
  NuevoTratamiento,
  Tratamiento,
} from '../../../core/models';
import { MedicosRepository } from '../../../core/repositories/medicos.repository';
import { PacientesRepository } from '../../../core/repositories/pacientes.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import { edad } from '../../../core/util/fechas.util';

export type Acceso = NivelAcceso | 'propio';

@Injectable()
export class ExpedienteViewModel {
  private readonly repo = inject(PacientesRepository);
  private readonly medicos = inject(MedicosRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly idPaciente = signal('');
  readonly acceso = signal<Acceso | null>(null);
  readonly expediente = signal<Expediente | null>(null);
  readonly condiciones = signal<ElementoDescripcion[]>([]);
  readonly medicacionRescate = signal<ElementoDescripcion[]>([]);
  readonly metricas = signal<Metrica[]>([]);
  readonly adherencia = signal<HistorialAdherencia | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly esMedico = computed(() => this.sesion.rol() === 'medico');
  readonly puedeEscribir = computed(() => this.acceso() === 'propio' || this.acceso() === 'lectura_escritura');
  readonly nombreCompleto = computed(() => {
    const datos = this.expediente()?.datosPersonales;
    return datos ? `${datos.nombre} ${datos.apellidos}` : '';
  });
  readonly edad = computed(() => edad(this.expediente()?.datosPersonales.fechaNacimiento ?? null));

  async iniciar(idDeRuta?: string): Promise<void> {
    const id = idDeRuta ?? this.sesion.usuario()?.id ?? '';
    this.idPaciente.set(id);
    try {
      if (this.esMedico()) {
        const perfil = await this.medicos.miPerfil();
        this.acceso.set(perfil.pacientesVinculados.find((p) => p.idPaciente === id)?.nivelAcceso ?? null);
      } else {
        this.acceso.set('propio');
      }
    } catch {
      this.acceso.set(null);
    }
    await this.cargar();
  }

  async cargar(): Promise<void> {
    const id = this.idPaciente();
    this.error.set(null);
    try {
      const [expediente, condiciones, rescate, metricas, adherencia] = await Promise.all([
        this.repo.expediente(id),
        this.repo.listarColeccion(id, 'condiciones'),
        this.repo.listarColeccion(id, 'medicacion-rescate'),
        this.repo.metricas(id, 10),
        this.repo.adherencia(id),
      ]);
      this.expediente.set(expediente);
      this.condiciones.set(condiciones);
      this.medicacionRescate.set(rescate);
      this.metricas.set(metricas);
      this.adherencia.set(adherencia);
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Ejecuta un cambio, recarga el expediente y avisa al usuario. */
  private async cambiar(accion: () => Promise<unknown>, avisoExito: string): Promise<boolean> {
    try {
      await accion();
      await this.cargar();
      await this.avisos.exito(avisoExito);
      return true;
    } catch (error) {
      await this.avisos.error(error);
      return false;
    }
  }

  agregar(coleccion: Coleccion, datos: Record<string, unknown>): Promise<boolean> {
    return this.cambiar(() => this.repo.agregarAColeccion(this.idPaciente(), coleccion, datos), 'expediente_guardado');
  }

  eliminar(coleccion: Coleccion, idElemento: string): Promise<boolean> {
    return this.cambiar(() => this.repo.eliminarDeColeccion(this.idPaciente(), coleccion, idElemento), 'expediente_eliminado');
  }

  recetar(tratamiento: NuevoTratamiento): Promise<boolean> {
    return this.cambiar(() => this.repo.recetar(this.idPaciente(), tratamiento), 'tratamiento_guardado');
  }

  suspender(tratamiento: Tratamiento): Promise<boolean> {
    return this.cambiar(() => this.repo.suspenderTratamiento(tratamiento.idTratamiento), 'tratamiento_suspendido');
  }

  actualizarInventario(tratamiento: Tratamiento, cantidadRestante: number): Promise<boolean> {
    return this.cambiar(
      () => this.repo.actualizarTratamiento(tratamiento.idTratamiento, { inventario: { ...tratamiento.inventario, cantidadRestante } }),
      'tratamiento_inventario_actualizado',
    );
  }

  registrarMetrica(metrica: NuevaMetrica): Promise<boolean> {
    return this.cambiar(() => this.repo.registrarMetrica(this.idPaciente(), metrica), 'metrica_guardada');
  }

  /** El paciente sólo suspende o edita a fondo lo que él mismo registró. */
  puedeGestionarTratamiento(tratamiento: Tratamiento): boolean {
    if (!this.puedeEscribir()) {
      return false;
    }
    return this.esMedico() || tratamiento.idMedicoReceta === null;
  }
}
