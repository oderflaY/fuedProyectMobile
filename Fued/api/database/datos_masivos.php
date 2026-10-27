<?php
declare(strict_types=1);

// Datos masivos de demostración para las estadísticas (GraphQL + gráficas).
// Genera miles de médicos/pacientes ficticios con 18 meses de historia: citas, signos vitales,
// tomas de medicamento, enfermedades crónicas y alertas. Todo cuelga de cuentas con correo
// @masivo.fued.mx, así que borrarlo es un solo DELETE (las llaves foráneas borran en cascada).
//
//   php database/datos_masivos.php            -> borra los masivos anteriores y genera de nuevo
//   php database/datos_masivos.php --borrar   -> sólo los borra
//
// Es determinista (semilla fija) y no toca las cuentas demo ni los datos reales.

require __DIR__ . '/../lib/bootstrap.php';

const MASIVO_DOMINIO = '@masivo.fued.mx';
const MASIVO_MEDICOS = 120;
const MASIVO_PACIENTES = 10000;
const MASIVO_MESES = 18;
const MASIVO_LOTE = 500;

$pdo = db();
$inicio = microtime(true);

echo "Borrando datos masivos anteriores...\n";
$pdo->exec("DELETE FROM cuentas WHERE email LIKE '%" . MASIVO_DOMINIO . "'");
if (in_array('--borrar', $argv, true)) {
    echo "Listo.\n";
    exit(0);
}

mt_srand(20261027);

/** Elige una clave de un mapa clave => peso. */
function alAzar(array $pesos): string|int
{
    $tirada = mt_rand() / mt_getrandmax() * array_sum($pesos);
    foreach ($pesos as $clave => $peso) {
        $tirada -= $peso;
        if ($tirada <= 0) {
            return $clave;
        }
    }
    return array_key_last($pesos);
}

function probabilidad(float $p): bool
{
    return mt_rand() / mt_getrandmax() < $p;
}

/** Normal aproximada (Box-Muller). */
function normal(float $media, float $desviacion): float
{
    $u = max(1e-9, mt_rand() / mt_getrandmax());
    $v = mt_rand() / mt_getrandmax();
    return $media + $desviacion * sqrt(-2 * log($u)) * cos(2 * M_PI * $v);
}

function uno(array $lista): mixed
{
    return $lista[mt_rand(0, count($lista) - 1)];
}

/** Inserta filas en lotes de MASIVO_LOTE con un INSERT de varias filas. */
function insertar(PDO $pdo, string $tabla, array $columnas, iterable $filas): int
{
    $total = 0;
    $lote = [];
    $marcas = '(' . implode(',', array_fill(0, count($columnas), '?')) . ')';
    $volcar = function () use ($pdo, $tabla, $columnas, $marcas, &$lote, &$total): void {
        if ($lote === []) {
            return;
        }
        $sql = "INSERT INTO $tabla (" . implode(',', $columnas) . ') VALUES '
            . implode(',', array_fill(0, count($lote), $marcas));
        $pdo->prepare($sql)->execute(array_merge(...$lote));
        $total += count($lote);
        $lote = [];
    };
    $pdo->beginTransaction();
    foreach ($filas as $fila) {
        $lote[] = $fila;
        if (count($lote) === MASIVO_LOTE) {
            $volcar();
        }
    }
    $volcar();
    $pdo->commit();
    printf("  %-24s %8s filas\n", $tabla, number_format($total));
    return $total;
}

$ahora = new DateTimeImmutable('now', new DateTimeZone('UTC'));
$origen = $ahora->modify('-' . MASIVO_MESES . ' months')->setTime(0, 0);
$segundosHistoria = $ahora->getTimestamp() - $origen->getTimestamp();
$sql = fn (int $ts): string => gmdate('Y-m-d H:i:s', $ts);
/** Instante al azar entre $desde y $hasta, con más peso al final cuando $sesgo > 1 (el sistema crece). */
$instante = fn (int $desde, int $hasta, float $sesgo = 1.0): int =>
    $desde + (int) ((($hasta - $desde)) * (mt_rand() / mt_getrandmax()) ** (1 / $sesgo));

$hash = password_hash('Fued12345', PASSWORD_DEFAULT);

