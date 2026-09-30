<?php
declare(strict_types=1);

/**
 * Bandeja de alertas clínicas. El médico las lee y las marca; el paciente puede
 * consultar las suyas para saber qué se envió en su nombre.
 */
return function (Router $r): void {
    $r->get('/alertas', function (): void {
        $s = sesion('medico');
        $estado = parametro('estado');
        if ($estado !== null && !in_array($estado, ['nueva', 'vista', 'atendida'], true)) {
            throw errorCampo('opcion_invalida', 'estado', 'Estado de alerta no válido.');
        }
        $limite = (int) entero(['limite' => parametro('limite', '50')], 'limite', true, 1, 200);

        $alertas = AlertaClinica::deMedico($s['id'], $estado)->con('paciente')->limitar($limite)->obtener();
        responder([
            'pendientes' => AlertaClinica::pendientesDe($s['id']),
            'alertas' => array_map(fn (AlertaClinica $a) => $a->aDto(), $alertas),
        ]);
    });

    $r->put('/alertas/{idAlerta}', function (array $p): void {
        $s = sesion('medico');
        $alerta = AlertaClinica::buscarOFallar($p['idAlerta'], 'alerta_no_encontrada', 'La alerta no existe.');
        if ($alerta->id_medico !== $s['id']) {
            throw new HttpError(403, 'acceso_denegado', 'Esa alerta no está dirigida a ti.');
        }
        $d = cuerpoJson();
        $alerta->marcar(
            (string) opcion($d, 'estado', ['vista', 'atendida']),
            texto($d, 'notasMedico', false, 500)
        );
        responder($alerta->aDto());
    });

    // Transparencia: el paciente ve qué alertas generó su propio seguimiento.
    $r->get('/pacientes/{id}/alertas', function (array $p): void {
        autorizarPaciente(sesion('paciente'), $p['id']);
        $alertas = AlertaClinica::donde('id_paciente', $p['id'])
            ->ordenar('fecha_creacion', 'DESC')->limitar(50)->obtener();
        responder(array_map(fn (AlertaClinica $a) => $a->aDto(), $alertas));
    });
};
