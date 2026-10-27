/**
 * Escribe un bloque EXIF (APP1) dentro de un JPEG para rastrear de dónde salió:
 * qué app y qué teléfono lo escaneó, quién, cuándo, dónde (GPS), para qué expediente
 * y con un identificador único por escaneo. Lo leen exifr, la API (exif_read_data)
 * y cualquier visor de fotos.
 */

export interface DatosRastreo {
  /** Identificador único del escaneo (se repite en todas sus páginas). */
  idEscaneo: string;
  fecha: Date;
  app: string;
  marca?: string;
  modelo?: string;
  /** Quién escaneó (nombre visible). */
  autor?: string;
  descripcion?: string;
  ubicacion?: { latitud: number; longitud: number; altitud?: number | null } | null;
  ancho: number;
  alto: number;
  /** Datos extra en JSON dentro de UserComment (expediente, rol, página…). */
  comentario?: Record<string, string | number | boolean>;
}

const ASCII = 2;
const SHORT = 3;
const LONG = 4;
const RATIONAL = 5;
const BYTE = 1;
const UNDEFINED = 7;

const TAMANO_TIPO: Record<number, number> = { [BYTE]: 1, [ASCII]: 1, [SHORT]: 2, [LONG]: 4, [RATIONAL]: 8, [UNDEFINED]: 1 };

interface Entrada {
  etiqueta: number;
  tipo: number;
  /** Bytes ya codificados (little endian) del valor. */
  valor: Uint8Array;
  cuenta: number;
}

const codificador = new TextEncoder();

function texto(etiqueta: number, valor: string): Entrada {
  const bytes = codificador.encode(`${valor}\0`);
  return { etiqueta, tipo: ASCII, valor: bytes, cuenta: bytes.length };
}

function numeros(etiqueta: number, tipo: number, valores: number[]): Entrada {
  const tamano = TAMANO_TIPO[tipo];
  const bytes = new Uint8Array(valores.length * tamano);
  const vista = new DataView(bytes.buffer);
  valores.forEach((v, i) => {
    if (tipo === SHORT) vista.setUint16(i * 2, v, true);
    else if (tipo === LONG) vista.setUint32(i * 4, v, true);
    else bytes[i] = v;
  });
  return { etiqueta, tipo, valor: bytes, cuenta: valores.length };
}

/** Racionales sin signo: [numerador, denominador] por valor. */
function racionales(etiqueta: number, valores: [number, number][]): Entrada {
  const bytes = new Uint8Array(valores.length * 8);
  const vista = new DataView(bytes.buffer);
  valores.forEach(([n, d], i) => {
    vista.setUint32(i * 8, n, true);
    vista.setUint32(i * 8 + 4, d, true);
  });
  return { etiqueta, tipo: RATIONAL, valor: bytes, cuenta: valores.length };
}

function indefinido(etiqueta: number, bytes: Uint8Array): Entrada {
  return { etiqueta, tipo: UNDEFINED, valor: bytes, cuenta: bytes.length };
}

/** Bytes que ocupa un IFD con su área de datos (valores de más de 4 bytes, alineados a par). */
function tamanoIfd(entradas: Entrada[]): number {
  let datos = 0;
  for (const e of entradas) {
    if (e.valor.length > 4) datos += e.valor.length + (e.valor.length % 2);
  }
  return 2 + entradas.length * 12 + 4 + datos;
}

function escribirIfd(vista: DataView, bytes: Uint8Array, inicio: number, entradas: Entrada[]): void {
  const ordenadas = [...entradas].sort((a, b) => a.etiqueta - b.etiqueta);
  vista.setUint16(inicio, ordenadas.length, true);
  let datos = inicio + 2 + ordenadas.length * 12 + 4;
  ordenadas.forEach((e, i) => {
    const p = inicio + 2 + i * 12;
    vista.setUint16(p, e.etiqueta, true);
    vista.setUint16(p + 2, e.tipo, true);
    vista.setUint32(p + 4, e.cuenta, true);
    if (e.valor.length <= 4) {
      bytes.set(e.valor, p + 8);
    } else {
      vista.setUint32(p + 8, datos, true);
      bytes.set(e.valor, datos);
      datos += e.valor.length + (e.valor.length % 2);
    }
  });
  vista.setUint32(inicio + 2 + ordenadas.length * 12, 0, true);
}

