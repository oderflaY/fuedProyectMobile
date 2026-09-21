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
import { FechaPipe, InicialesPipe, TPipe } from '../../../core/i18n/pipes';
import { I18nService } from '../../../core/i18n/i18n.service';
import type { MedicoAutorizado, NivelAcceso } from '../../../core/models';
import { TIPOS_SANGRE } from '../../../core/models';
import { DialogosService } from '../../../core/ui/dialogos.service';
import { PerfilPacienteViewModel } from './perfil-paciente.viewmodel';

@Component({
  selector: 'app-perfil-paciente',
  templateUrl: 'perfil-paciente.page.html',
  providers: [PerfilPacienteViewModel],
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
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonSpinner,
    TPipe,
    FechaPipe,
    InicialesPipe,
  ],
})
export class PerfilPacientePage implements OnInit {
  readonly vm = inject(PerfilPacienteViewModel);
  private readonly dialogos = inject(DialogosService);
  private readonly i18n = inject(I18nService);
  readonly tiposSangre = TIPOS_SANGRE;

  ngOnInit(): void {
    void this.vm.cargar();
  }

  async editarDatos(): Promise<void> {
    const datos = this.vm.expediente()?.datosPersonales;
    const valores = await this.dialogos.pedirTexto('perfil_editar_datos', [
      { nombre: 'nombre', etiqueta: 'campo_nombre', valor: datos?.nombre },
      { nombre: 'apellidos', etiqueta: 'campo_apellidos', valor: datos?.apellidos },
      { nombre: 'telefono', etiqueta: 'campo_telefono', valor: datos?.telefono, tipo: 'tel' },
      { nombre: 'fechaNacimiento', etiqueta: 'campo_fecha_nacimiento', valor: datos?.fechaNacimiento, tipo: 'date' },
    ]);
    if (valores) {
      await this.vm.actualizar({
        datosPersonales: { ...valores, telefono: valores['telefono'] || null, fechaNacimiento: valores['fechaNacimiento'] || null },
      });
    }
  }

  async editarIdentificaciones(): Promise<void> {
    const ids = this.vm.expediente()?.identificaciones;
    const valores = await this.dialogos.pedirTexto('perfil_identificaciones', [
      { nombre: 'curp', etiqueta: 'campo_curp', valor: ids?.curp },
      { nombre: 'nss', etiqueta: 'campo_nss', valor: ids?.nss },
    ]);
    if (valores) {
      await this.vm.actualizar({ identificaciones: { curp: valores['curp'] || null, nss: valores['nss'] || null } });
    }
  }

  cambiarTipoSangre(valor: unknown): void {
    void this.vm.actualizar({ perfilEmergenciaReducido: { tipoSangre: valor || null } });
  }

  cambiarDonador(valor: boolean): void {
    void this.vm.actualizar({ perfilEmergenciaReducido: { donadorOrganos: valor } });
  }

  async autorizarMedico(): Promise<void> {
    const disponibles = await this.vm.medicosDisponibles();
    if (disponibles.length === 0) {
      return;
    }
    const idMedico = await this.dialogos.elegir(
      'perfil_elegir_medico',
      disponibles.map((m) => ({ valor: m.idMedico, etiqueta: m.especialidad ? `${m.nombreCompleto} - ${m.especialidad}` : m.nombreCompleto })),
    );
    if (!idMedico) {
      return;
    }
    const nivel = await this.dialogos.elegir(
      'perfil_elegir_nivel',
      (['lectura', 'lectura_escritura'] as NivelAcceso[]).map((n) => ({ valor: n, etiqueta: this.i18n.t(`acceso_${n}_descripcion`) })),
      'lectura',
    );
    if (nivel) {
      await this.vm.otorgarAcceso(idMedico, nivel as NivelAcceso);
    }
  }

  async revocar(medico: MedicoAutorizado): Promise<void> {
    const confirmado = await this.dialogos.confirmar('perfil_revocar_titulo', 'perfil_revocar_mensaje', 'perfil_revocar', true);
    if (confirmado) {
      await this.vm.revocarAcceso(medico.idMedico);
    }
  }

  async asignarTarjeta(): Promise<void> {
    const valores = await this.dialogos.pedirTexto('perfil_asignar_tarjeta', [{ nombre: 'id', etiqueta: 'perfil_id_tarjeta' }]);
    if (valores) {
      await this.vm.asignarTarjeta(valores['id']?.trim() || undefined);
    }
  }

  async reportarExtraviada(idTarjeta: string): Promise<void> {
    const confirmado = await this.dialogos.confirmar('perfil_extraviada_titulo', 'perfil_extraviada_mensaje', 'perfil_reportar', true);
    if (confirmado) {
      await this.vm.reportarExtraviada(idTarjeta);
    }
  }

  async cerrarSesion(): Promise<void> {
    if (await this.dialogos.confirmar('cerrar_sesion', 'cerrar_sesion_mensaje', 'cerrar_sesion', true)) {
      await this.vm.cerrarSesion();
    }
  }
}