$nombresH = ['José', 'Luis', 'Juan', 'Miguel', 'Carlos', 'Jorge', 'Francisco', 'Alejandro', 'Fernando', 'Ricardo', 'Eduardo', 'Roberto', 'Daniel', 'Javier', 'Arturo', 'Sergio', 'Raúl', 'Héctor', 'Manuel', 'Óscar', 'Diego', 'Emilio', 'Santiago', 'Mateo', 'Andrés', 'Iván', 'Rubén', 'Alfredo', 'Gerardo', 'Ramón'];
$nombresM = ['María', 'Guadalupe', 'Ana', 'Laura', 'Patricia', 'Rosa', 'Elena', 'Gabriela', 'Adriana', 'Claudia', 'Verónica', 'Sofía', 'Valeria', 'Fernanda', 'Mariana', 'Daniela', 'Andrea', 'Lucía', 'Isabel', 'Teresa', 'Carmen', 'Silvia', 'Alejandra', 'Ximena', 'Regina', 'Paola', 'Leticia', 'Martha', 'Beatriz', 'Diana'];
$apellidos = ['Hernández', 'García', 'Martínez', 'López', 'González', 'Pérez', 'Rodríguez', 'Sánchez', 'Ramírez', 'Cruz', 'Flores', 'Gómez', 'Morales', 'Vázquez', 'Reyes', 'Jiménez', 'Torres', 'Díaz', 'Gutiérrez', 'Ruiz', 'Mendoza', 'Aguilar', 'Ortiz', 'Moreno', 'Castillo', 'Romero', 'Álvarez', 'Méndez', 'Chávez', 'Rivera', 'Juárez', 'Ramos', 'Domínguez', 'Herrera', 'Medina', 'Castro', 'Vargas', 'Guzmán', 'Fernández', 'Salazar', 'Soto', 'Contreras', 'Delgado', 'Rosales', 'Ibarra', 'Ríos', 'Núñez', 'Cisneros', 'Valenzuela', 'Arreola'];
$especialidades = ['Medicina Familiar' => 14, 'Medicina Interna' => 10, 'Cardiología' => 7, 'Endocrinología' => 6, 'Neumología' => 4, 'Nefrología' => 3, 'Geriatría' => 4, 'Pediatría' => 5, 'Ginecología' => 4, 'Neurología' => 3];
$clinicas = ['Hospital de Especialidades', 'Clínica Guadiana', 'Hospital General de Durango', 'Sanatorio Santa María', 'Clínica del Valle', 'Centro Médico Victoria', 'Hospital Ángeles', 'Unidad Médica Norte'];
$sangre = ['O+' => 58, 'A+' => 26, 'B+' => 8, 'O-' => 3, 'A-' => 2, 'AB+' => 2, 'B-' => 0.7, 'AB-' => 0.3];
$medicamentos = [
    'hipertension' => [['Losartán', '50 mg', 24], ['Enalapril', '10 mg', 12], ['Amlodipino', '5 mg', 24]],
    'diabetes' => [['Metformina', '850 mg', 12], ['Glibenclamida', '5 mg', 24], ['Insulina glargina', '20 UI', 24]],
    'asma_epoc' => [['Salbutamol', '2 disparos', 8], ['Budesonida', '200 mcg', 12]],
    'cardiopatia' => [['Ácido acetilsalicílico', '100 mg', 24], ['Atorvastatina', '20 mg', 24], ['Metoprolol', '50 mg', 12]],
    'renal' => [['Furosemida', '40 mg', 24], ['Calcitriol', '0.25 mcg', 24]],
];

// --- Médicos -------------------------------------------------------------------------------
echo 'Generando ' . MASIVO_MEDICOS . ' médicos y ' . MASIVO_PACIENTES . " pacientes...\n";
$medicos = [];
for ($i = 1; $i <= MASIVO_MEDICOS; $i++) {
    $mujer = probabilidad(0.5);
    $medicos[] = [
        'id' => sprintf('docM_%04d', $i),
        'nombre' => uno($mujer ? $nombresM : $nombresH),
        'apellidos' => uno($apellidos) . ' ' . uno($apellidos),
        'genero' => $mujer ? 'Femenino' : 'Masculino',
        'especialidad' => alAzar($especialidades),
        'registro' => $instante($origen->getTimestamp() - 86400 * 60, $ahora->getTimestamp() - 86400 * 30),
        // Unos médicos jalan muchísimos más pacientes que otros.
        'popularidad' => 0.3 + (mt_rand() / mt_getrandmax()) ** 2 * 3,
    ];
}
$popularidad = array_column($medicos, 'popularidad', 'id');

