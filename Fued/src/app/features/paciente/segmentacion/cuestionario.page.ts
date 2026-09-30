import { Component, inject } from '@angular/core';
import type { OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonCheckbox,
  IonContent,
  IonFooter,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonProgressBar,
  IonRadio,
  IonRadioGroup,
  IonSpinner,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular';
import { TPipe } from '../../../core/i18n/i18n.pipes';
import type { CondicionCronica, ValorRespuesta } from '../../../core/models';
import { COLOR_SEGMENTO, COLOR_SEVERIDAD } from '../../../core/ui/colores.constants';
import { CuestionarioViewModel } from './cuestionario.viewmodel';

@Component({
  selector: 'app-cuestionario',
  templateUrl: 'cuestionario.page.html',
  providers: [CuestionarioViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonContent,
    IonFooter,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonInput,
    IonNote,
    IonToggle,
    IonCheckbox,
    IonRadio,
    IonRadioGroup,
    IonProgressBar,
    IonSpinner,
    TPipe,
  ],
})
export class CuestionarioPage implements OnInit {
  readonly vm = inject(CuestionarioViewModel);
  private readonly ruta = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly colorSegmento = COLOR_SEGMENTO;
  readonly colorSeveridad = COLOR_SEVERIDAD;

  ngOnInit(): void {
    const condicion = this.ruta.snapshot.paramMap.get('condicion') as CondicionCronica | null;
    void this.vm.iniciar(condicion ?? 'hipertension');
  }

  responder(idPregunta: string, valor: ValorRespuesta): void {
    this.vm.responder(idPregunta, valor);
  }

  responderNumero(idPregunta: string, valor: string | number | null | undefined): void {
    if (valor === null || valor === undefined || valor === '') {
      return;
    }
    this.vm.responder(idPregunta, Number(valor));
  }

  valor(idPregunta: string): ValorRespuesta | undefined {
    return this.vm.respuestas()[idPregunta];
  }

  siguiente(): void {
    if (this.vm.esUltima()) {
      void this.vm.enviar();
      return;
    }
    this.vm.avanzar();
  }

  terminar(): void {
    void this.router.navigateByUrl('/paciente/salud');
  }
}
