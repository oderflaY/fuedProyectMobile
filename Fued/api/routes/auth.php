<?php
declare(strict_types=1);

return function (Router $r): void {
    $r->post('/auth/registro', function (): void {
        $d = cuerpoJson();
        $rol = (string) opcion($d, 'rol', ['paciente', 'medico']);
        $email = correo($d, 'email');
        $password = (string) texto($d, 'password', true, 128);
        if (mb_strlen($password) < 8) {
            throw errorCampo('password_corta', 'password', 'La contraseña debe tener al menos 8 caracteres.');
        }
        $comunes = [
            'nombre' => texto($d, 'nombre', true, 80),
            'apellidos' => texto($d, 'apellidos', true, 120),
            'telefono' => texto($d, 'telefono', false, 20),
            'genero' => texto($d, 'genero', false, 30),
        ];

        if (Cuenta::porEmail($email) !== null) {
            throw new HttpError(409, 'email_registrado', 'Ya existe una cuenta con ese correo.');
        }

        if ($rol === 'paciente') {
            $curp = texto($d, 'curp', false, 18);
            if ($curp !== null) {
                $curp = strtoupper($curp);
                if (!preg_match('/^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/', $curp)) {
                    throw errorCampo('curp_invalida', 'curp', 'La CURP no tiene un formato válido.');
                }
                if (Paciente::donde('curp', $curp)->existe()) {
                    throw new HttpError(409, 'curp_registrada', 'Ya existe un paciente con esa CURP.');
                }
            }
            $id = nuevoId('pac');
            $perfil = ['id_paciente' => $id, 'curp' => $curp, 'nss' => texto($d, 'nss', false, 11),
                'fecha_nacimiento' => fecha($d, 'fechaNacimiento', false)] + $comunes;
        } else {
            $verificado = (bool) config('auto_verificar_medicos');
            $id = nuevoId('doc');
            $perfil = [
                'id_medico' => $id,
                'cedula_profesional' => texto($d, 'cedulaProfesional', true, 20),
                'especialidad' => texto($d, 'especialidad', false, 120),
                'estado_cuenta' => $verificado ? 'verificado' : 'pendiente',
                'estado_verificacion' => $verificado ? 'aprobado' : 'pendiente',
                'fecha_verificacion' => $verificado ? ahoraSql() : null,
            ] + $comunes;
        }

        enTransaccion(function () use ($id, $rol, $email, $password, $perfil): void {
            Cuenta::registrar($id, $rol, $email, $password);
            $rol === 'paciente' ? Paciente::crear($perfil) : Medico::crear($perfil);
        });

        responder(['token' => emitirToken($id, $rol), 'usuario' => usuarioResumen($id)], 201);
    });

    $r->post('/auth/login', function (): void {
        $d = cuerpoJson();
        $cuenta = Cuenta::porEmail(correo($d, 'email'));
        if ($cuenta === null || !$cuenta->passwordCorrecta((string) texto($d, 'password', true, 128))) {
            throw new HttpError(401, 'credenciales_invalidas', 'Correo o contraseña incorrectos.');
        }
        $cuenta->registrarAcceso();
        responder(['token' => emitirToken((string) $cuenta->id, (string) $cuenta->rol), 'usuario' => $cuenta->aDto()]);
    });

    $r->get('/auth/yo', fn () => responder(usuarioResumen(sesion()['id'])));
};
