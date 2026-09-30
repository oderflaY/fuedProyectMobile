import { Injectable, computed, inject, signal } from '@angular/core';
import { SessionService } from '../../../core/auth/session.service';
import type {
  CondicionCronica,
  Cuestionario,
  Pregunta,
  RespuestasCuestionario,
  ResultadoEvaluacion,
  ValorRespuesta,
} from '../../../core/models';
import { SegmentacionRepository } from '../../../core/repositories/segmentacion.repository';
import { AvisosService } from '../../../core/ui/avisos.service';

/** Valida en el cliente lo mismo que el servidor, para avisar antes de enviar. */
export function respuestaValida(pregunta: Pregunta, valor: ValorRespuesta | undefined): boolean {
  if (valor === undefined || valor === '' || valor === null) {
    return pregunta.requerida !== true;
  }
  switch (pregunta.tipo) {
    case 'numero': {
      const numero = Number(valor);
      return Number.isFinite(numero) && numero >= (pregunta.min ?? 0) && numero <= (pregunta.max ?? Number.MAX_SAFE_INTEGER);
    }
    case 'presion': {
      const partes = /^(\d{2,3})\/(\d{2,3})$/.exec(String(valor));
      return partes !== null && Number(partes[1]) > Number(partes[2]);
    }
    case 'opcion_multiple':
      return Array.isArray(valor) && valor.length > 0;
    default:
      return true;
  }
}

/**
 * Cuestionario guiado: una pregunta a la vez, para que el paciente no tenga que
 * interpretar un formulario largo ni decidir qué es relevante de su condición.
 */
@Injectable()
export class CuestionarioViewModel {
  private readonly repo = inject(SegmentacionRepository);
  private readonly sesion = inject(SessionService);
  private readonly avisos = inject(AvisosService);

  readonly condicion = signal<CondicionCronica>('hipertension');
  readonly cuestionario = signal<Cuestionario | null>(null);
  readonly respuestas = signal<RespuestasCuestionario>({});
  readonly paso = signal(0);
  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly resultado = signal<ResultadoEvaluacion | null>(null);
  readonly error = signal<string | null>(null);

  readonly preguntas = computed<Pregunta[]>(() => this.cuestionario()?.preguntas ?? []);
  readonly total = computed(() => this.preguntas().length);
  readonly actual = computed<Pregunta | null>(() => this.preguntas()[this.paso()] ?? null);
  readonly progreso = computed(() => (this.total() === 0 ? 0 : (this.paso() + 1) / this.total()));
  readonly esUltima = computed(() => this.paso() >= this.total() - 1);
  readonly puedeAvanzar = computed(() => {
    const pregunta = this.actual();
    return pregunta === null || respuestaValida(pregunta, this.respuestas()[pregunta.id]);
  });

  private get idPaciente(): string {
    return this.sesion.usuario()?.id ?? '';
  }

  async iniciar(condicion: CondicionCronica): Promise<void> {
    this.condicion.set(condicion);
    this.error.set(null);
    try {
      this.cuestionario.set(await this.repo.cuestionario(this.idPaciente, condicion));
    } catch (error) {
      this.error.set(this.avisos.mensajeDeError(error));
    } finally {
      this.cargando.set(false);
    }
  }

  responder(idPregunta: string, valor: ValorRespuesta): void {
    this.respuestas.update((previas) => ({ ...previas, [idPregunta]: valor }));
  }

  /** Alterna una opción de las preguntas de selección múltiple. */
  alternarOpcion(idPregunta: string, opcion: string): void {
    const seleccion = (this.respuestas()[idPregunta] as string[] | undefined) ?? [];
    // "ninguno" es excluyente: marcarlo limpia el resto y viceversa.
    if (opcion === 'ninguno') {
      this.responder(idPregunta, seleccion.includes('ninguno') ? [] : ['ninguno']);
      return;
    }
    const sinNinguno = seleccion.filter((valor) => valor !== 'ninguno');
    this.responder(
      idPregunta,
      sinNinguno.includes(opcion) ? sinNinguno.filter((valor) => valor !== opcion) : [...sinNinguno, opcion],
    );
  }

  seleccionada(idPregunta: string, opcion: string): boolean {
    return ((this.respuestas()[idPregunta] as string[] | undefined) ?? []).includes(opcion);
  }

  avanzar(): void {
    if (this.puedeAvanzar() && !this.esUltima()) {
      this.paso.update((paso) => paso + 1);
    }
  }

  retroceder(): void {
    this.paso.update((paso) => Math.max(0, paso - 1));
  }

  async enviar(): Promise<void> {
    this.enviando.set(true);
    try {
      this.resultado.set(await this.repo.responder(this.idPaciente, this.condicion(), this.respuestas()));
    } catch (error) {
      await this.avisos.error(error);
    } finally {
      this.enviando.set(false);
    }
  }

  reiniciar(): void {
    this.respuestas.set({});
    this.paso.set(0);
    this.resultado.set(null);
  }
}
