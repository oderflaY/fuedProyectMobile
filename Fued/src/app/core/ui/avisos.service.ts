import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { aApiError } from '../api/api.service';
import type { ParametrosTexto } from '../i18n/i18n.service';
import { I18nService } from '../i18n/i18n.service';
import { SonidosService } from './sonidos.service';

/** Mensajes breves (toasts) con textos de strings.xml: letrero de ruta en el parabrisas, con su sonido. */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly toasts = inject(ToastController);
  private readonly i18n = inject(I18nService);
  private readonly sonidos = inject(SonidosService);

  async exito(clave: string, parametros?: ParametrosTexto): Promise<void> {
    this.sonidos.campana();
    await this.mostrar(this.i18n.t(clave, parametros), 'checkmark-circle', 'toast-exito');
  }

  async info(clave: string, parametros?: ParametrosTexto): Promise<void> {
    await this.mostrar(this.i18n.t(clave, parametros), 'information-circle');
  }

  async error(error: unknown): Promise<void> {
    this.sonidos.trompetaTriste();
    await this.mostrar(this.mensajeDeError(error), 'alert-circle', 'toast-error');
  }

  /** Traduce el código de error de la API (`error_<codigo>`) o usa el genérico. */
  mensajeDeError(error: unknown): string {
    const { codigo } = aApiError(error);
    const clave = `error_${codigo}`;
    return this.i18n.existe(clave) ? this.i18n.t(clave) : this.i18n.t('error_generico');
  }

  private async mostrar(mensaje: string, icon: string, clase?: string): Promise<void> {
    const toast = await this.toasts.create({
      message: mensaje,
      icon,
      duration: 2800,
      position: 'top',
      cssClass: ['toast-parabrisas', clase ?? ''].filter(Boolean),
    });
    await toast.present();
  }
}
