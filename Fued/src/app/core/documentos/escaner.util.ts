/**
 * Procesamiento del escáner de documentos hecho en la app, sin OpenCV:
 * detectar la hoja en la foto, enderezarla (corrección de perspectiva),
 * limpiarla como documento y armar un PDF con varias páginas.
 */

export interface Punto {
  x: number;
  y: number;
}

/** Esquinas de la hoja en orden: arriba-izquierda, arriba-derecha, abajo-derecha, abajo-izquierda. */
export type Cuadrilatero = [Punto, Punto, Punto, Punto];

export type FiltroEscaneo = 'documento' | 'gris' | 'color';

/** Recuadro con margen: lo que se propone cuando no se reconoce la hoja. */
export function cuadroPorDefecto(ancho: number, alto: number, margen = 0.1): Cuadrilatero {
  const mx = ancho * margen;
  const my = alto * margen;
  return [
    { x: mx, y: my },
    { x: ancho - mx, y: my },
    { x: ancho - mx, y: alto - my },
    { x: mx, y: alto - my },
  ];
}

/**
 * Busca la hoja: en una versión chica de la imagen separa lo claro de lo oscuro (Otsu),
 * se queda con la mancha clara más grande y toma sus cuatro puntos extremos.
 * Funciona bien con papel sobre una mesa o fondo más oscuro; si no, devuelve `null`.
 */
export function detectarHoja(fuente: CanvasImageSource, ancho: number, alto: number): Cuadrilatero | null {
  const escala = 160 / Math.max(ancho, alto);
  const w = Math.max(8, Math.round(ancho * escala));
  const h = Math.max(8, Math.round(alto * escala));
  const lienzo = new OffscreenCanvas(w, h);
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return null;
  }
  ctx.filter = 'blur(1px)';
  ctx.drawImage(fuente, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);

  const gris = new Uint8Array(w * h);
  const histograma = new Uint32Array(256);
  for (let i = 0; i < w * h; i++) {
    const v = (data[i * 4] * 77 + data[i * 4 + 1] * 150 + data[i * 4 + 2] * 29) >> 8;
    gris[i] = v;
    histograma[v]++;
  }
  const umbral = otsu(histograma, w * h);

  // Mancha clara más grande (4-vecinos), recorrida con una pila para no desbordar.
  const etiqueta = new Int32Array(w * h).fill(-1);
  const pila = new Int32Array(w * h);
  let mejor: number[] = [];
  for (let inicio = 0; inicio < w * h; inicio++) {
    if (gris[inicio] <= umbral || etiqueta[inicio] !== -1) {
      continue;
    }
    const mancha: number[] = [];
    let tope = 0;
    pila[tope++] = inicio;
    etiqueta[inicio] = inicio;
    while (tope > 0) {
      const p = pila[--tope];
      mancha.push(p);
      const x = p % w;
      const vecinos = [p - w, p + w, x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1];
      for (const v of vecinos) {
        if (v >= 0 && v < w * h && etiqueta[v] === -1 && gris[v] > umbral) {
          etiqueta[v] = inicio;
          pila[tope++] = v;
        }
      }
    }
    if (mancha.length > mejor.length) {
      mejor = mancha;
    }
  }

  const proporcion = mejor.length / (w * h);
  if (proporcion < 0.12 || proporcion > 0.97) {
    return null;
  }

  // Extremos: la esquina sup-izq minimiza x+y, la inf-der la maximiza; igual con x-y.
  let [si, sd, id, ii] = [mejor[0], mejor[0], mejor[0], mejor[0]];
  const suma = (p: number) => (p % w) + Math.floor(p / w);
  const resta = (p: number) => (p % w) - Math.floor(p / w);
  for (const p of mejor) {
    if (suma(p) < suma(si)) si = p;
    if (suma(p) > suma(id)) id = p;
    if (resta(p) > resta(sd)) sd = p;
    if (resta(p) < resta(ii)) ii = p;
  }
  const aPunto = (p: number): Punto => ({ x: ((p % w) + 0.5) / escala, y: (Math.floor(p / w) + 0.5) / escala });
  const cuadro: Cuadrilatero = [aPunto(si), aPunto(sd), aPunto(id), aPunto(ii)];
  return areaCuadrilatero(cuadro) > ancho * alto * 0.1 ? cuadro : null;
}