// --- Pacientes -----------------------------------------------------------------------------
$pacientes = [];
for ($i = 1; $i <= MASIVO_PACIENTES; $i++) {
    $genero = alAzar(['Femenino' => 51, 'Masculino' => 47, 'No binario' => 2]);
    $edad = (int) max(1, min(96, round(normal(47, 18))));
    $registro = $instante($origen->getTimestamp(), $ahora->getTimestamp() - 3600, 1.6);
    // Rasgo personal: qué tan constante es con su tratamiento.
    $constancia = max(0.25, min(0.99, normal(0.78, 0.15)));
    $cronicas = [];
    $riesgoEdad = max(0, ($edad - 25) / 60);
    foreach (['hipertension' => 0.62, 'diabetes' => 0.46, 'asma_epoc' => 0.14, 'cardiopatia' => 0.24, 'renal' => 0.12] as $condicion => $base) {
        if (probabilidad($condicion === 'asma_epoc' ? $base : $base * $riesgoEdad)) {
            $cronicas[] = $condicion;
        }
    }
    $pacientes[] = [
        'id' => sprintf('pacM_%05d', $i),
        'nombre' => uno($genero === 'Masculino' ? $nombresH : ($genero === 'Femenino' ? $nombresM : array_merge($nombresH, $nombresM))),
        'apellidos' => uno($apellidos) . ' ' . uno($apellidos),
        'genero' => $genero,
        'nacimiento' => $ahora->modify("-$edad years")->modify('-' . mt_rand(0, 364) . ' days')->format('Y-m-d'),
        'edad' => $edad,
        'registro' => $registro,
        'constancia' => $constancia,
        'cronicas' => $cronicas,
        'medicos' => array_values(array_unique([alAzar($popularidad), ...(probabilidad(0.35) ? [alAzar($popularidad)] : [])])),
    ];
}

$cuentas = function () use ($medicos, $pacientes, $hash, $sql, $ahora): Generator {
    foreach ($medicos as $m) {
        yield [$m['id'], 'medico', strtolower(str_replace('_', '.', $m['id'])) . MASIVO_DOMINIO, $hash, $sql($m['registro']), $sql($ahora->getTimestamp() - mt_rand(0, 86400 * 20))];
    }
    foreach ($pacientes as $p) {
        yield [$p['id'], 'paciente', strtolower(str_replace('_', '.', $p['id'])) . MASIVO_DOMINIO, $hash, $sql($p['registro']), $sql(mt_rand($p['registro'], $ahora->getTimestamp()))];
    }
};
insertar($pdo, 'cuentas', ['id', 'rol', 'email', 'password_hash', 'fecha_registro', 'ultimo_acceso'], $cuentas());

insertar($pdo, 'medicos', ['id_medico', 'estado_cuenta', 'nombre', 'apellidos', 'genero', 'cedula_profesional', 'especialidad', 'estado_verificacion', 'fecha_verificacion', 'nombre_clinica', 'direccion'], (function () use ($medicos, $clinicas, $sql): Generator {
    foreach ($medicos as $i => $m) {
        yield [$m['id'], 'verificado', $m['nombre'], $m['apellidos'], $m['genero'], (string) (30000000 + $i * 7919), $m['especialidad'], 'aprobado', $sql($m['registro'] + 86400), uno($clinicas), 'Durango, Dgo.'];
    }
})());

