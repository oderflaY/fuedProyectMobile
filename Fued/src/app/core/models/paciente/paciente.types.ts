/** Uniones y catálogos del expediente. */

/** Qué puede hacer un médico con el expediente que se le compartió. */
export type NivelAcceso = 'lectura' | 'lectura_escritura';

export type TipoSangre = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

/** Catálogo para los selectores; mismo orden que muestra el formulario. */
export const TIPOS_SANGRE: TipoSangre[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

/** Ciclo de vida de una tarjeta RFID. */
export type EstadoRfid = 'activa' | 'extraviada' | 'inactiva';

/** Colecciones editables del expediente: rutas `/pacientes/{id}/{coleccion}`. */
export type Coleccion = 'alergias' | 'condiciones' | 'medicacion-rescate' | 'cirugias' | 'contactos';