function otsu(histograma: Uint32Array, total: number): number {
  let sumaTotal = 0;
  for (let i = 0; i < 256; i++) {
    sumaTotal += i * histograma[i];
  }
  let sumaFondo = 0;
  let pesoFondo = 0;
  let mejorVarianza = 0;
  let umbral = 127;
  for (let t = 0; t < 256; t++) {
    pesoFondo += histograma[t];
    if (pesoFondo === 0) continue;
    const pesoFrente = total - pesoFondo;
    if (pesoFrente === 0) break;
    sumaFondo += t * histograma[t];
    const mediaFondo = sumaFondo / pesoFondo;
    const mediaFrente = (sumaTotal - sumaFondo) / pesoFrente;
    const varianza = pesoFondo * pesoFrente * (mediaFondo - mediaFrente) ** 2;
    if (varianza > mejorVarianza) {
      mejorVarianza = varianza;
      umbral = t;
    }
  }
  return umbral;
}

export function areaCuadrilatero(c: Cuadrilatero): number {
  let area = 0;
  for (let i = 0; i < 4; i++) {
    const a = c[i];
    const b = c[(i + 1) % 4];
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area) / 2;
}

/** Homografía que lleva el rectángulo destino (0..w, 0..h) a las esquinas de la foto. */
function homografia(c: Cuadrilatero, w: number, h: number): number[] {
  const destino = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  // Sistema 8x8: para cada par (u,v) -> (x,y).
  const A: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [u, v] = destino[i];
    const { x, y } = c[i];
    A.push([u, v, 1, 0, 0, 0, -u * x, -v * x]);
    b.push(x);
    A.push([0, 0, 0, u, v, 1, -u * y, -v * y]);
    b.push(y);
  }
  return [...resolver(A, b), 1];
}

