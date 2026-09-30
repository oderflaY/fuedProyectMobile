import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type { Conversacion } from '../../../core/models';
import { ChatRepository } from '../../../core/repositories/chat.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

/** Estado de la bandeja de chats; la comparten paciente y médico. */
@Injectable()
export class ConversacionesViewModel {
  private readonly chat = inject(ChatRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly conversaciones = signal<Conversacion[]>([]);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);
  /** Cada rol tiene su propia rama de rutas para abrir la charla. */
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
