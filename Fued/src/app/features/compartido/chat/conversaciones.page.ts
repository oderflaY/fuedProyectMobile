import { Component, Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonAvatar,
  IonBadge,
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
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular';
import type { RefresherCustomEvent, ViewWillEnter } from '@ionic/angular';
import { SessionService } from '../../../core/auth/session.service';
import { FechaPipe, InicialesPipe, TPipe } from '../../../core/i18n/pipes';
import type { Conversacion } from '../../../core/models';
import { ChatRepository } from '../../../core/repositories/chat.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

@Injectable()
export class ConversacionesViewModel {
  private readonly chat = inject(ChatRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly conversaciones = signal<Conversacion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  readonly rutaBase = computed(() => (this.sesion.rol() === 'medico' ? '/medico/chat' : '/paciente/chat'));

  async cargar(): Promise<void> {
    this.error.set(null);
    try {
      this.conversaciones.set(await this.chat.conversaciones());
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }
}

@Component({
  selector: 'app-conversaciones',
  templateUrl: 'conversaciones.page.html',
  providers: [ConversacionesViewModel],
  imports: [
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonRefresher,
    IonRefresherContent,
    IonList,
    IonItem,
    IonAvatar,
    IonLabel,
    IonNote,
    IonBadge,
    IonIcon,
    IonButton,
    IonSpinner,
    TPipe,
    FechaPipe,
    InicialesPipe,
  ],
})
export class ConversacionesPage implements ViewWillEnter {
  readonly vm = inject(ConversacionesViewModel);
  private readonly router = inject(Router);

  ionViewWillEnter(): void {
    void this.vm.cargar();
  }

  async refrescar(evento: RefresherCustomEvent): Promise<void> {
    await this.vm.cargar();
    await evento.target.complete();
  }

  abrir(conversacion: Conversacion): void {
    void this.router.navigate([this.vm.rutaBase(), conversacion.idContraparte]);
  }
}