/** Eliminación gaussiana con pivoteo parcial. */
function resolver(A: number[][], b: number[]): number[] {
  const n = b.length;
  const m = A.map((fila, i) => [...fila, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivote = col;
    for (let f = col + 1; f < n; f++) {
      if (Math.abs(m[f][col]) > Math.abs(m[pivote][col])) pivote = f;
    }
    [m[col], m[pivote]] = [m[pivote], m[col]];
    for (let f = 0; f < n; f++) {
      if (f === col) continue;
      const factor = m[f][col] / m[col][col];
      for (let k = col; k <= n; k++) m[f][k] -= factor * m[col][k];
    }
  }
  return m.map((fila, i) => fila[n] / fila[i]);
}

/**
 * Endereza la hoja: corrección de perspectiva con interpolación bilineal.
 * El tamaño de salida respeta la proporción real de la hoja (lados medidos en la foto).
 */
export function enderezar(imagen: ImageData, c: Cuadrilatero, ladoMaximo = 2000): ImageData {
  const dist = (a: Punto, b: Punto) => Math.hypot(a.x - b.x, a.y - b.y);
  let ancho = Math.max(dist(c[0], c[1]), dist(c[3], c[2]));
  let alto = Math.max(dist(c[0], c[3]), dist(c[1], c[2]));
  const escala = Math.min(1, ladoMaximo / Math.max(ancho, alto));
  ancho = Math.max(1, Math.round(ancho * escala));
  alto = Math.max(1, Math.round(alto * escala));

  const H = homografia(c, ancho, alto);
  const salida = new ImageData(ancho, alto);
  const origen = imagen.data;
  const destino = salida.data;
  const wo = imagen.width;
  const ho = imagen.height;

  for (let v = 0; v < alto; v++) {
    for (let u = 0; u < ancho; u++) {
      const z = H[6] * u + H[7] * v + H[8];
      const x = (H[0] * u + H[1] * v + H[2]) / z;
      const y = (H[3] * u + H[4] * v + H[5]) / z;
      const x0 = Math.min(wo - 2, Math.max(0, Math.floor(x)));
      const y0 = Math.min(ho - 2, Math.max(0, Math.floor(y)));
      const fx = Math.min(1, Math.max(0, x - x0));
      const fy = Math.min(1, Math.max(0, y - y0));
      const i00 = (y0 * wo + x0) * 4;
      const i10 = i00 + 4;
      const i01 = i00 + wo * 4;
      const i11 = i01 + 4;
      const d = (v * ancho + u) * 4;
      for (let k = 0; k < 3; k++) {
        const arriba = origen[i00 + k] + (origen[i10 + k] - origen[i00 + k]) * fx;
        const abajo = origen[i01 + k] + (origen[i11 + k] - origen[i01 + k]) * fx;
        destino[d + k] = arriba + (abajo - arriba) * fy;
      }
      destino[d + 3] = 255;
    }
  }
  return salida;
}

/**
 * Aplica el filtro y devuelve un lienzo listo para exportar.
 * `documento` divide entre la iluminación de fondo (sombras y luz dispareja se van)
 * y sube el contraste: queda papel blanco con letra negra.
 */
export function aplicarFiltro(hoja: ImageData, filtro: FiltroEscaneo): OffscreenCanvas {
  const lienzo = new OffscreenCanvas(hoja.width, hoja.height);
  const ctx = lienzo.getContext('2d')!;
  ctx.putImageData(hoja, 0, 0);
  if (filtro === 'color') {
    return lienzo;
  }

  const datos = ctx.getImageData(0, 0, hoja.width, hoja.height);
  const px = datos.data;
  let fondo: Uint8ClampedArray | null = null;
  if (filtro === 'documento') {
    // Iluminación de fondo: la hoja muy reducida y desenfocada, de vuelta a tamaño completo.
    const chico = new OffscreenCanvas(Math.max(1, Math.round(hoja.width / 16)), Math.max(1, Math.round(hoja.height / 16)));
    const cc = chico.getContext('2d')!;
    cc.filter = 'blur(3px)';
    cc.drawImage(lienzo, 0, 0, chico.width, chico.height);
    const grande = new OffscreenCanvas(hoja.width, hoja.height);
    const gc = grande.getContext('2d')!;
    gc.imageSmoothingQuality = 'high';
    gc.drawImage(chico, 0, 0, hoja.width, hoja.height);
    fondo = gc.getImageData(0, 0, hoja.width, hoja.height).data;
  }

  for (let i = 0; i < px.length; i += 4) {
    let g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    if (fondo) {
      const f = Math.max(1, 0.299 * fondo[i] + 0.587 * fondo[i + 1] + 0.114 * fondo[i + 2]);
      g = Math.min(255, (g / f) * 255);
      // Curva: lo casi blanco se vuelve blanco y la tinta se oscurece.
      g = g > 215 ? 255 : Math.max(0, (g - 60) * (255 / 155));
    }
    px[i] = px[i + 1] = px[i + 2] = g;
  }
  ctx.putImageData(datos, 0, 0);
  return lienzo;
}

/** Gira 90° a la derecha (para hojas fotografiadas de lado). */
export function rotar90(imagen: ImageData): ImageData {
  const { width: w, height: h, data } = imagen;
  const salida = new ImageData(h, w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      const d = (x * h + (h - 1 - y)) * 4;
      salida.data[d] = data[o];
      salida.data[d + 1] = data[o + 1];
      salida.data[d + 2] = data[o + 2];
      salida.data[d + 3] = 255;
    }
  }
  return salida;
}

export interface PaginaPdf {
  jpeg: Uint8Array;
  ancho: number;
  alto: number;
}

