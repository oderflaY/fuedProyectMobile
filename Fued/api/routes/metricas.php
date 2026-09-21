<?php
declare(strict_types=1);

return function (Router $r): void {
    $r->get('/pacientes/{id}/metricas', function (array $p): void {
        $paciente = pacienteAutorizado(sesion(), $p['id']);
        $limite = (int) entero(['limite' => parametro('limite', '30')], 'limite', true, 1, 200);
        responder(array_map(fn (MetricaVital $m) => $m->aDto(), $paciente->metricas($limite)));
    });

    // Registro diario de signos vitales. Basta con enviar al menos una medición.
    $r->post('/pacientes/{id}/metricas', function (array $p): void {
        $s = sesion();
        autorizarPaciente($s, $p['id'], true);
        $d = cuerpoJson();

        $presion = texto($d, 'presionArterial', false, 7);
        if ($presion !== null) {
            if (!preg_match('/^(\d{2,3})\/(\d{2,3})$/', $presion, $m) || (int) $m[1] <= (int) $m[2]) {
                throw errorCampo('presion_invalida', 'presionArterial', 'La presión debe tener formato sistólica/diastólica, p. ej. 120/80.');
            }
        }
        $medidas = [
            'peso_kg' => numero($d, 'pesoKg', false, 1, 500),
            'altura_cm' => numero($d, 'alturaCm', false, 30, 260),
            'presion_arterial' => $presion,
            'frecuencia_cardiaca' => entero($d, 'frecuenciaCardiaca', false, 20, 250),
            'glucosa_mg_dl' => numero($d, 'glucosaMgDl', false, 20, 800),
            'temperatura_c' => numero($d, 'temperaturaC', false, 30, 45),
        ];
        if (array_filter($medidas, fn ($v) => $v !== null) === []) {
            throw new HttpError(422, 'sin_mediciones', 'Registra al menos una medición.');
        }

        // El IMC se calcula con la altura de esta medición o con la última conocida.
        $altura = $medidas['altura_cm'] ?? MetricaVital::ultimoValor($p['id'], 'altura_cm');
        $imc = $medidas['peso_kg'] !== null && $altura ? round($medidas['peso_kg'] / (((float) $altura / 100) ** 2), 1) : null;

        $fechaToma = fechaHoraSql($d, 'fechaToma', false) ?? ahoraSql();
        if ($fechaToma > ahoraSql()) {
            throw errorCampo('fecha_futura', 'fechaToma', 'La fecha de la medición no puede ser futura.');
        }

        $metrica = MetricaVital::crear([
            'id_paciente' => $p['id'],
            'imc' => $imc,
            'notas' => texto($d, 'notas', false, 500),
            'registrado_por' => $s['id'],
            'fecha_toma' => $fechaToma,
        ] + $medidas);
        responder($metrica->aDto(), 201);
    });
};
