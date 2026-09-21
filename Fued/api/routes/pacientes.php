<?php
declare(strict_types=1);

/**
 * Colecciones simples del expediente. Cada una apunta a su modelo del ORM y
 * declara qué campos acepta, así las rutas de alta y baja son genéricas.
 */
function coleccionesExpediente(): array
{
    return [
        'alergias' => [
            'modelo' => Alergia::class, 'orden' => 'alergeno',
            'campos' => ['alergeno' => 120, 'severidad' => 60, 'reaccion' => 255],
            'requeridos' => ['alergeno', 'severidad'],
        ],
        'condiciones' => [
            'modelo' => CondicionCritica::class, 'orden' => 'descripcion',
            'campos' => ['descripcion' => 255], 'requeridos' => ['descripcion'],
        ],
        'medicacion-rescate' => [
            'modelo' => MedicacionRescate::class, 'orden' => 'descripcion',
            'campos' => ['descripcion' => 255], 'requeridos' => ['descripcion'],
        ],
        'cirugias' => [
            'modelo' => Cirugia::class, 'orden' => 'fecha', 'direccion' => 'DESC',
            'campos' => ['procedimiento' => 160, 'fecha' => 10, 'notas' => 500],
            'requeridos' => ['procedimiento', 'fecha'], 'fechas' => ['fecha'],
        ],
        'contactos' => [
            'modelo' => ContactoEmergencia::class, 'orden' => 'prioridad',
            'campos' => ['nombre' => 120, 'relacion' => 60, 'telefono' => 20, 'prioridad' => 2],
            'requeridos' => ['nombre', 'relacion', 'telefono'], 'enteros' => ['prioridad'],
        ],
    ];
}

