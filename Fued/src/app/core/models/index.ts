/**
 * Modelos (la M de MVVM): los DTO que intercambia la app con la API.
 * Ver DM_HistorialMedico.md y DM_PerfilMedico.md.
 *
 * Una carpeta por dominio y, dentro, tres papeles distintos:
 *   `*.types.ts`   uniones cerradas y catálogos que comparten los otros dos.
 *   `*.model.ts`   lo que la API devuelve (respuestas).
 *   `*.request.ts` lo que la app le envía (cuerpos de POST y PUT).
 *
 * Todas las fechas con hora son ISO 8601 en UTC; las de calendario, YYYY-MM-DD.
 * Este índice existe para que el resto de la app importe de `core/models`
 * sin depender de en qué archivo quedó cada tipo.
 */

export * from './sesion/sesion.types';
export * from './sesion/sesion.model';
export * from './sesion/sesion.request';

export * from './paciente/paciente.types';
export * from './paciente/paciente.model';
export * from './paciente/paciente.request';

export * from './metrica/metrica.model';
export * from './metrica/metrica.request';

export * from './tratamiento/tratamiento.model';
export * from './tratamiento/tratamiento.request';

export * from './adherencia/adherencia.types';
export * from './adherencia/adherencia.model';
export * from './adherencia/adherencia.request';

export * from './cita/cita.types';
export * from './cita/cita.model';
export * from './cita/cita.request';

export * from './medico/medico.types';
export * from './medico/medico.model';

export * from './chat/chat.types';
export * from './chat/chat.model';
export * from './chat/chat.request';

export * from './privacidad/privacidad.types';
export * from './privacidad/privacidad.model';
export * from './privacidad/privacidad.request';

export * from './segmentacion/segmentacion.types';
export * from './segmentacion/segmentacion.model';
export * from './segmentacion/segmentacion.request';

export * from './alerta/alerta.types';
export * from './alerta/alerta.model';
export * from './alerta/alerta.request';
