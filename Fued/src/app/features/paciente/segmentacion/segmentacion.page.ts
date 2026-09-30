import { Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  IonBackButton,
  IonBadge,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import { I18nService } from '../../../core/i18n/i18n.service';
import { FechaPipe, TPipe } from '../../../core/i18n/i18n.pipes';
import type { CondicionCronica, PerfilCronico, Pregunta, RespuestasCuestionario } from '../../../core/models';
import { COLOR_SEGMENTO } from '../../../core/ui/colores.constants';
import { SegmentacionViewModel } from './segmentacion.viewmodel';

@Component({
  selector: 'app-segmentacion',
  templateUrl: 'segmentacion.page.html',
  providers: [SegmentacionViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonBadge,
    IonSpinner,
    TPipe,
    FechaPipe,
  ],
})
export class SegmentacionPage implements OnInit {
  readonly vm = inject(SegmentacionViewModel);
  private readonly i18n = inject(I18nService);
  private readonly hojas = inject(ActionSheetController);
  private readonly alertas = inject(AlertController);
  private readonly router = inject(Router);

  readonly colorSegmento = COLOR_SEGMENTO;

  ngOnInit(): void {
    void this.vm.cargar();
  }

  responder(perfil: PerfilCronico): void {
    void this.router.navigate(['/paciente/salud/cuestionario', perfil.condicion]);
  }

  async opciones(perfil: PerfilCronico): Promise<void> {
    const hoja = await this.hojas.create({
      header: this.i18n.t(perfil.etiqueta),
      buttons: [
        {
          text: this.i18n.t('cronicas_responder'),
          icon: 'clipboard-outline',
          handler: () => this.responder(perfil),
        },
        {
          text: this.i18n.t('cronicas_archivar'),
          icon: 'archive-outline',
          role: 'destructive',
          handler: () => void this.vm.archivar(perfil),
        },
        { text: this.i18n.t('cancelar'), role: 'cancel' },
      ],
    });
    await hoja.present();
  }

  /** Alta de una condición: pide sus datos basales, que son la referencia personal. */
  async agregar(): Promise<void> {
    const disponibles = this.vm.disponibles();
    if (disponibles.length === 0) {
      return;
    }
    const hoja = await this.hojas.create({
      header: this.i18n.t('cronicas_agregar'),
      buttons: [
        ...disponibles.map((cuestionario) => ({
          text: this.i18n.t(cuestionario.etiqueta),
          handler: () => void this.pedirBasales(cuestionario.condicion, cuestionario.basales),
        })),
        { text: this.i18n.t('cancelar'), role: 'cancel' },
      ],
    });
    await hoja.present();
  }

  private async pedirBasales(condicion: CondicionCronica, basales: Pregunta[]): Promise<void> {
    const alerta = await this.alertas.create({
      header: this.i18n.t('cronicas_basales_titulo'),
      message: this.i18n.t('cronicas_basales_mensaje'),
      inputs: basales.map((pregunta) => ({
        name: pregunta.id,
        type: pregunta.tipo === 'numero' ? ('number' as const) : ('text' as const),
        placeholder: this.i18n.t(pregunta.etiqueta),
        value: pregunta.defecto ?? '',
        min: pregunta.min,
        max: pregunta.max,
      })),
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        {
          text: this.i18n.t('guardar'),
          handler: (datos: Record<string, string>) => {
            const valores: RespuestasCuestionario = {};
            for (const pregunta of basales) {
              const valor = datos[pregunta.id];
              if (valor !== '' && valor !== undefined) {
                valores[pregunta.id] = pregunta.tipo === 'numero' ? Number(valor) : valor;
              }
            }
            void this.vm.declarar(condicion, valores);
          },
        },
      ],
    });
    await alerta.present();
  }
}
