/** Uniones y catálogos del expediente. */

/** Qué puede hacer un médico con el expediente que se le compartió. */
export type NivelAcceso = 'lectura' | 'lectura_escritura';

export type TipoSangre = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

/** Catálogo para los selectores; mismo orden que muestra el formulario. */
export const TIPOS_SANGRE: TipoSangre[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Ciclo de vida de una tarjeta RFID. */
export type EstadoRfid = 'activa' | 'extraviada' | 'inactiva';

/** Colecciones editables del expediente: rutas `/pacientes/{id}/{coleccion}`. */
export type Coleccion =
  | 'alergias'
  | 'condiciones'
  | 'medicacion-rescate'
  | 'cirugias'
  | 'contactos'
  | 'vacunas'
  | 'antecedentes';

/** Para qué sirve un documento del expediente; ordena la lista y elige el ícono. */
export type CategoriaDocumento =
  | 'receta'
  | 'laboratorio'
  | 'imagenologia'
  | 'nota_medica'
  | 'identificacion'
  | 'seguro'
  | 'otro';

export const CATEGORIAS_DOCUMENTO: CategoriaDocumento[] = [
  'receta',
  'laboratorio',
  'imagenologia',
  'nota_medica',
  'identificacion',
  'seguro',
  'otro',
];

/** De dónde salió el archivo: cámara, escáner de documentos, galería o selector de archivos. */
export type OrigenDocumento = 'camara' | 'escaner' | 'galeria' | 'archivo';

export type Tabaquismo = 'nunca' | 'exfumador' | 'actual';
export type ConsumoAlcohol = 'no' | 'ocasional' | 'frecuente';
export type ActividadFisica = 'sedentaria' | 'moderada' | 'activa';

export const OPCIONES_TABAQUISMO: Tabaquismo[] = ['nunca', 'exfumador', 'actual'];
export const OPCIONES_ALCOHOL: ConsumoAlcohol[] = ['no', 'ocasional', 'frecuente'];
export const OPCIONES_ACTIVIDAD: ActividadFisica[] = ['sedentaria', 'moderada', 'activa'];

/** Seguros más comunes en México; el campo acepta cualquier otro texto. */
export const SEGUROS_MEDICOS = ['IMSS', 'ISSSTE', 'IMSS-Bienestar', 'Pemex', 'Sedena/Semar', 'Privado', 'Ninguno'];