/**
 * PDF mínimo con una página por imagen JPEG (DCTDecode, sin recomprimir).
 * Cada página mide 595 pt de ancho (A4) y su alto sigue la proporción de la hoja.
 */
export function crearPdf(
  paginas: PaginaPdf[],
  titulo: string,
  programa: string,
  extra: { autor?: string; palabrasClave?: string } = {},
): Blob {
  const codificador = new TextEncoder();
  const partes: Uint8Array[] = [];
  const desplazamientos: number[] = [];
  let posicion = 0;
  const escribir = (contenido: string | Uint8Array) => {
    const bytes = typeof contenido === 'string' ? codificador.encode(contenido) : contenido;
    partes.push(bytes);
    posicion += bytes.length;
  };
  const objeto = (numero: number, cuerpo: () => void) => {
    desplazamientos[numero] = posicion;
    escribir(`${numero} 0 obj\n`);
    cuerpo();
    escribir('\nendobj\n');
  };
  const texto = (valor: string) => `(${valor.replace(/[\\()]/g, '\\$&').replace(/[^\x20-\x7e]/g, '?')})`;

  // 1 catálogo, 2 páginas, 3 info; luego por página: hoja, contenido e imagen.
  const totalObjetos = 3 + paginas.length * 3;
  const hojas = paginas.map((_, i) => 4 + i * 3);

  escribir('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  objeto(1, () => escribir('<< /Type /Catalog /Pages 2 0 R >>'));
  objeto(2, () => escribir(`<< /Type /Pages /Kids [${hojas.map((n) => `${n} 0 R`).join(' ')}] /Count ${paginas.length} >>`));
  const ahora = new Date();
  const fecha = `D:${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}${String(ahora.getHours()).padStart(2, '0')}${String(ahora.getMinutes()).padStart(2, '0')}${String(ahora.getSeconds()).padStart(2, '0')}`;
  objeto(3, () =>
    escribir(
      `<< /Title ${texto(titulo)} /Producer ${texto(programa)} /Creator ${texto(programa)} /CreationDate (${fecha})` +
        (extra.autor ? ` /Author ${texto(extra.autor)}` : '') +
        (extra.palabrasClave ? ` /Keywords ${texto(extra.palabrasClave)}` : '') +
        ' >>',
    ),
  );

  paginas.forEach((pagina, i) => {
    const [nHoja, nContenido, nImagen] = [4 + i * 3, 5 + i * 3, 6 + i * 3];
    const anchoPt = 595;
    const altoPt = Math.round((anchoPt * pagina.alto) / pagina.ancho);
    const dibujo = `q ${anchoPt} 0 0 ${altoPt} 0 0 cm /Im0 Do Q`;
    objeto(nHoja, () =>
      escribir(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${anchoPt} ${altoPt}] ` +
          `/Resources << /XObject << /Im0 ${nImagen} 0 R >> >> /Contents ${nContenido} 0 R >>`,
      ),
    );
    objeto(nContenido, () => escribir(`<< /Length ${dibujo.length} >>\nstream\n${dibujo}\nendstream`));
    objeto(nImagen, () => {
      escribir(
        `<< /Type /XObject /Subtype /Image /Width ${pagina.ancho} /Height ${pagina.alto} ` +
          `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${pagina.jpeg.length} >>\nstream\n`,
      );
      escribir(pagina.jpeg);
      escribir('\nendstream');
    });
  });

  const inicioXref = posicion;
  let xref = `xref\n0 ${totalObjetos + 1}\n0000000000 65535 f \n`;
  for (let n = 1; n <= totalObjetos; n++) {
    xref += `${String(desplazamientos[n]).padStart(10, '0')} 00000 n \n`;
  }
  escribir(xref);
  escribir(`trailer\n<< /Size ${totalObjetos + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${inicioXref}\n%%EOF\n`);
  return new Blob(partes as BlobPart[], { type: 'application/pdf' });
}
