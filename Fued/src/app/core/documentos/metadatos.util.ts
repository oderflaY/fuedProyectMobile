import type { MetadatosDocumento } from '../models';

type Valor = string | number | boolean;

/**
 * Qué etiqueta EXIF va a qué grupo y con qué nombre. Los nombres son los mismos que
 * usa la API cuando lee el EXIF por su cuenta, así el visor muestra igual ambos casos.
 */
const MAPA_EXIF: Record<string, [grupo: string, campo: string]> = {
  Make: ['camara', 'marca'],
  Model: ['camara', 'modelo'],
  Software: ['camara', 'software'],
  LensModel: ['camara', 'lente'],
  DateTimeOriginal: ['captura', 'fechaOriginal'],
  CreateDate: ['captura', 'fechaCreacion'],
  ExposureTime: ['captura', 'exposicion'],
  FNumber: ['captura', 'apertura'],
  ISO: ['captura', 'iso'],
  ISOSpeedRatings: ['captura', 'iso'],
  FocalLength: ['captura', 'distanciaFocal'],
  Flash: ['captura', 'flash'],
  WhiteBalance: ['captura', 'balanceBlancos'],
  ExifImageWidth: ['imagen', 'ancho'],
  ExifImageHeight: ['imagen', 'alto'],
  ImageWidth: ['imagen', 'ancho'],
  ImageLength: ['imagen', 'alto'],
  Orientation: ['imagen', 'orientacion'],
  ColorSpace: ['imagen', 'espacioColor'],
  Artist: ['rastreo', 'autor'],
  ImageDescription: ['rastreo', 'descripcion'],
  ImageUniqueID: ['rastreo', 'idEscaneo'],
  OffsetTimeOriginal: ['captura', 'zonaHoraria'],
  latitude: ['ubicacion', 'latitud'],
  longitude: ['ubicacion', 'longitud'],
  GPSAltitude: ['ubicacion', 'altitud'],
};

function valorSimple(valor: unknown): Valor | null {
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor.toISOString();
  }
  if (typeof valor === 'number') {
    return Number.isFinite(valor) ? Math.round(valor * 1e6) / 1e6 : null;
  }
  if (typeof valor === 'string') {
    const limpio = valor.replace(/\0/g, '').trim();
    return limpio ? limpio.slice(0, 300) : null;
  }
  return typeof valor === 'boolean' ? valor : null;
}

/** Acomoda un objeto EXIF plano (exifr o el del plugin de cámara) en grupos. */
export function agruparExif(exif: Record<string, unknown> | null | undefined): MetadatosDocumento {
  const grupos: MetadatosDocumento = {};
  // UserComment trae el JSON de rastreo que escribe el escáner de la app.
  for (const [campo, valor] of Object.entries(leerComentario(exif?.['UserComment']))) {
    (grupos['rastreo'] ??= {})[campo] ??= valor;
  }
  for (const [etiqueta, valor] of Object.entries(exif ?? {})) {
    const destino = MAPA_EXIF[etiqueta];
    const simple = valorSimple(valor);
    if (destino && simple !== null) {
      const [grupo, campo] = destino;
      (grupos[grupo] ??= {})[campo] ??= simple;
    }
  }
  return grupos;
}

/** UserComment: 8 bytes de código ("ASCII\0\0\0") y luego el texto; si es JSON plano se reparte en campos. */
function leerComentario(valor: unknown): Record<string, string | number | boolean> {
  let texto = '';
  if (typeof valor === 'string') {
    texto = valor;
  } else if (valor instanceof Uint8Array || Array.isArray(valor)) {
    const bytes = Uint8Array.from(valor as ArrayLike<number>);
    const prefijo = String.fromCharCode(...bytes.subarray(0, 8)).replace(/\0/g, '');
    texto = new TextDecoder(prefijo === 'UNICODE' ? 'utf-16le' : 'utf-8').decode(bytes.subarray(8));
  }
  texto = texto.replace(/^(ASCII|UNICODE)\0*/, '').replace(/\0+$/, '').trim();
  if (!texto) {
    return {};
  }
  try {
    const datos = JSON.parse(texto) as unknown;
    if (datos && typeof datos === 'object' && !Array.isArray(datos)) {
      const planos: Record<string, string | number | boolean> = {};
      for (const [clave, v] of Object.entries(datos)) {
        const simple = valorSimple(v);
        if (simple !== null) planos[clave] = simple;
      }
      return planos;
    }
  } catch {
    // Comentario libre de otra cámara.
  }
  return { comentario: texto.slice(0, 300) };
}

