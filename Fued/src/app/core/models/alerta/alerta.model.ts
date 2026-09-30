// Respuestas de `/alertas`: la bandeja del médico.

import type { CondicionCronica, SeveridadAlerta } from '../segmentacion/segmentacion.types';
import type { DatosAlerta, EstadoAlerta, OrigenAlerta } from './alerta.types';

/** Aviso sobre un paciente; el texto se arma en la app desde las claves. */
export interface Alerta {
  idAlerta: string;
  idPaciente: string;
  nombrePaciente: string;
  /** Presente sólo cuando nació de un tamizaje. */
  idEvaluacion: string | null;
  origen: OrigenAlerta;
  condicion: CondicionCronica | null;
  severidad: SeveridadAlerta;
  /** Claves de strings.xml; el texto visible nunca viaja desde la API. */
  claveTitulo: string;
  claveDetalle: string;
  datos: DatosAlerta;
  estado: EstadoAlerta;
  fechaCreacion: string;
  fechaAtencion: string | null;
  notasMedico: string | null;
}

/** Bandeja filtrada; `pendientes` cuenta las nuevas, ignora el filtro aplicado. */
export interface BandejaAlertas {
  pendientes: number;
  alertas: Alerta[];
}
