<?php
declare(strict_types=1);

// Configuración central de la API. Los valores sensibles pueden sobreescribirse
// con variables de entorno para no modificar este archivo en producción.
return [
    'db' => [
        'host' => getenv('FUED_DB_HOST') ?: '127.0.0.1',
        'puerto' => (int) (getenv('FUED_DB_PORT') ?: 3306),
        'nombre' => getenv('FUED_DB_NAME') ?: 'fued',
        'usuario' => getenv('FUED_DB_USER') ?: 'root',
        'password' => getenv('FUED_DB_PASS') ?: '',
    ],

    'jwt_secreto' => getenv('FUED_JWT_SECRET') ?: 'dev-fued-cambia-este-secreto-antes-de-produccion',
    'jwt_duracion_segundos' => 60 * 60 * 24 * 7,

    // Orígenes que pueden consumir la API desde el navegador. Usa '*' para permitir cualquiera.
    'origenes_permitidos' => [
        'http://localhost:8100',
        'http://127.0.0.1:8100',
        'http://localhost',
        'https://localhost',
        'capacitor://localhost',
        'ionic://localhost',
    ],

    // Además de la lista anterior, cualquier origen que coincida con este patrón.
    // Por defecto: la app servida desde una IP de red local (192.168.x.x, 10.x.x.x,
    // 172.16-31.x.x) para probar desde el teléfono. Déjalo en '' en producción.
    'origenes_patron' => getenv('FUED_ORIGENES_PATRON') !== false
        ? (string) getenv('FUED_ORIGENES_PATRON')
        : '#^https?://(192\\.168|10|172\\.(1[6-9]|2\\d|3[01]))(\\.\\d{1,3}){2,3}(:\\d+)?$#',

    // Zona horaria por defecto cuando el cliente no envía `tz`.
    'zona_horaria' => 'America/Mexico_City',

    // En desarrollo los médicos recién registrados quedan verificados automáticamente.
    // En producción debe ser false y un administrador valida la cédula profesional.
    'auto_verificar_medicos' => (getenv('FUED_AUTO_VERIFICAR') ?: '1') === '1',

    // Tamaño máximo de un adjunto del chat (audios, PDF, fotos).
    // El php.ini debe permitirlo: upload_max_filesize y post_max_size.
    'max_bytes_adjunto' => 8 * 1024 * 1024,
    // Escaneos y PDF de estudios pesan más que un adjunto del chat.
    'max_bytes_documento' => 15 * 1024 * 1024,

    // Minutos después de la hora programada en que una toma sigue contando como puntual.
    'minutos_tolerancia_toma' => 30,

    'consultas' => [
        'hora_inicio' => '09:00',
        'hora_fin' => '17:00',
        'duracion_min' => 30,
        'dias_laborales' => [1, 2, 3, 4, 5, 6], // ISO-8601: 1 = lunes ... 7 = domingo
    ],
];