insertar($pdo, 'pacientes', ['id_paciente', 'estado_cuenta', 'nombre', 'apellidos', 'fecha_nacimiento', 'genero', 'tipo_sangre', 'donador_organos', 'tabaquismo', 'alcohol', 'actividad_fisica'], (function () use ($pacientes, $sangre): Generator {
    foreach ($pacientes as $p) {
        yield [
            $p['id'], alAzar(['activo' => 94, 'inactivo' => 4, 'suspendido' => 2]), $p['nombre'], $p['apellidos'], $p['nacimiento'], $p['genero'],
            alAzar($sangre), (int) probabilidad(0.38),
            alAzar(['nunca' => 62, 'exfumador' => 20, 'actual' => 18]),
            alAzar(['no' => 45, 'ocasional' => 45, 'frecuente' => 10]),
            alAzar(['sedentaria' => 48, 'moderada' => 37, 'activa' => 15]),
        ];
    }
})());

insertar($pdo, 'accesos_medicos', ['id_paciente', 'id_medico', 'nivel_acceso', 'fecha_vinculacion'], (function () use ($pacientes, $sql): Generator {
    foreach ($pacientes as $p) {
        foreach ($p['medicos'] as $idMedico) {
            yield [$p['id'], $idMedico, probabilidad(0.7) ? 'lectura_escritura' : 'lectura', $sql($p['registro'] + mt_rand(0, 86400 * 5))];
        }
    }
})());

// --- Enfermedades crónicas -----------------------------------------------------------------
insertar($pdo, 'perfiles_cronicos', ['id_perfil', 'id_paciente', 'condicion', 'estado', 'segmento', 'fecha_alta', 'fecha_evaluacion'], (function () use ($pacientes, $sql, $ahora): Generator {
    $n = 0;
    foreach ($pacientes as $p) {
        foreach ($p['cronicas'] as $condicion) {
            // Los constantes con su tratamiento suelen estar controlados.
            $c = $p['constancia'];
            $segmento = alAzar(['controlado' => 60 * $c, 'seguimiento' => 30, 'riesgo' => 40 * (1 - $c), 'sin_clasificar' => 6]);
            yield [sprintf('perM_%06d', ++$n), $p['id'], $condicion, probabilidad(0.95) ? 'activo' : 'archivado', $segmento, $sql($p['registro']), $segmento === 'sin_clasificar' ? null : $sql(mt_rand($p['registro'], $ahora->getTimestamp()))];
        }
    }
})());

// --- Tratamientos y tomas ------------------------------------------------------------------
$tratamientos = [];
foreach ($pacientes as $p) {
    foreach ($p['cronicas'] as $condicion) {
        foreach (array_slice($medicamentos[$condicion], 0, mt_rand(1, 2)) as [$medicamento, $dosis, $frecuencia]) {
            $tratamientos[] = [
                'id' => sprintf('trtM_%06d', count($tratamientos) + 1),
                'paciente' => $p,
                'medicamento' => $medicamento,
                'dosis' => $dosis,
                'frecuencia' => $frecuencia,
                'inicio' => $p['registro'] + mt_rand(0, 86400 * 10),
                'medico' => $p['medicos'][0],
            ];
        }
    }
}
insertar($pdo, 'tratamientos', ['id_tratamiento', 'id_paciente', 'medicamento', 'dosis', 'frecuencia_horas', 'horarios_sugeridos', 'via_administracion', 'fecha_inicio', 'id_medico_receta', 'cantidad_restante', 'umbral_alerta', 'activo', 'fecha_creacion'], (function () use ($tratamientos, $sql): Generator {
    foreach ($tratamientos as $t) {
        $horarios = $t['frecuencia'] === 24 ? ['08:00'] : ($t['frecuencia'] === 12 ? ['08:00', '20:00'] : ['06:00', '14:00', '22:00']);
        yield [$t['id'], $t['paciente']['id'], $t['medicamento'], $t['dosis'], $t['frecuencia'], json_encode($horarios), $t['medicamento'] === 'Salbutamol' ? 'Inhalada' : 'Oral', gmdate('Y-m-d', $t['inicio']), $t['medico'], mt_rand(0, 60), 5, 1, $sql($t['inicio'])];
    }
})());

