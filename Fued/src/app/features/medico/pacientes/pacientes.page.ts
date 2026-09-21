import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonNote,
  IonRefresher,
  IonRefresherContent,
  IonSearchbar,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import type { RefresherCustomEvent, ViewWillEnter } from '@ionic/angular';
import { InicialesPipe, TPipe } from '../../../core/i18n/pipes';
import type { EstadoRiesgo, PerfilMedico } from '../../../core/models';
import { MedicosRepository } from '../../../core/repositories/medicos.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

const ORDEN_RIESGO: Record<EstadoRiesgo, number> = { alto: 0, medio: 1, bajo: 2 };

@Injectable()
export class PacientesViewModel {
  private readonly medicos = inject(MedicosRepository);
  private readonly avisos = inject(AvisosService);

  readonly perfil = signal<PerfilMedico | null>(null);
  readonly busqueda = signal('');
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly verificado = computed(() => this.perfil()?.credenciales.estadoVerificacion === 'aprobado');
  readonly pacientes = computed(() => {
    const texto = this.busqueda().trim().toLocaleLowerCase();
    return [...(this.perfil()?.pacientesVinculados ?? [])]
      .filter((p) => p.nombreCompleto.toLocaleLowerCase().includes(texto))
      .sort((a, b) => ORDEN_RIESGO[a.estadoRiesgo] - ORDEN_RIESGO[b.estadoRiesgo] || a.nombreCompleto.localeCompare(b.nombreCompleto));
  });
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

@Component({
  selector: 'app-pacientes',
  templateUrl: 'pacientes.page.html',
  styleUrls: ['pacientes.page.scss'],
  providers: [PacientesViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonSearchbar,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonNote,
    IonIcon,
    IonButton,
    IonSpinner,
    TPipe,
    InicialesPipe,
  ],
})
export class PacientesPage implements ViewWillEnter {
  readonly vm = inject(PacientesViewModel);
  private readonly router = inject(Router);
  readonly niveles: EstadoRiesgo[] = ['alto', 'medio', 'bajo'];

  ionViewWillEnter(): void {
    void this.vm.cargar();
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  abrir(idPaciente: string): void {
    void this.router.navigate(['/medico/pacientes', idPaciente]);
  }
}
