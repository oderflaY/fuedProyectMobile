-- Esquema MySQL (8.0+ / MariaDB 10.5+) del sistema Fued.
-- Todas las columnas DATETIME se guardan en UTC; la API las expone como ISO 8601 (YYYY-MM-DDTHH:MM:SSZ).
-- Las fechas de calendario (nacimiento, inicio de tratamiento) usan DATE.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE cuentas (
    id              VARCHAR(32)  NOT NULL,
    rol             ENUM('paciente', 'medico') NOT NULL,
    email           VARCHAR(160) NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    fecha_registro  DATETIME     NOT NULL,
    ultimo_acceso   DATETIME     NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_cuentas_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE pacientes (
    id_paciente       VARCHAR(32)  NOT NULL,
    estado_cuenta     ENUM('activo', 'suspendido', 'inactivo') NOT NULL DEFAULT 'activo',
    curp              CHAR(18)     NULL,
    nss               VARCHAR(11)  NULL,
    nombre            VARCHAR(80)  NOT NULL,
    apellidos         VARCHAR(120) NOT NULL,
    fecha_nacimiento  DATE         NULL,
    genero            VARCHAR(30)  NULL,
    telefono          VARCHAR(20)  NULL,
    tipo_sangre       ENUM('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-') NULL,
    donador_organos   TINYINT(1)   NOT NULL DEFAULT 0,
    PRIMARY KEY (id_paciente),
    UNIQUE KEY uq_pacientes_curp (curp),
    CONSTRAINT fk_pacientes_cuenta FOREIGN KEY (id_paciente) REFERENCES cuentas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medicos (
    id_medico                VARCHAR(32)  NOT NULL,
    estado_cuenta            ENUM('pendiente', 'verificado', 'suspendido') NOT NULL DEFAULT 'pendiente',
    nombre                   VARCHAR(80)  NOT NULL,
    apellidos                VARCHAR(120) NOT NULL,
    genero                   VARCHAR(30)  NULL,
    telefono                 VARCHAR(20)  NULL,
    cedula_profesional       VARCHAR(20)  NOT NULL,
    cedula_especialidad      VARCHAR(20)  NULL,
    especialidad             VARCHAR(120) NULL,
    universidad              VARCHAR(160) NULL,
    estado_verificacion      ENUM('pendiente', 'aprobado', 'rechazado') NOT NULL DEFAULT 'pendiente',
    fecha_verificacion       DATETIME     NULL,
    nombre_clinica           VARCHAR(160) NULL,
    direccion                VARCHAR(255) NULL,
    telefono_recepcion       VARCHAR(20)  NULL,
    alertas_adherencia_baja  TINYINT(1)   NOT NULL DEFAULT 1,
    notificaciones_urgencia  TINYINT(1)   NOT NULL DEFAULT 1,
    tema_visual              ENUM('sistema', 'claro', 'oscuro') NOT NULL DEFAULT 'sistema',
    PRIMARY KEY (id_medico),
    KEY idx_medicos_verificacion (estado_cuenta, estado_verificacion),
    CONSTRAINT fk_medicos_cuenta FOREIGN KEY (id_medico) REFERENCES cuentas (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bajas lógicas: una tarjeta extraviada nunca se borra, cambia de estado y registra fecha_revocacion.
CREATE TABLE dispositivos_rfid (
    id_tarjeta_rfid   VARCHAR(64) NOT NULL,
    id_paciente       VARCHAR(32) NOT NULL,
    estado            ENUM('activa', 'extraviada', 'inactiva') NOT NULL DEFAULT 'activa',
    fecha_asignacion  DATETIME    NOT NULL,
    fecha_revocacion  DATETIME    NULL,
    PRIMARY KEY (id_tarjeta_rfid),
    KEY idx_rfid_paciente (id_paciente),
    CONSTRAINT fk_rfid_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE contactos_emergencia (
    id           VARCHAR(32)  NOT NULL,
    id_paciente  VARCHAR(32)  NOT NULL,
    nombre       VARCHAR(120) NOT NULL,
    relacion     VARCHAR(60)  NOT NULL,
    telefono     VARCHAR(20)  NOT NULL,
    prioridad    TINYINT      NOT NULL DEFAULT 1,
    PRIMARY KEY (id),
    KEY idx_contactos_paciente (id_paciente),
    CONSTRAINT fk_contactos_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE alergias (
    id           VARCHAR(32)  NOT NULL,
    id_paciente  VARCHAR(32)  NOT NULL,
    alergeno     VARCHAR(120) NOT NULL,
    severidad    VARCHAR(60)  NOT NULL,
    reaccion     VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_alergias_paciente (id_paciente),
    CONSTRAINT fk_alergias_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE condiciones_criticas (
    id           VARCHAR(32)  NOT NULL,
    id_paciente  VARCHAR(32)  NOT NULL,
    descripcion  VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_condiciones_paciente (id_paciente),
    CONSTRAINT fk_condiciones_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE medicacion_rescate (
    id           VARCHAR(32)  NOT NULL,
    id_paciente  VARCHAR(32)  NOT NULL,
    descripcion  VARCHAR(255) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_rescate_paciente (id_paciente),
    CONSTRAINT fk_rescate_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE cirugias (
    id             VARCHAR(32)  NOT NULL,
    id_paciente    VARCHAR(32)  NOT NULL,
    procedimiento  VARCHAR(160) NOT NULL,
    fecha          DATE         NOT NULL,
    notas          VARCHAR(500) NULL,
    PRIMARY KEY (id),
    KEY idx_cirugias_paciente (id_paciente),
    CONSTRAINT fk_cirugias_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE metricas_vitales (
    id                   VARCHAR(32)  NOT NULL,
    id_paciente          VARCHAR(32)  NOT NULL,
    peso_kg              DECIMAL(5,1) NULL,
    altura_cm            DECIMAL(5,1) NULL,
    imc                  DECIMAL(4,1) NULL,
    presion_arterial     VARCHAR(7)   NULL,
    frecuencia_cardiaca  SMALLINT     NULL,
    glucosa_mg_dl        DECIMAL(5,1) NULL,
    temperatura_c        DECIMAL(4,1) NULL,
    notas                VARCHAR(500) NULL,
    registrado_por       VARCHAR(32)  NOT NULL,
    fecha_toma           DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_metricas_paciente_fecha (id_paciente, fecha_toma),
    CONSTRAINT fk_metricas_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE tratamientos (
    id_tratamiento      VARCHAR(32)  NOT NULL,
    id_paciente         VARCHAR(32)  NOT NULL,
    medicamento         VARCHAR(120) NOT NULL,
    dosis               VARCHAR(60)  NOT NULL,
    frecuencia_horas    SMALLINT     NOT NULL,
    horarios_sugeridos  JSON         NOT NULL,
    via_administracion  VARCHAR(40)  NOT NULL DEFAULT 'Oral',
    fecha_inicio        DATE         NOT NULL,
    fecha_fin           DATE         NULL,
    id_medico_receta    VARCHAR(32)  NULL,
    cantidad_restante   INT          NOT NULL DEFAULT 0,
    umbral_alerta       INT          NOT NULL DEFAULT 5,
    activo              TINYINT(1)   NOT NULL DEFAULT 1,
    fecha_creacion      DATETIME     NOT NULL,
    PRIMARY KEY (id_tratamiento),
    KEY idx_tratamientos_paciente (id_paciente, activo),
    CONSTRAINT fk_tratamientos_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE,
    CONSTRAINT fk_tratamientos_medico FOREIGN KEY (id_medico_receta) REFERENCES medicos (id_medico) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE registro_adherencia (
    id_toma                VARCHAR(32)  NOT NULL,
    id_tratamiento         VARCHAR(32)  NOT NULL,
    id_paciente            VARCHAR(32)  NOT NULL,
    fecha_hora_programada  DATETIME     NOT NULL,
    fecha_hora_real        DATETIME     NULL,
    estado                 ENUM('tomado', 'tomado_tarde', 'omitido') NOT NULL,
    sintomas_asociados     VARCHAR(500) NULL,
    PRIMARY KEY (id_toma),
    UNIQUE KEY uq_toma_programada (id_tratamiento, fecha_hora_programada),
    KEY idx_adherencia_paciente_fecha (id_paciente, fecha_hora_programada),
    CONSTRAINT fk_adherencia_tratamiento FOREIGN KEY (id_tratamiento) REFERENCES tratamientos (id_tratamiento) ON DELETE CASCADE,
    CONSTRAINT fk_adherencia_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Un paciente otorga acceso a un médico; revocar es una baja lógica (revocado_en).
CREATE TABLE accesos_medicos (
    id_paciente        VARCHAR(32) NOT NULL,
    id_medico          VARCHAR(32) NOT NULL,
    nivel_acceso       ENUM('lectura', 'lectura_escritura') NOT NULL,
    fecha_vinculacion  DATETIME    NOT NULL,
    fecha_expiracion   DATETIME    NULL,
    revocado_en        DATETIME    NULL,
    PRIMARY KEY (id_paciente, id_medico),
    KEY idx_accesos_medico (id_medico),
    CONSTRAINT fk_accesos_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE,
    CONSTRAINT fk_accesos_medico FOREIGN KEY (id_medico) REFERENCES medicos (id_medico) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE citas (
    id_cita              VARCHAR(32)  NOT NULL,
    id_paciente          VARCHAR(32)  NOT NULL,
    id_medico            VARCHAR(32)  NOT NULL,
    fecha_hora           DATETIME     NOT NULL,
    duracion_min         SMALLINT     NOT NULL DEFAULT 30,
    motivo               VARCHAR(500) NOT NULL,
    estado               ENUM('pendiente', 'confirmada', 'cancelada', 'completada') NOT NULL DEFAULT 'pendiente',
    notas_medico         TEXT         NULL,
    creado_por           VARCHAR(32)  NOT NULL,
    fecha_creacion       DATETIME     NOT NULL,
    fecha_actualizacion  DATETIME     NULL,
    PRIMARY KEY (id_cita),
    KEY idx_citas_medico_fecha (id_medico, fecha_hora),
    KEY idx_citas_paciente_fecha (id_paciente, fecha_hora),
    CONSTRAINT fk_citas_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE,
    CONSTRAINT fk_citas_medico FOREIGN KEY (id_medico) REFERENCES medicos (id_medico) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mensajes (
    secuencia    BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    id_mensaje   VARCHAR(32)     NOT NULL,
    id_paciente  VARCHAR(32)     NOT NULL,
    id_medico    VARCHAR(32)     NOT NULL,
    remitente    ENUM('paciente', 'medico') NOT NULL,
    tipo         ENUM('texto', 'audio', 'imagen', 'archivo') NOT NULL DEFAULT 'texto',
    contenido    TEXT            NOT NULL,
    archivo_ruta    VARCHAR(255) NULL,
    archivo_nombre  VARCHAR(255) NULL,
    archivo_mime    VARCHAR(120) NULL,
    archivo_bytes   INT UNSIGNED NULL,
    duracion_seg    SMALLINT UNSIGNED NULL,
    fecha_envio  DATETIME        NOT NULL,
    leido_en     DATETIME        NULL,
    PRIMARY KEY (secuencia),
    UNIQUE KEY uq_mensajes_id (id_mensaje),
    KEY idx_mensajes_conversacion (id_paciente, id_medico, secuencia),
    CONSTRAINT fk_mensajes_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE,
    CONSTRAINT fk_mensajes_medico FOREIGN KEY (id_medico) REFERENCES medicos (id_medico) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
