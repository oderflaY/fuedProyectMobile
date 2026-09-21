import { Injectable, inject } from '@angular/core';
import { AlertController } from '@ionic/angular';
import type { AlertInput } from '@ionic/angular';
import { I18nService } from '../i18n/i18n.service';

export interface CampoTexto {
  nombre: string;
  etiqueta: string;
  valor?: string | null;
  tipo?: AlertInput['type'];
}

/** Diálogos nativos (alertas) reutilizables; los textos son claves de strings.xml. */
@Injectable({ providedIn: 'root' })
export class DialogosService {
  private readonly alertas = inject(AlertController);
  private readonly i18n = inject(I18nService);

  async confirmar(titulo: string, mensaje: string, textoAceptar: string, destructivo = false): Promise<boolean> {
    const alerta = await this.alertas.create({
      header: this.i18n.t(titulo),
      message: this.i18n.t(mensaje),
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        { text: this.i18n.t(textoAceptar), role: destructivo ? 'destructive' : 'confirm' },
      ],
    });
    await alerta.present();
    const { role } = await alerta.onDidDismiss();
    return role === 'confirm' || role === 'destructive';
  }

  /** Pide varios campos de texto. Devuelve `null` si el usuario cancela. */
  async pedirTexto(titulo: string, campos: CampoTexto[]): Promise<Record<string, string> | null> {
    const alerta = await this.alertas.create({
      header: this.i18n.t(titulo),
      inputs: campos.map((c) => ({
        name: c.nombre,
        type: c.tipo ?? 'text',
        value: c.valor ?? '',
        placeholder: this.i18n.t(c.etiqueta),
        attributes: { 'aria-label': this.i18n.t(c.etiqueta) },
      })),
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        { text: this.i18n.t('guardar'), role: 'confirm' },
      ],
    });
    await alerta.present();
    const { data, role } = await alerta.onDidDismiss<{ values: Record<string, string> }>();
    return role === 'confirm' && data ? data.values : null;
  }

  /** Lista de opciones con radio buttons. */
  async elegir(titulo: string, opciones: { valor: string; etiqueta: string }[], seleccion?: string): Promise<string | null> {
    const alerta = await this.alertas.create({
      header: this.i18n.t(titulo),
      inputs: opciones.map((o) => ({ type: 'radio' as const, label: o.etiqueta, value: o.valor, checked: o.valor === seleccion })),
      buttons: [
        { text: this.i18n.t('cancelar'), role: 'cancel' },
        { text: this.i18n.t('aceptar'), role: 'confirm' },
      ],
    });
    await alerta.present();
    const { data, role } = await alerta.onDidDismiss<{ values: string }>();
    return role === 'confirm' && data?.values ? data.values : null;
  }
}