/** "2026:10:07 09:30:00" en hora local, como lo escriben las cámaras. */
function fechaExif(fecha: Date): string {
  const d = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}:${d(fecha.getMonth() + 1)}:${d(fecha.getDate())} ${d(fecha.getHours())}:${d(fecha.getMinutes())}:${d(fecha.getSeconds())}`;
}

/** "-06:00": desfase de la hora local respecto a UTC. */
function desfase(fecha: Date): string {
  const minutos = -fecha.getTimezoneOffset();
  const signo = minutos >= 0 ? '+' : '-';
  const abs = Math.abs(minutos);
  return `${signo}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`;
}

/** Grados decimales -> [grados, minutos, segundos×1000] como racionales. */
function gms(valor: number): [number, number][] {
  const abs = Math.abs(valor);
  const grados = Math.floor(abs);
  const minutosDec = (abs - grados) * 60;
  const minutos = Math.floor(minutosDec);
  const segundos = Math.round((minutosDec - minutos) * 60 * 1000);
  return [
    [grados, 1],
    [minutos, 1],
    [segundos, 1000],
  ];
}

/** Arma el TIFF (IFD0 + Exif + GPS) que va dentro del segmento APP1. */
export function crearTiffExif(d: DatosRastreo): Uint8Array {
  const ifd0: Entrada[] = [texto(0x0131, d.app), texto(0x0132, fechaExif(d.fecha)), numeros(0x0112, SHORT, [1])];
  if (d.descripcion) ifd0.push(texto(0x010e, d.descripcion));
  if (d.marca) ifd0.push(texto(0x010f, d.marca));
  if (d.modelo) ifd0.push(texto(0x0110, d.modelo));
  if (d.autor) ifd0.push(texto(0x013b, d.autor));

  // UserComment: 8 bytes de código de caracteres + JSON en ASCII (lo no-ASCII va escapado).
  const json = JSON.stringify(d.comentario ?? {}).replace(/[\u0080-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const comentario = new Uint8Array(8 + json.length);
  comentario.set(codificador.encode('ASCII\0\0\0'), 0);
  comentario.set(codificador.encode(json), 8);

  const exif: Entrada[] = [
    indefinido(0x9000, codificador.encode('0232')),
    texto(0x9003, fechaExif(d.fecha)),
    texto(0x9004, fechaExif(d.fecha)),
    texto(0x9011, desfase(d.fecha)),
    indefinido(0x9286, comentario),
    numeros(0xa001, SHORT, [1]),
    numeros(0xa002, LONG, [d.ancho]),
    numeros(0xa003, LONG, [d.alto]),
    texto(0xa420, d.idEscaneo),
  ];

  const gps: Entrada[] = [];
  if (d.ubicacion) {
    const { latitud, longitud, altitud } = d.ubicacion;
    const utc = d.fecha;
    gps.push(
      numeros(0x0000, BYTE, [2, 3, 0, 0]),
      texto(0x0001, latitud >= 0 ? 'N' : 'S'),
      racionales(0x0002, gms(latitud)),
      texto(0x0003, longitud >= 0 ? 'E' : 'W'),
      racionales(0x0004, gms(longitud)),
      racionales(0x0007, [
        [utc.getUTCHours(), 1],
        [utc.getUTCMinutes(), 1],
        [utc.getUTCSeconds(), 1],
      ]),
      texto(0x001d, `${utc.getUTCFullYear()}:${String(utc.getUTCMonth() + 1).padStart(2, '0')}:${String(utc.getUTCDate()).padStart(2, '0')}`),
    );
    if (typeof altitud === 'number' && Number.isFinite(altitud)) {
      gps.push(numeros(0x0005, BYTE, [altitud < 0 ? 1 : 0]), racionales(0x0006, [[Math.round(Math.abs(altitud) * 100), 100]]));
    }
  }

  // Los punteros a los sub-IFD ocupan su entrada en IFD0: se cuentan antes de calcular posiciones.
  const punteroExif = numeros(0x8769, LONG, [0]);
  const punteroGps = numeros(0x8825, LONG, [0]);
  ifd0.push(punteroExif);
  if (gps.length) ifd0.push(punteroGps);

  const inicioIfd0 = 8;
  const inicioExif = inicioIfd0 + tamanoIfd(ifd0);
  const inicioGps = inicioExif + tamanoIfd(exif);
  const total = inicioGps + (gps.length ? tamanoIfd(gps) : 0);
  new DataView(punteroExif.valor.buffer).setUint32(0, inicioExif, true);
  new DataView(punteroGps.valor.buffer).setUint32(0, inicioGps, true);

  const bytes = new Uint8Array(total);
  const vista = new DataView(bytes.buffer);
  bytes.set([0x49, 0x49, 0x2a, 0x00], 0); // "II*\0": little endian
  vista.setUint32(4, inicioIfd0, true);
  escribirIfd(vista, bytes, inicioIfd0, ifd0);
  escribirIfd(vista, bytes, inicioExif, exif);
  if (gps.length) escribirIfd(vista, bytes, inicioGps, gps);
  return bytes;
}

/**
 * Inserta el EXIF en un JPEG (quita uno anterior si lo había). Va después del APP0/JFIF
 * que pone el lienzo, que es donde lo buscan los lectores.
 */
export function incrustarExif(jpeg: Uint8Array, tiff: Uint8Array): Uint8Array {
  if (jpeg[0] !== 0xff || jpeg[1] !== 0xd8) {
    throw new Error('No es un JPEG');
  }
  const cabecera = codificador.encode('Exif\0\0');
  const largo = 2 + cabecera.length + tiff.length;
  if (largo > 0xffff) {
    throw new Error('EXIF demasiado grande');
  }
  const app1 = new Uint8Array(2 + largo);
  app1.set([0xff, 0xe1, largo >> 8, largo & 0xff], 0);
  app1.set(cabecera, 4);
  app1.set(tiff, 4 + cabecera.length);

  // Recorre los segmentos del inicio: conserva APP0, descarta un APP1 Exif viejo.
  const partes: Uint8Array[] = [jpeg.subarray(0, 2)];
  let p = 2;
  let insertado = false;
  while (p + 4 <= jpeg.length && jpeg[p] === 0xff) {
    const marcador = jpeg[p + 1];
    if (marcador === 0xda || marcador < 0xe0 || marcador > 0xef) break; // empieza la imagen o tablas
    const tamano = (jpeg[p + 2] << 8) | jpeg[p + 3];
    const segmento = jpeg.subarray(p, p + 2 + tamano);
    const esExif = marcador === 0xe1 && String.fromCharCode(...segmento.subarray(4, 8)) === 'Exif';
    if (!esExif) {
      partes.push(segmento);
    }
    if (marcador === 0xe0 && !insertado) {
      partes.push(app1);
      insertado = true;
    }
    p += 2 + tamano;
  }
  if (!insertado) {
    partes.splice(1, 0, app1);
  }
  partes.push(jpeg.subarray(p));

  const salida = new Uint8Array(partes.reduce((n, x) => n + x.length, 0));
  let o = 0;
  for (const parte of partes) {
    salida.set(parte, o);
    o += parte.length;
  }
  return salida;
}

/** Identificador de escaneo: 32 caracteres hexadecimales (formato de ImageUniqueID). */
export function nuevoIdEscaneo(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Modelo del teléfono: Client Hints si el WebView los da, si no el User-Agent. */
export async function datosDispositivo(): Promise<{ marca?: string; modelo?: string }> {
  const uad = (navigator as Navigator & {
    userAgentData?: { platform?: string; getHighEntropyValues?: (h: string[]) => Promise<Record<string, string>> };
  }).userAgentData;
  try {
    const valores = await uad?.getHighEntropyValues?.(['model', 'platformVersion']);
    if (valores?.['model']) {
      return { marca: `${uad?.platform ?? 'Android'} ${valores['platformVersion'] ?? ''}`.trim(), modelo: valores['model'] };
    }
  } catch {
    // Sin Client Hints: se intenta con el User-Agent.
  }
  const ua = /Android ([\d.]+);\s*([^;)]+?)(?:\sBuild|\))/.exec(navigator.userAgent);
  return ua ? { marca: `Android ${ua[1]}`, modelo: ua[2].trim() } : {};
}

/** Ubicación actual con tope de tiempo; `null` si no hay permiso o no responde. */
export function ubicacionActual(espera = 6000): Promise<{ latitud: number; longitud: number; altitud: number | null } | null> {
  return new Promise((resolver) => {
    if (!navigator.geolocation) {
      resolver(null);
      return;
    }
    const tope = setTimeout(() => resolver(null), espera + 500);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(tope);
        resolver({ latitud: pos.coords.latitude, longitud: pos.coords.longitude, altitud: pos.coords.altitude });
      },
      () => {
        clearTimeout(tope);
        resolver(null);
      },
      { enableHighAccuracy: true, timeout: espera, maximumAge: 60_000 },
    );
  });
}
