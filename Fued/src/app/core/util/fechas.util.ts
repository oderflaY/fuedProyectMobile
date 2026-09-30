export type FormatoFecha = 'hora' | 'fecha' | 'fechaCorta' | 'fechaLarga' | 'fechaHora' | 'diaSemana';

const OPCIONES: Record<FormatoFecha, Intl.DateTimeFormatOptions> = {
  hora: { hour: '2-digit', minute: '2-digit' },
  fecha: { day: 'numeric', month: 'short', year: 'numeric' },
  fechaCorta: { day: 'numeric', month: 'short' },
  fechaLarga: { weekday: 'long', day: 'numeric', month: 'long' },
  fechaHora: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
  diaSemana: { weekday: 'short', day: 'numeric' },
};

/** Zona horaria IANA del dispositivo; la API la usa para interpretar horarios locales. */
export function zonaHorariaLocal(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Mexico_City';
}

/** Fecha local `YYYY-MM-DD`. */
export function fechaLocalIso(fecha: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${fecha.getFullYear()}-${pad(fecha.getMonth() + 1)}-${pad(fecha.getDate())}`;
}

export function sumarDias(fechaIso: string, dias: number): string {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return fechaLocalIso(new Date(anio, mes - 1, dia + dias));
}

/** Acepta ISO con hora o fechas de calendario `YYYY-MM-DD` (se interpretan en hora local). */
export function aFecha(valor: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const [anio, mes, dia] = valor.split('-').map(Number);
    return new Date(anio, mes - 1, dia);
  }
  return new Date(valor);
}

export function formatearFecha(valor: string, formato: FormatoFecha, locale: string): string {
  const fecha = aFecha(valor);
  return Number.isNaN(fecha.getTime()) ? valor : new Intl.DateTimeFormat(locale, OPCIONES[formato]).format(fecha);
}

export function edad(fechaNacimiento: string | null, hoy: Date = new Date()): number | null {
  if (!fechaNacimiento) {
    return null;
  }
  const nacimiento = aFecha(fechaNacimiento);
  let anios = hoy.getFullYear() - nacimiento.getFullYear();
  const cumplioEsteAnio =
    hoy.getMonth() > nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
  if (!cumplioEsteAnio) {
    anios--;
  }
  return anios;
}

/** Horarios sugeridos a partir de las 08:00 según la frecuencia (misma regla que la API). */
export function horariosPorFrecuencia(frecuenciaHoras: number): string[] {
  if (frecuenciaHoras >= 24 || frecuenciaHoras <= 0) {
    return ['08:00'];
  }
  const horarios: string[] = [];
  for (let i = 0; i < Math.floor(24 / frecuenciaHoras); i++) {
    horarios.push(`${String((8 + i * frecuenciaHoras) % 24).padStart(2, '0')}:00`);
  }
  return horarios.sort();
}
