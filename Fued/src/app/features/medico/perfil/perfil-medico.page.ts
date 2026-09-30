import { Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
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
import { FechaPipe, InicialesPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import { DialogosService } from '../../../core/ui/dialogos.service';
import { PerfilMedicoViewModel } from './perfil-medico.viewmodel';

/** Vista del perfil del médico: abre los diálogos de edición y delega el guardado. */
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
