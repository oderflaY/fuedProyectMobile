<?php
declare(strict_types=1);

return function (Router $r): void {
    // Directorio de médicos verificados (para agendar citas y otorgar accesos).
    $r->get('/medicos', function (): void {
        sesion();
        $consulta = Medico::verificados();
        $busqueda = parametro('q');
        if ($busqueda !== null) {
            $patron = "%$busqueda%";
            $consulta->dondeCrudo('nombre LIKE ? OR apellidos LIKE ? OR especialidad LIKE ?', [$patron, $patron, $patron]);
        }
        $medicos = $consulta->ordenar('apellidos')->ordenar('nombre')->limitar(100)->obtener();
        responder(array_map(fn (Medico $m) => $m->aDtoPublico(), $medicos));
    });

    $r->get('/medicos/yo', function (): void {
        $medico = Medico::buscarOFallar(sesion('medico')['id'], 'medico_no_encontrado', 'El médico no existe.');
        responder($medico->perfil());
    });

    $r->put('/medicos/yo', function (): void {
        $medico = Medico::buscarOFallar(sesion('medico')['id'], 'medico_no_encontrado', 'El médico no existe.');
        $d = cuerpoJson();

        $personales = is_array($d['datosPersonales'] ?? null) ? $d['datosPersonales'] : [];
        foreach (['nombre' => [80, true], 'apellidos' => [120, true], 'genero' => [30, false], 'telefono' => [20, false]] as $campo => [$max, $req]) {
            if (array_key_exists($campo, $personales)) {
                $medico->$campo = texto($personales, $campo, $req, $max);
            }
        }

        $credenciales = is_array($d['credenciales'] ?? null) ? $d['credenciales'] : [];
        foreach (['especialidad', 'universidad'] as $campo) {
            if (array_key_exists($campo, $credenciales)) {
                $medico->$campo = texto($credenciales, $campo, false, 160);
            }
        }
        // Cambiar una cédula obliga a verificarla de nuevo (salvo en modo desarrollo).
        foreach (['cedulaProfesional' => 'cedula_profesional', 'cedulaEspecialidad' => 'cedula_especialidad'] as $campo => $columna) {
            if (array_key_exists($campo, $credenciales)) {
                $medico->$columna = texto($credenciales, $campo, $campo === 'cedulaProfesional', 20);
                if (!config('auto_verificar_medicos')) {
                    $medico->estado_verificacion = 'pendiente';
                    $medico->estado_cuenta = 'pendiente';
                    $medico->fecha_verificacion = null;
                }
            }
        }

        $trabajo = is_array($d['lugarTrabajo'] ?? null) ? $d['lugarTrabajo'] : [];
        foreach (['nombreClinica' => ['nombre_clinica', 160], 'direccion' => ['direccion', 255], 'telefonoRecepcion' => ['telefono_recepcion', 20]] as $campo => [$columna, $max]) {
            if (array_key_exists($campo, $trabajo)) {
                $medico->$columna = texto($trabajo, $campo, false, $max);
            }
        }

        $dashboard = is_array($d['configuracionDashboard'] ?? null) ? $d['configuracionDashboard'] : [];
        foreach (['alertasAdherenciaBaja' => 'alertas_adherencia_baja', 'notificacionesUrgencia' => 'notificaciones_urgencia'] as $campo => $columna) {
            if (array_key_exists($campo, $dashboard)) {
                $medico->$columna = (bool) booleano($dashboard, $campo);
            }
        }
        if (array_key_exists('temaVisual', $dashboard)) {
            $medico->tema_visual = opcion($dashboard, 'temaVisual', ['sistema', 'claro', 'oscuro']);
        }

        $medico->guardar();
        responder($medico->perfil());
    });

    $r->get('/medicos/{id}', function (array $p): void {
        sesion();
        $medico = Medico::verificado($p['id'])
            ?? throw new HttpError(404, 'medico_no_encontrado', 'El médico no existe o no está verificado.');
        responder($medico->aDtoPublico());
    });
};