return function (Router $r): void {
    $r->get('/pacientes/{id}', function (array $p): void {
        responder(pacienteAutorizado(sesion(), $p['id'])->expediente());
    });

    // Sólo el propio paciente actualiza sus datos personales e identificaciones.
    $r->put('/pacientes/{id}', function (array $p): void {
        $paciente = pacienteAutorizado(sesion('paciente'), $p['id'], true);
        $d = cuerpoJson();

        $personales = is_array($d['datosPersonales'] ?? null) ? $d['datosPersonales'] : [];
        foreach (['nombre' => 80, 'apellidos' => 120] as $campo => $max) {
            if (array_key_exists($campo, $personales)) {
                $paciente->$campo = texto($personales, $campo, true, $max);
            }
        }
        foreach (['genero' => 30, 'telefono' => 20] as $campo => $max) {
            if (array_key_exists($campo, $personales)) {
                $paciente->$campo = texto($personales, $campo, false, $max);
            }
        }
        if (array_key_exists('fechaNacimiento', $personales)) {
            $paciente->fecha_nacimiento = fecha($personales, 'fechaNacimiento', false);
        }

        $identificaciones = is_array($d['identificaciones'] ?? null) ? $d['identificaciones'] : [];
        if (array_key_exists('curp', $identificaciones)) {
            $curp = texto($identificaciones, 'curp', false, 18);
            if ($curp !== null) {
                $curp = strtoupper($curp);
                if (!preg_match('/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/', $curp)) {
                    throw errorCampo('curp_invalida', 'curp', 'La CURP no tiene un formato válido.');
                }
                if (Paciente::donde('curp', $curp)->donde('id_paciente', '<>', $p['id'])->existe()) {
                    throw new HttpError(409, 'curp_registrada', 'Ya existe un paciente con esa CURP.');
                }
            }
            $paciente->curp = $curp;
        }
        if (array_key_exists('nss', $identificaciones)) {
            $paciente->nss = texto($identificaciones, 'nss', false, 11);
        }

        $emergencia = is_array($d['perfilEmergenciaReducido'] ?? null) ? $d['perfilEmergenciaReducido'] : [];
        if (array_key_exists('tipoSangre', $emergencia)) {
            $paciente->tipo_sangre = opcion($emergencia, 'tipoSangre', ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'], false);
        }
        if (array_key_exists('donadorOrganos', $emergencia)) {
            $paciente->donador_organos = (bool) booleano($emergencia, 'donadorOrganos');
        }

        $paciente->guardar();
        responder($paciente->expediente());
    });

    foreach (coleccionesExpediente() as $nombre => $def) {
        $r->get("/pacientes/{id}/$nombre", function (array $p) use ($def): void {
            autorizarPaciente(sesion(), $p['id']);
            $modelo = $def['modelo'];
            $elementos = $modelo::donde('id_paciente', $p['id'])
                ->ordenar($def['orden'], $def['direccion'] ?? 'ASC')
                ->obtener();
            responder(array_map(fn (Modelo $e) => $e->aDto(), $elementos));
        });

        $r->post("/pacientes/{id}/$nombre", function (array $p) use ($def): void {
            autorizarPaciente(sesion(), $p['id'], true);
            $d = cuerpoJson();
            $atributos = ['id_paciente' => $p['id']];
            foreach ($def['campos'] as $campo => $max) {
                $requerido = in_array($campo, $def['requeridos'], true);
                $atributos[$campo] = match (true) {
                    in_array($campo, $def['fechas'] ?? [], true) => fecha($d, $campo, $requerido),
                    in_array($campo, $def['enteros'] ?? [], true) => entero($d, $campo, $requerido, 1, 99) ?? 1,
                    default => texto($d, $campo, $requerido, $max),
                };
            }
            $modelo = $def['modelo'];
            responder($modelo::crear($atributos)->aDto(), 201);
        });

        $r->delete("/pacientes/{id}/$nombre/{idElemento}", function (array $p) use ($def): void {
            autorizarPaciente(sesion(), $p['id'], true);
            $modelo = $def['modelo'];
            $elemento = $modelo::buscar($p['idElemento']);
            if ($elemento === null || $elemento->id_paciente !== $p['id']) {
                throw new HttpError(404, 'elemento_no_encontrado', 'El registro no existe.');
            }
            $elemento->eliminar();
            responder(null, 204);
        });
    }

    // Tarjetas RFID
    $r->post('/pacientes/{id}/rfid', function (array $p): void {
        autorizarPaciente(sesion(), $p['id'], true);
        $idTarjeta = texto(cuerpoJson(), 'idTarjetaRfid', false, 64) ?? 'rfid_' . bin2hex(random_bytes(8));
        if (DispositivoRfid::buscar($idTarjeta) !== null) {
            throw new HttpError(409, 'tarjeta_registrada', 'Esa tarjeta ya está asignada.');
        }
        $tarjeta = DispositivoRfid::crear([
            'id_tarjeta_rfid' => $idTarjeta, 'id_paciente' => $p['id'], 'estado' => 'activa', 'fecha_asignacion' => ahoraSql(),
        ]);
        responder($tarjeta->aDto(), 201);
    });

    // Baja lógica: la tarjeta nunca se elimina, sólo cambia de estado.
    $r->put('/pacientes/{id}/rfid/{idTarjeta}', function (array $p): void {
        $paciente = pacienteAutorizado(sesion(), $p['id'], true);
        $estado = (string) opcion(cuerpoJson(), 'estado', ['extraviada', 'inactiva']);
        $tarjeta = DispositivoRfid::buscar($p['idTarjeta']);
        if ($tarjeta === null || $tarjeta->id_paciente !== $p['id'] || !$tarjeta->estaActiva()) {
            throw new HttpError(404, 'tarjeta_no_encontrada', 'No hay una tarjeta activa con ese identificador.');
        }
        $tarjeta->revocar($estado);
        responder(array_map(fn (DispositivoRfid $t) => $t->aDto(), $paciente->tarjetas()));
    });

    // Control de accesos: el paciente decide qué médicos ven su expediente.
    $r->get('/pacientes/{id}/accesos', function (array $p): void {
        $paciente = pacienteAutorizado(sesion('paciente'), $p['id']);
        responder(array_map(fn (AccesoMedico $a) => $a->aDto(), $paciente->accesosVigentes()));
    });

    $r->post('/pacientes/{id}/accesos', function (array $p): void {
        $paciente = pacienteAutorizado(sesion('paciente'), $p['id'], true);
        $d = cuerpoJson();
        $idMedico = (string) texto($d, 'idMedico', true, 32);
        $nivel = (string) opcion($d, 'nivelAcceso', ['lectura', 'lectura_escritura']);
        $expiracion = fechaHoraSql($d, 'fechaExpiracion', false);
        if (Medico::verificado($idMedico) === null) {
            throw new HttpError(404, 'medico_no_encontrado', 'El médico no existe o no está verificado.');
        }
        if ($expiracion !== null && $expiracion <= ahoraSql()) {
            throw errorCampo('fecha_pasada', 'fechaExpiracion', 'La fecha de expiración debe ser futura.');
        }

        $acceso = AccesoMedico::buscar(['id_paciente' => $p['id'], 'id_medico' => $idMedico]);
        if ($acceso === null) {
            AccesoMedico::crear([
                'id_paciente' => $p['id'], 'id_medico' => $idMedico, 'nivel_acceso' => $nivel,
                'fecha_vinculacion' => ahoraSql(), 'fecha_expiracion' => $expiracion,
            ]);
        } else {
            if ($acceso->revocado_en !== null) {
                $acceso->fecha_vinculacion = ahoraSql();
            }
            $acceso->nivel_acceso = $nivel;
            $acceso->fecha_expiracion = $expiracion;
            $acceso->revocado_en = null;
            $acceso->guardar();
        }
        responder(array_map(fn (AccesoMedico $a) => $a->aDto(), $paciente->accesosVigentes()), 201);
    });

    $r->delete('/pacientes/{id}/accesos/{idMedico}', function (array $p): void {
        autorizarPaciente(sesion('paciente'), $p['id'], true);
        $acceso = AccesoMedico::entre($p['id'], $p['idMedico']);
        if ($acceso === null) {
            throw new HttpError(404, 'acceso_no_encontrado', 'Ese médico no tiene acceso vigente.');
        }
        $acceso->revocar();
        responder(null, 204);
    });
};
