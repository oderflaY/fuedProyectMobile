<?php
declare(strict_types=1);

// Datos de demostración basados en los JSON de DM_HistorialMedico.md y DM_PerfilMedico.md.
// Se cargan con los modelos del ORM. Contraseña de todas las cuentas demo: Fued12345

function sembrarDatosDemo(): void
{
    $tz = zonaHoraria(null);
    $hoy = new DateTimeImmutable('today', $tz);
    $local = fn (string $modificador, string $hora) => sqlUtc(
        new DateTimeImmutable($hoy->modify($modificador)->format('Y-m-d') . ' ' . $hora, $tz)
    );
    $registro = '2025-11-15 10:00:00';
    $ahora = ahoraSql();

    // Cuentas
    foreach ([
        ['doc_889900A', 'medico', 'dr.elena.ruiz@hospital.com'],
        ['doc_112233', 'medico', 'dr.carlos.mendez@hospital.com'],
        ['pac_01H8X9A', 'paciente', 'juan.perez@correo.com'],
        ['pac_02J9Y8B', 'paciente', 'maria.lopez@correo.com'],
    ] as [$id, $rol, $email]) {
        $cuenta = Cuenta::registrar($id, $rol, $email, 'Fued12345');
        $cuenta->fecha_registro = $registro;
        $cuenta->ultimo_acceso = $ahora;
        $cuenta->guardar();
    }

    // Médicos
    Medico::crear([
        'id_medico' => 'doc_889900A', 'estado_cuenta' => 'verificado',
        'nombre' => 'Elena', 'apellidos' => 'Ruiz Santos', 'genero' => 'Femenino', 'telefono' => '+526189998877',
        'cedula_profesional' => '12345678', 'cedula_especialidad' => '87654321', 'especialidad' => 'Cardiología',
        'universidad' => 'Universidad Autónoma de Durango', 'estado_verificacion' => 'aprobado',
        'fecha_verificacion' => '2025-11-20 14:30:00', 'nombre_clinica' => 'Hospital de Especialidades',
        'direccion' => 'Av. 20 de Noviembre 123, Centro, Durango', 'telefono_recepcion' => '+526181112233',
        'tema_visual' => 'oscuro',
    ]);
    Medico::crear([
        'id_medico' => 'doc_112233', 'estado_cuenta' => 'verificado',
        'nombre' => 'Carlos', 'apellidos' => 'Méndez Ortiz', 'genero' => 'Masculino', 'telefono' => '+526187776655',
        'cedula_profesional' => '23456789', 'especialidad' => 'Medicina Interna',
        'universidad' => 'Universidad Juárez del Estado de Durango', 'estado_verificacion' => 'aprobado',
        'fecha_verificacion' => '2025-12-01 09:00:00', 'nombre_clinica' => 'Clínica Guadiana',
        'direccion' => 'Blvd. Felipe Pescador 450, Durango', 'telefono_recepcion' => '+526184445566',
    ]);

    // Pacientes
    Paciente::crear([
        'id_paciente' => 'pac_01H8X9A', 'estado_cuenta' => 'activo', 'curp' => 'PAGJ850412HDFRXX09', 'nss' => '12345678901',
        'nombre' => 'Juan', 'apellidos' => 'Pérez Gómez', 'fecha_nacimiento' => '1985-04-12', 'genero' => 'Masculino',
        'telefono' => '+526181234567', 'tipo_sangre' => 'O+', 'donador_organos' => true,
    ]);
    Paciente::crear([
        'id_paciente' => 'pac_02J9Y8B', 'estado_cuenta' => 'activo', 'curp' => 'LOMM900823MDGPRR02', 'nss' => '98765432109',
        'nombre' => 'María', 'apellidos' => 'López', 'fecha_nacimiento' => '1990-08-23', 'genero' => 'Femenino',
        'telefono' => '+526183334455', 'tipo_sangre' => 'A+', 'donador_organos' => false,
    ]);

    DispositivoRfid::crear([
        'id_tarjeta_rfid' => 'rfid_hash_abc123', 'id_paciente' => 'pac_01H8X9A', 'estado' => 'activa',
        'fecha_asignacion' => '2026-01-10 10:00:00',
    ]);
    ContactoEmergencia::crear([
        'id' => 'cte_DEMO000001', 'id_paciente' => 'pac_01H8X9A', 'nombre' => 'María Gómez',
        'relacion' => 'Madre', 'telefono' => '+526189876543', 'prioridad' => 1,
    ]);
    Alergia::crear([
        'id' => 'ale_DEMO000001', 'id_paciente' => 'pac_01H8X9A', 'alergeno' => 'Penicilina',
        'severidad' => 'Alta (Anafilaxia)', 'reaccion' => 'Cierre de vías respiratorias',
    ]);
    CondicionCritica::crear(['id' => 'cnd_DEMO000001', 'id_paciente' => 'pac_01H8X9A', 'descripcion' => 'Hipertensión arterial']);
    MedicacionRescate::crear(['id' => 'mre_DEMO000001', 'id_paciente' => 'pac_01H8X9A', 'descripcion' => 'Anticoagulantes activos - Riesgo de hemorragia']);
    Cirugia::crear([
        'id' => 'cir_DEMO000001', 'id_paciente' => 'pac_01H8X9A', 'procedimiento' => 'Apendicectomía',
        'fecha' => '2015-08-20', 'notas' => 'Sin complicaciones',
    ]);
    CondicionCritica::crear(['id' => 'cnd_DEMO000002', 'id_paciente' => 'pac_02J9Y8B', 'descripcion' => 'Hipotiroidismo']);

    // Métricas de los últimos días
    $presiones = ['128/84', '132/86', '125/82', '138/88', '122/80', '120/80'];
    foreach ($presiones as $i => $presion) {
        $dias = count($presiones) - $i;
        $peso = 78.5 + ($dias * 0.2);
        MetricaVital::crear([
            'id_paciente' => 'pac_01H8X9A', 'peso_kg' => $peso, 'altura_cm' => 175,
            'imc' => round($peso / 1.75 ** 2, 1), 'presion_arterial' => $presion,
            'frecuencia_cardiaca' => 70 + $i, 'glucosa_mg_dl' => 95 + $i, 'registrado_por' => 'pac_01H8X9A',
            'fecha_toma' => $local("-$dias days", '08:00'),
        ]);
    }
    MetricaVital::crear([
        'id_paciente' => 'pac_02J9Y8B', 'peso_kg' => 62.0, 'altura_cm' => 163,
        'imc' => 23.3, 'presion_arterial' => '115/75', 'frecuencia_cardiaca' => 68, 'registrado_por' => 'pac_02J9Y8B',
        'fecha_toma' => $local('-1 day', '07:30'),
    ]);

    // Tratamientos
    Tratamiento::crear([
        'id_tratamiento' => 'trt_001', 'id_paciente' => 'pac_01H8X9A', 'medicamento' => 'Losartán', 'dosis' => '50mg',
        'frecuencia_horas' => 12, 'horarios_sugeridos' => ['08:00', '20:00'], 'via_administracion' => 'Oral',
        'fecha_inicio' => '2026-08-01', 'fecha_fin' => '2026-12-31', 'id_medico_receta' => 'doc_112233',
        'cantidad_restante' => 14, 'umbral_alerta' => 5, 'activo' => true, 'fecha_creacion' => '2026-08-01 15:00:00',
    ]);
    Tratamiento::crear([
        'id_tratamiento' => 'trt_002', 'id_paciente' => 'pac_01H8X9A', 'medicamento' => 'Ácido acetilsalicílico', 'dosis' => '100mg',
        'frecuencia_horas' => 24, 'horarios_sugeridos' => ['14:00'], 'via_administracion' => 'Oral',
        'fecha_inicio' => '2026-08-15', 'fecha_fin' => null, 'id_medico_receta' => 'doc_889900A',
        'cantidad_restante' => 4, 'umbral_alerta' => 5, 'activo' => true, 'fecha_creacion' => '2026-08-15 16:00:00',
    ]);
    Tratamiento::crear([
        'id_tratamiento' => 'trt_003', 'id_paciente' => 'pac_02J9Y8B', 'medicamento' => 'Levotiroxina', 'dosis' => '50mcg',
        'frecuencia_horas' => 24, 'horarios_sugeridos' => ['07:00'], 'via_administracion' => 'Oral',
        'fecha_inicio' => '2026-06-01', 'fecha_fin' => null, 'id_medico_receta' => 'doc_889900A',
        'cantidad_restante' => 30, 'umbral_alerta' => 7, 'activo' => true, 'fecha_creacion' => '2026-06-01 10:00:00',
    ]);

    // Registro de adherencia de los últimos 5 días
    $estados = ['tomado', 'tomado_tarde', 'tomado', 'omitido', 'tomado'];
    foreach ($estados as $i => $estado) {
        $dias = 5 - $i;
        $programada = $local("-$dias days", '08:00');
        RegistroAdherencia::crear([
            'id_toma' => $i === 0 ? 'log_8899' : null, 'id_tratamiento' => 'trt_001', 'id_paciente' => 'pac_01H8X9A',
            'fecha_hora_programada' => $programada,
            'fecha_hora_real' => $estado === 'omitido' ? null : sqlUtc((new DateTimeImmutable($programada))->modify($estado === 'tomado_tarde' ? '+45 minutes' : '+5 minutes')),
            'estado' => $estado, 'sintomas_asociados' => $estado === 'tomado_tarde' ? 'Ligero mareo' : null,
        ]);
        $nocturna = $local("-$dias days", '20:00');
        RegistroAdherencia::crear([
            'id_tratamiento' => 'trt_001', 'id_paciente' => 'pac_01H8X9A',
            'fecha_hora_programada' => $nocturna,
            'fecha_hora_real' => sqlUtc((new DateTimeImmutable($nocturna))->modify('+10 minutes')),
            'estado' => 'tomado', 'sintomas_asociados' => null,
        ]);
    }

    // Accesos: el paciente otorga permisos a sus médicos
    foreach ([
        ['pac_01H8X9A', 'doc_112233', 'lectura_escritura', '2026-08-01 15:00:00', '2027-01-01 00:00:00'],
        ['pac_01H8X9A', 'doc_889900A', 'lectura_escritura', '2026-08-15 10:00:00', null],
        ['pac_02J9Y8B', 'doc_889900A', 'lectura', '2026-09-01 09:15:00', null],
    ] as [$paciente, $medico, $nivel, $vinculacion, $expiracion]) {
        AccesoMedico::crear([
            'id_paciente' => $paciente, 'id_medico' => $medico, 'nivel_acceso' => $nivel,
            'fecha_vinculacion' => $vinculacion, 'fecha_expiracion' => $expiracion,
        ]);
    }

    // Citas
    Cita::crear([
        'id_paciente' => 'pac_01H8X9A', 'id_medico' => 'doc_889900A',
        'fecha_hora' => $local('+2 days', '10:00'), 'duracion_min' => 30, 'motivo' => 'Control de presión arterial',
        'estado' => 'confirmada', 'creado_por' => 'pac_01H8X9A', 'fecha_creacion' => $ahora,
    ]);
    Cita::crear([
        'id_paciente' => 'pac_02J9Y8B', 'id_medico' => 'doc_889900A',
        'fecha_hora' => $local('+3 days', '12:30'), 'duracion_min' => 30, 'motivo' => 'Revisión de estudios de tiroides',
        'estado' => 'pendiente', 'creado_por' => 'pac_02J9Y8B', 'fecha_creacion' => $ahora,
    ]);
    Cita::crear([
        'id_paciente' => 'pac_01H8X9A', 'id_medico' => 'doc_112233',
        'fecha_hora' => $local('-20 days', '11:00'), 'duracion_min' => 30, 'motivo' => 'Inicio de tratamiento antihipertensivo',
        'estado' => 'completada', 'notas_medico' => 'Se inicia Losartán 50mg cada 12 horas.',
        'creado_por' => 'pac_01H8X9A', 'fecha_creacion' => $local('-25 days', '09:00'),
    ]);

    // Chat
    foreach ([
        ['medico', 'Buen día Juan, revisé sus últimas tomas de presión. Vamos bien.', '-1 day', '09:15'],
        ['paciente', 'Gracias doctora. Ayer sentí un ligero mareo después de la dosis.', '-1 day', '09:40'],
        ['medico', 'Anótelo en el registro de síntomas y lo revisamos en la cita.', '-1 day', '10:02'],
    ] as [$remitente, $contenido, $dia, $hora]) {
        Mensaje::crear([
            'id_paciente' => 'pac_01H8X9A', 'id_medico' => 'doc_889900A',
            'remitente' => $remitente, 'tipo' => 'texto', 'contenido' => $contenido, 'fecha_envio' => $local($dia, $hora),
            'leido_en' => $remitente === 'paciente' ? $local($dia, '10:00') : null,
        ]);
    }
    // Perfiles crónicos y su segmentación
    $hipertension = PerfilCronico::crear([
        'id_paciente' => 'pac_01H8X9A', 'condicion' => 'hipertension', 'estado' => 'activo',
        'segmento' => 'seguimiento', 'datos_basales' => ['meta_sistolica' => 140, 'meta_diastolica' => 90],
        'fecha_alta' => $local('-40 days', '09:00'), 'fecha_evaluacion' => $local('-1 day', '08:10'),
    ]);
    EvaluacionCronica::crear([
        'id_perfil' => $hipertension->id_perfil, 'id_paciente' => 'pac_01H8X9A', 'condicion' => 'hipertension',
        'respuestas' => [
            'ctx_reposo' => true, 'ctx_estimulante' => false, 'ctx_malestar' => false,
            'presion_1' => '138/88', 'presion_2' => '134/86', 'frecuencia_cardiaca' => 74,
            'sintomas' => ['ninguno'], 'olvido_dosis' => 1,
        ],
        'segmento' => 'seguimiento', 'severidad' => 'informativa',
        'banderas' => [['codigo' => 'presion_limitrofe', 'roja' => false, 'datos' => ['sistolica' => 136, 'diastolica' => 87]]],
        'confiable' => true, 'fecha' => $local('-1 day', '08:10'),
    ]);

    $diabetes = PerfilCronico::crear([
        'id_paciente' => 'pac_02J9Y8B', 'condicion' => 'diabetes', 'estado' => 'activo',
        'segmento' => 'controlado', 'datos_basales' => ['tipo_diabetes' => 'tipo_2', 'meta_ayuno' => 130],
        'fecha_alta' => $local('-60 days', '10:00'), 'fecha_evaluacion' => $local('-2 days', '07:30'),
    ]);
    EvaluacionCronica::crear([
        'id_perfil' => $diabetes->id_perfil, 'id_paciente' => 'pac_02J9Y8B', 'condicion' => 'diabetes',
        'respuestas' => [
            'ctx_reposo' => true, 'ctx_estimulante' => false, 'ctx_malestar' => false,
            'momento' => 'ayuno', 'glucosa' => 108, 'sintomas_hipo' => ['ninguno'],
            'sintomas_hiper' => ['ninguno'], 'herida_sin_cerrar' => false,
        ],
        'segmento' => 'controlado', 'severidad' => 'informativa', 'banderas' => [],
        'confiable' => true, 'fecha' => $local('-2 days', '07:30'),
    ]);

    // Privacidad: Juan comparte todo con su médico salvo el historial quirúrgico.
    PreferenciaPrivacidad::fijar('pac_01H8X9A', 'medico', 'cirugias', false);
    PreferenciaPrivacidad::fijar('pac_01H8X9A', 'exportacion', 'identificaciones', false);
}
