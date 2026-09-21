import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type { Mensaje } from '../../../core/models';
import { ChatRepository } from '../../../core/repositories/chat.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

const INTERVALO_SONDEO_MS = 4000;

@Injectable()
export class ConversacionViewModel {
  private readonly chat = inject(ChatRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);
  private temporizador: ReturnType<typeof setInterval> | null = null;

  readonly idContraparte = signal('');
  readonly nombre = signal('');
  readonly mensajes = signal<Mensaje[]>([]);
  readonly borrador = signal('');
  readonly enviando = signal(false);
  readonly subiendo = signal(false);
  readonly cargando = signal(true);
  readonly error = signal<string | null>(null);

  readonly rol = this.sesion.rol;
  readonly puedeEnviar = computed(() => this.borrador().trim() !== '' && !this.enviando());
  readonly ocupado = computed(() => this.enviando() || this.subiendo());
  readonly rutaLista = computed(() => (this.sesion.rol() === 'medico' ? '/medico/chat' : '/paciente/chat'));

  async iniciar(idContraparte: string): Promise<void> {
    this.idContraparte.set(idContraparte);
    try {
      const [conversaciones, mensajes] = await Promise.all([this.chat.conversaciones(), this.chat.mensajes(idContraparte)]);
      this.nombre.set(conversaciones.find((c) => c.idContraparte === idContraparte)?.nombre ?? '');
      this.mensajes.set(mensajes);
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  /** Trae sólo los mensajes posteriores al último que ya tenemos. */
  async actualizar(): Promise<void> {
    const mensajes = this.mensajes();
    const ultimo = mensajes[mensajes.length - 1]?.idMensaje;
    try {
      const nuevos = await this.chat.mensajes(this.idContraparte(), ultimo);
      if (nuevos.length > 0) {
        this.agregar(nuevos);
      }
    } catch {
      // Un sondeo fallido se reintenta en el siguiente ciclo.
    }
  }

  async enviar(): Promise<void> {
    if (!this.puedeEnviar()) {
      return;
    }
    this.enviando.set(true);
    try {
      const mensaje = await this.chat.enviar(this.idContraparte(), this.borrador().trim());
      this.borrador.set('');
      this.agregar([mensaje]);
    } catch (error) {
      await this.avisos.error(error);
    } finally {
      this.enviando.set(false);
    }
  }

  /** Envía una nota de voz, una foto, un PDF o un documento. */
  async enviarArchivo(archivo: File, opciones: { duracionSeg?: number } = {}): Promise<void> {
    this.subiendo.set(true);
    try {
      const contenido = this.borrador().trim();
      const mensaje = await this.chat.enviarAdjunto(this.idContraparte(), archivo, { ...opciones, contenido: contenido || undefined });
      this.borrador.set('');
      this.agregar([mensaje]);
    } catch (error) {
      await this.avisos.error(error);
    } finally {
      this.subiendo.set(false);
    }
  }

  /** Coloca una plantilla en el cuadro de texto para que el usuario la edite antes de enviar. */
  usarPlantilla(texto: string): void {
    this.borrador.update((actual) => (actual.trim() === '' ? texto : `${actual.trim()} ${texto}`));
  }

  iniciarSondeo(): void {
    this.detenerSondeo();
    this.temporizador = setInterval(() => void this.actualizar(), INTERVALO_SONDEO_MS);
  }

  detenerSondeo(): void {
    if (this.temporizador !== null) {
      clearInterval(this.temporizador);
      this.temporizador = null;
    }
  }

  private agregar(nuevos: Mensaje[]): void {
    this.mensajes.update((actuales) => {
      const ids = new Set(actuales.map((m) => m.idMensaje));
      return [...actuales, ...nuevos.filter((m) => !ids.has(m.idMensaje))];
    });
  }
}