/** Lee el EXIF de una imagen. exifr va en su propio chunk: sólo se baja al tomar una foto. */
export async function leerExif(archivo: Blob): Promise<MetadatosDocumento> {
  try {
    const exifr = await import('exifr');
    // `sanitize: false`: sin esto exifr descarta UserComment, donde va el JSON de rastreo.
    const datos = (await exifr.parse(archivo, { tiff: true, exif: true, gps: true, userComment: true, sanitize: false, translateValues: true })) as
      | Record<string, unknown>
      | undefined;
    return agruparExif(datos);
  } catch {
    // Formatos sin EXIF (PNG de captura, HEIC raro…): el visor se queda con los datos del archivo.
    return {};
  }
}

/** El plugin de cámara entrega su propio EXIF como texto JSON; sirve de respaldo. */
export function exifDelPlugin(exif: unknown): MetadatosDocumento {
  if (typeof exif === 'string') {
    try {
      return agruparExif(JSON.parse(exif) as Record<string, unknown>);
    } catch {
      return {};
    }
  }
  return typeof exif === 'object' && exif !== null ? agruparExif(exif as Record<string, unknown>) : {};
}

/** Datos del diccionario /Info de un PDF (autor, programa, fecha), sin cargar un lector de PDF. */
export async function leerInfoPdf(archivo: Blob): Promise<MetadatosDocumento> {
  const tramo = 128 * 1024;
  const partes = [archivo.slice(0, tramo), archivo.size > tramo ? archivo.slice(-tramo) : new Blob()];
  const texto = (await Promise.all(partes.map((p) => p.arrayBuffer())))
    .map((b) => new TextDecoder('latin1').decode(b))
    .join('\n');
  const campos: Record<string, string> = {
    Title: 'titulo',
    Author: 'autor',
    Creator: 'creador',
    Producer: 'programa',
    CreationDate: 'fechaCreacion',
    ModDate: 'fechaModificacion',
  };
  const pdf: Record<string, Valor> = {};
  for (const [clave, campo] of Object.entries(campos)) {
    const encontrado = new RegExp(`/${clave}\\s*\\(((?:\\\\.|[^\\\\)])*)\\)`).exec(texto)?.[1];
    if (encontrado) {
      pdf[campo] = clave.endsWith('Date') ? fechaPdf(encontrado) : encontrado.replace(/\\(.)/g, '$1').slice(0, 300);
    }
  }
  const paginas = texto.match(/\/Type\s*\/Page[^s]/g)?.length;
  if (paginas) {
    pdf['paginas'] = paginas;
  }
  return Object.keys(pdf).length ? { pdf } : {};
}

/** D:20261007093000-06'00' -> ISO 8601. */
function fechaPdf(valor: string): string {
  const m = /D:(\d{4})(\d{2})?(\d{2})?(\d{2})?(\d{2})?(\d{2})?/.exec(valor);
  if (!m) {
    return valor;
  }
  const [, a, mes = '01', d = '01', h = '00', min = '00', s = '00'] = m;
  return `${a}-${mes}-${d}T${h}:${min}:${s}`;
}

/** Une varios grupos de metadatos; el primero que traiga un campo gana. */
export function unirMetadatos(...fuentes: MetadatosDocumento[]): MetadatosDocumento {
  const resultado: MetadatosDocumento = {};
  for (const fuente of fuentes) {
    for (const [grupo, campos] of Object.entries(fuente)) {
      for (const [campo, valor] of Object.entries(campos)) {
        (resultado[grupo] ??= {})[campo] ??= valor;
      }
    }
  }
  return resultado;
}
