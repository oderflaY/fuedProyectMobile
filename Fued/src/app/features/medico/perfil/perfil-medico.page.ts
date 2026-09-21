import { Component, Injectable, inject, signal } from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBadge,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { SessionService } from '../../../core/auth/session.service';
import { FechaPipe, InicialesPipe, TPipe } from '../../../core/i18n/pipes';
import type { PerfilMedico } from '../../../core/models';
import { MedicosRepository } from '../../../core/repositories/medicos.repository';
import { AvisosService } from '../../../core/ui/avisos.service';
import { DialogosService } from '../../../core/ui/dialogos.service';

@Injectable()
export class PerfilMedicoViewModel {
  private readonly medicos = inject(MedicosRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);
  private readonly router = inject(Router);

  readonly perfil = signal<PerfilMedico | null>(null);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

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

  async actualizar(cambios: Record<string, unknown>): Promise<void> {
    try {
      const perfil = await this.medicos.actualizarMiPerfil(cambios);
      this.perfil.set(perfil);
      const usuario = this.sesion.usuario();
      if (usuario) {
        this.sesion.actualizarUsuario({
          ...usuario,
          nombre: perfil.datosPersonales.nombre,
          apellidos: perfil.datosPersonales.apellidos,
          especialidad: perfil.credenciales.especialidad,
        });
      }
      await this.avisos.exito('perfil_guardado');
    } catch (error) {
      await this.avisos.error(error);
    }
  }

  async cerrarSesion(): Promise<void> {
    this.sesion.cerrar();
    await this.router.navigateByUrl('/login', { replaceUrl: true });
  }
}

@Component({
  selector: 'app-perfil-medico',
  templateUrl: 'perfil-medico.page.html',
  providers: [PerfilMedicoViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonButton,
    IonToggle,
    IonSelect,
    IonSelectOption,
    IonSpinner,
    TPipe,
    FechaPipe,
    InicialesPipe,
  ],
})
export class PerfilMedicoPage implements OnInit {
  readonly vm = inject(PerfilMedicoViewModel);
  private readonly dialogos = inject(DialogosService);

  ngOnInit(): void {
    void this.vm.cargar();
  }

  async editarDatos(): Promise<void> {
    const datos = this.vm.perfil()?.datosPersonales;
    const valores = await this.dialogos.pedirTexto('perfil_editar_datos', [
      { nombre: 'nombre', etiqueta: 'campo_nombre', valor: datos?.nombre },
      { nombre: 'apellidos', etiqueta: 'campo_apellidos', valor: datos?.apellidos },
      { nombre: 'telefono', etiqueta: 'campo_telefono', valor: datos?.telefono, tipo: 'tel' },
    ]);
    if (valores) {
      await this.vm.actualizar({ datosPersonales: { ...valores, telefono: valores['telefono'] || null } });
    }
  }

  async editarCredenciales(): Promise<void> {
    const c = this.vm.perfil()?.credenciales;
    const valores = await this.dialogos.pedirTexto('perfil_credenciales', [
      { nombre: 'especialidad', etiqueta: 'campo_especialidad', valor: c?.especialidad },
      { nombre: 'universidad', etiqueta: 'campo_universidad', valor: c?.universidad },
      { nombre: 'cedulaProfesional', etiqueta: 'campo_cedula_profesional', valor: c?.cedulaProfesional },
      { nombre: 'cedulaEspecialidad', etiqueta: 'campo_cedula_especialidad', valor: c?.cedulaEspecialidad },
    ]);
    if (valores) {
      await this.vm.actualizar({
        credenciales: {
          especialidad: valores['especialidad'] || null,
          universidad: valores['universidad'] || null,
          cedulaProfesional: valores['cedulaProfesional'],
          cedulaEspecialidad: valores['cedulaEspecialidad'] || null,
        },
      });
    }
  }

  async editarLugarTrabajo(): Promise<void> {
    const l = this.vm.perfil()?.lugarTrabajo;
    const valores = await this.dialogos.pedirTexto('perfil_lugar_trabajo', [
      { nombre: 'nombreClinica', etiqueta: 'campo_clinica', valor: l?.nombreClinica },
      { nombre: 'direccion', etiqueta: 'campo_direccion', valor: l?.direccion },
      { nombre: 'telefonoRecepcion', etiqueta: 'campo_telefono_recepcion', valor: l?.telefonoRecepcion, tipo: 'tel' },
    ]);
    if (valores) {
      await this.vm.actualizar({
        lugarTrabajo: {
          nombreClinica: valores['nombreClinica'] || null,
          direccion: valores['direccion'] || null,
          telefonoRecepcion: valores['telefonoRecepcion'] || null,
        },
      });
    }
  }

  cambiarConfiguracion(campo: 'alertasAdherenciaBaja' | 'notificacionesUrgencia' | 'temaVisual', valor: unknown): void {
    void this.vm.actualizar({ configuracionDashboard: { [campo]: valor } });
  }

  async cerrarSesion(): Promise<void> {
    if (await this.dialogos.confirmar('cerrar_sesion', 'cerrar_sesion_mensaje', 'cerrar_sesion', true)) {
      await this.vm.cerrarSesion();
    }
  }
}