// Una toma registrada cada ~3 días por tratamiento (no cada dosis: si no serían millones).
// La adherencia mejora mes con mes conforme la app madura y baja un poco en diciembre.
insertar($pdo, 'registro_adherencia', ['id_toma', 'id_tratamiento', 'id_paciente', 'fecha_hora_programada', 'fecha_hora_real', 'estado'], (function () use ($tratamientos, $sql, $ahora, $origen, $segundosHistoria): Generator {
    $n = 0;
    foreach ($tratamientos as $t) {
        $constancia = $t['paciente']['constancia'];
        for ($ts = $t['inicio'] + 86400; $ts < $ahora->getTimestamp(); $ts += 86400 * mt_rand(2, 4)) {
            $programada = intdiv($ts, 3600) * 3600;
            $avance = ($programada - $origen->getTimestamp()) / $segundosHistoria;
            $diciembre = gmdate('m', $programada) === '12' ? 0.12 : 0;
            $p = max(0.05, min(0.98, $constancia - 0.15 + 0.2 * $avance - $diciembre));
            $estado = probabilidad($p) ? 'tomado' : (probabilidad(0.55) ? 'tomado_tarde' : 'omitido');
            $real = match ($estado) {
                'tomado' => $sql($programada + mt_rand(-900, 1800)),
                'tomado_tarde' => $sql($programada + mt_rand(3600, 3600 * 5)),
                default => null,
            };
            yield [sprintf('tomM_%07d', ++$n), $t['id'], $t['paciente']['id'], $sql($programada), $real, $estado];
        }
    }
})());

// --- Signos vitales ------------------------------------------------------------------------
insertar($pdo, 'metricas_vitales', ['id', 'id_paciente', 'peso_kg', 'altura_cm', 'imc', 'presion_arterial', 'frecuencia_cardiaca', 'glucosa_mg_dl', 'temperatura_c', 'registrado_por', 'fecha_toma'], (function () use ($pacientes, $sql, $ahora): Generator {
    $n = 0;
    foreach ($pacientes as $p) {
        $hipertenso = in_array('hipertension', $p['cronicas'], true);
        $diabetico = in_array('diabetes', $p['cronicas'], true);
        $altura = $p['edad'] < 16 ? 100 + $p['edad'] * 4 : normal($p['genero'] === 'Masculino' ? 170 : 158, 7);
        $peso = $p['edad'] < 16 ? 15 + $p['edad'] * 2.8 : normal(($altura / 100) ** 2 * 28, 9);
        $basalSistolica = normal($hipertenso ? 145 : 118, 9);
        $basalGlucosa = normal($diabetico ? 165 : 92, $diabetico ? 25 : 8);
        $basalFc = normal(74, 7);
        $tomas = mt_rand(8, 60);
        $desde = $p['registro'];
        for ($k = 0; $k < $tomas; $k++) {
            $ts = mt_rand($desde, $ahora->getTimestamp());
            $mes = (int) gmdate('n', $ts);
            // Temporada decembrina: más glucosa y más presión.
            $fiestas = in_array($mes, [12, 1], true) ? 1 : 0;
            // El tratamiento baja la presión y la glucosa conforme pasan los meses en la app.
            $meses = ($ts - $desde) / (86400 * 30);
            $mejora = min(1, $meses / 12) * $p['constancia'];
            $sistolica = (int) round(normal($basalSistolica - ($hipertenso ? 14 * $mejora : 0) + 4 * $fiestas, 6));
            $diastolica = (int) round($sistolica * normal(0.64, 0.03));
            $glucosa = round(normal($basalGlucosa - ($diabetico ? 35 * $mejora : 0) + ($diabetico ? 22 : 6) * $fiestas, $diabetico ? 18 : 6), 1);
            $pesoHoy = round($peso + normal(1.2 * $fiestas, 0.8), 1);
            yield [
                sprintf('metM_%07d', ++$n), $p['id'], $pesoHoy, round($altura, 1), round($pesoHoy / (($altura / 100) ** 2), 1),
                "$sistolica/$diastolica", (int) round(normal($basalFc, 5)), $glucosa, round(normal(36.6, 0.3), 1),
                probabilidad(0.75) ? $p['id'] : $p['medicos'][0], $sql($ts),
            ];
        }
    }
})());

