import { Pipe, inject } from '@angular/core';
import type { PipeTransform } from '@angular/core';
import type { ParametrosTexto } from './i18n.service';
import { I18nService } from './i18n.service';
import type { FormatoFecha } from '../util/fechas.util';
import { formatearFecha } from '../util/fechas.util';

/** `{{ 'clave' | t }}` o `{{ 'clave' | t: { nombre: 'Ana' } }}` */
@Pipe({ name: 't' })
export class TPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(clave: string, parametros?: ParametrosTexto): string {
    return this.i18n.t(clave, parametros);
  }
}

/** `{{ cita.fechaHora | fecha: 'hora' }}` usando el locale de strings.xml. */
@Pipe({ name: 'fecha' })
export class FechaPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(valor: string | null | undefined, formato: FormatoFecha = 'fechaHora'): string {
    return valor ? formatearFecha(valor, formato, this.i18n.locale()) : '';
  }
}

/** Iniciales para avatares: "Elena Ruiz Santos" -> "ER". */
@Pipe({ name: 'iniciales' })
export class InicialesPipe implements PipeTransform {
  transform(nombre: string | null | undefined): string {
    return (nombre ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((parte) => parte[0]?.toUpperCase() ?? '')
      .join('');
  }
}

export const PIPES_COMUNES = [TPipe, FechaPipe, InicialesPipe] as const;
