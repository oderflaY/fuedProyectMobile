import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { aApiError } from '../api/api.service';
import type { ParametrosTexto } from '../i18n/i18n.service';
import { I18nService } from '../i18n/i18n.service';

/** Mensajes breves (toasts) con textos de strings.xml. */
@Injectable({ providedIn: 'root' })
export class AvisosService {
  private readonly toasts = inject(ToastController);
  private readonly i18n = inject(I18nService);

  async exito(clave: string, parametros?: ParametrosTexto): Promise<void> {
    await this.mostrar(this.i18n.t(clave, parametros), 'success', 'checkmark-circle');
  }

  async info(clave: string, parametros?: ParametrosTexto): Promise<void> {
    await this.mostrar(this.i18n.t(clave, parametros), 'medium', 'information-circle');
  }

  async error(error: unknown): Promise<void> {
    await this.mostrar(this.mensajeDeError(error), 'danger', 'alert-circle');
  }

  /** Traduce el código de error de la API (`error_<codigo>`) o usa el genérico. */
  mensajeDeError(error: unknown): string {
    const { codigo } = aApiError(error);
    const clave = `error_${codigo}`;
    return this.i18n.existe(clave) ? this.i18n.t(clave) : this.i18n.t('error_generico');
  }

  private async mostrar(mensaje: string, color: string, icon: string): Promise<void> {
    const toast = await this.toasts.create({ message: mensaje, color, icon, duration: 2800, position: 'top' });
    await toast.present();
  }
}