// --- Citas ---------------------------------------------------------------------------------
insertar($pdo, 'citas', ['id_cita', 'id_paciente', 'id_medico', 'fecha_hora', 'duracion_min', 'motivo', 'estado', 'creado_por', 'fecha_creacion'], (function () use ($pacientes, $sql, $ahora): Generator {
    $motivos = ['Consulta de control', 'Revisión de presión arterial', 'Ajuste de dosis', 'Resultados de laboratorio', 'Dolor de cabeza persistente', 'Seguimiento de glucosa', 'Chequeo general', 'Renovación de receta', 'Falta de aire', 'Dolor en el pecho', 'Revisión de pies', 'Valoración nutricional'];
    $n = 0;
    $limite = $ahora->getTimestamp() + 86400 * 60;
    foreach ($pacientes as $p) {
        $citas = mt_rand(2, 8) + count($p['cronicas']) * mt_rand(1, 3);
        for ($k = 0; $k < $citas; $k++) {
            $dia = mt_rand($p['registro'], $limite);
            // Entre semana, de 8 a 18 h hora de Durango (UTC-6).
            while (in_array((int) gmdate('N', $dia), [6, 7], true)) {
                $dia += 86400;
            }
            $ts = strtotime(gmdate('Y-m-d', $dia) . ' ' . sprintf('%02d:%s:00', mt_rand(14, 23), uno(['00', '30'])) . ' UTC');
            $pasada = $ts < $ahora->getTimestamp();
            $estado = $pasada
                ? alAzar(['completada' => 74 + 10 * $p['constancia'], 'cancelada' => 16])
                : alAzar(['pendiente' => 45, 'confirmada' => 45, 'cancelada' => 6]);
            $creada = max($p['registro'], $ts - 86400 * mt_rand(1, 21));
            yield [sprintf('citM_%07d', ++$n), $p['id'], uno($p['medicos']), $sql($ts), uno([20, 30, 30, 45, 60]), uno($motivos), $estado, probabilidad(0.6) ? $p['id'] : $p['medicos'][0], $sql($creada)];
        }
    }
})());

// --- Alertas clínicas ----------------------------------------------------------------------
insertar($pdo, 'alertas_clinicas', ['id_alerta', 'id_paciente', 'id_medico', 'origen', 'condicion', 'severidad', 'clave_titulo', 'clave_detalle', 'datos', 'estado', 'fecha_creacion', 'fecha_atencion'], (function () use ($pacientes, $sql, $ahora): Generator {
    $n = 0;
    foreach ($pacientes as $p) {
        // Los que no siguen su tratamiento generan muchas más alertas.
        $cuantas = (int) round(count($p['cronicas']) * (1 - $p['constancia']) * mt_rand(6, 22));
        for ($k = 0; $k < $cuantas; $k++) {
            $ts = mt_rand($p['registro'], $ahora->getTimestamp());
            $origenAlerta = alAzar(['segmentacion' => 50, 'metrica' => 30, 'adherencia' => 20]);
            $severidad = alAzar(['informativa' => 30, 'atencion' => 50, 'urgente' => 20]);
            $condicion = $origenAlerta === 'adherencia' ? null : uno($p['cronicas'] ?: ['hipertension']);
            $dias = ($ahora->getTimestamp() - $ts) / 86400;
            $estado = $dias > 14 ? alAzar(['atendida' => 85, 'vista' => 13, 'nueva' => 2]) : alAzar(['nueva' => 50, 'vista' => 30, 'atendida' => 20]);
            yield [
                sprintf('alrM_%07d', ++$n), $p['id'], uno($p['medicos']), $origenAlerta, $condicion, $severidad,
                $severidad === 'informativa' ? 'alerta_titulo_atencion' : "alerta_titulo_$severidad", "alerta_detalle_$origenAlerta",
                json_encode(['paciente' => $p['nombre'] . ' ' . $p['apellidos'], 'condicion' => $condicion], JSON_UNESCAPED_UNICODE),
                $estado, $sql($ts), $estado === 'atendida' ? $sql(min($ahora->getTimestamp(), $ts + mt_rand(600, 86400 * 3))) : null,
            ];
        }
    }
})());

// Las estadísticas cachean unos minutos: se limpian para ver los datos nuevos de inmediato.
array_map('unlink', glob(sys_get_temp_dir() . '/fued-estadistica-*.json') ?: []);

printf("Listo en %.1f s.\n", microtime(true) - $inicio);
