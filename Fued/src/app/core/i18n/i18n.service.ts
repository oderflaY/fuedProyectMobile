import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

export type ParametrosTexto = Record<string, string | number | null | undefined>;

/**
 * Lee un archivo con formato de recursos Android:
 * `<resources><string name="clave">Texto con {parametro}</string></resources>`.
 */
export function parsearStringsXml(xml: string): Record<string, string> {
  const documento = new DOMParser().parseFromString(xml, 'application/xml');
  if (documento.querySelector('parsererror')) {
    throw new Error('strings.xml no es un XML válido');
  }
  const textos: Record<string, string> = {};
  documento.querySelectorAll('resources > string[name]').forEach((nodo) => {
    const clave = nodo.getAttribute('name');
    if (clave) {
      textos[clave] = (nodo.textContent ?? '').trim().replace(/\\n/g, '\n').replace(/\\'/g, "'").replace(/\\"/g, '"');
    }
  });
  return textos;
}

export function interpolar(plantilla: string, parametros?: ParametrosTexto): string {
  if (!parametros) {
    return plantilla;
  }
  return plantilla.replace(/\{(\w+)\}/g, (coincidencia, nombre: string) => {
    const valor = parametros[nombre];
    return valor === null || valor === undefined ? coincidencia : String(valor);
  });
}

/** Internacionalización centralizada: todos los textos viven en assets/i18n/strings.xml. */
@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly http = inject(HttpClient);
  private readonly textos = signal<Record<string, string>>({});

  async cargar(ruta = 'assets/i18n/strings.xml'): Promise<void> {
    const xml = await firstValueFrom(this.http.get(ruta, { responseType: 'text' }));
    this.textos.set(parsearStringsXml(xml));
    document.documentElement.lang = this.idioma();
  }

  /** Permite cargar textos directamente (útil en pruebas). */
  usar(textos: Record<string, string>): void {
    this.textos.set(textos);
  }

  existe(clave: string): boolean {
    return clave in this.textos();
  }

  t(clave: string, parametros?: ParametrosTexto): string {
    return interpolar(this.textos()[clave] ?? clave, parametros);
  }

  /** Locale BCP 47 declarado en strings.xml, usado para formatear fechas y números. */
  locale(): string {
    return this.textos()['locale'] ?? 'es-MX';
  }

  idioma(): string {
    return this.locale().split('-')[0];
  }
}
