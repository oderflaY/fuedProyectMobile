-- Privacidad selectiva del expediente, segmentación por enfermedad crónica y
-- bandeja de alertas clínicas para el médico tratante.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- El paciente decide, por audiencia, qué secciones de su expediente se muestran.
-- Las secciones de seguridad vital (alergias, medicación de rescate, condiciones
-- críticas y tipo de sangre) no son ocultables ante una urgencia: el catálogo de
-- api/lib/privacidad.php las marca como `siempre` y esta tabla nunca las guarda.
CREATE TABLE preferencias_privacidad (
    id_paciente     VARCHAR(32) NOT NULL,
    audiencia       ENUM('medico', 'emergencia', 'exportacion') NOT NULL,
    seccion         VARCHAR(40) NOT NULL,
    visible         TINYINT(1)  NOT NULL DEFAULT 1,
    actualizado_en  DATETIME    NOT NULL,
    PRIMARY KEY (id_paciente, audiencia, seccion),
    CONSTRAINT fk_privacidad_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Una fila por enfermedad crónica declarada. `datos_basales` guarda las
-- referencias personales que dan precisión al tamizaje (mejor flujo espiratorio,
-- peso seco, meta de presión) y evitan comparar contra promedios poblacionales.
CREATE TABLE perfiles_cronicos (
    id_perfil         VARCHAR(32) NOT NULL,
    id_paciente       VARCHAR(32) NOT NULL,
    condicion         ENUM('hipertension', 'diabetes', 'asma_epoc', 'cardiopatia', 'renal') NOT NULL,
    estado            ENUM('activo', 'archivado') NOT NULL DEFAULT 'activo',
    segmento          ENUM('sin_clasificar', 'controlado', 'seguimiento', 'riesgo') NOT NULL DEFAULT 'sin_clasificar',
    datos_basales     JSON        NULL,
    fecha_alta        DATETIME    NOT NULL,
    fecha_evaluacion  DATETIME    NULL,
    PRIMARY KEY (id_perfil),
    UNIQUE KEY uq_perfil_paciente_condicion (id_paciente, condicion),
    KEY idx_perfiles_paciente (id_paciente, estado),
    CONSTRAINT fk_perfiles_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada corrida del cuestionario guiado. `confiable` en 0 significa que el propio
-- paciente declaró un contexto que invalida la medición (sin reposo previo, café,
-- ejercicio o dolor agudo): esas evaluaciones no disparan alertas de seguimiento,
-- sólo piden repetir la toma. Las banderas rojas alertan aunque no sea confiable.
CREATE TABLE evaluaciones_cronicas (
    id_evaluacion  VARCHAR(32) NOT NULL,
    id_perfil      VARCHAR(32) NOT NULL,
    id_paciente    VARCHAR(32) NOT NULL,
    condicion      ENUM('hipertension', 'diabetes', 'asma_epoc', 'cardiopatia', 'renal') NOT NULL,
    respuestas     JSON        NOT NULL,
    segmento       ENUM('controlado', 'seguimiento', 'riesgo') NOT NULL,
    severidad      ENUM('informativa', 'atencion', 'urgente') NOT NULL,
    banderas       JSON        NOT NULL,
    confiable      TINYINT(1)  NOT NULL DEFAULT 1,
    id_metrica     VARCHAR(32) NULL,
    fecha          DATETIME    NOT NULL,
    PRIMARY KEY (id_evaluacion),
    KEY idx_evaluaciones_paciente_fecha (id_paciente, fecha),
    KEY idx_evaluaciones_perfil_fecha (id_perfil, fecha),
    CONSTRAINT fk_evaluaciones_perfil FOREIGN KEY (id_perfil) REFERENCES perfiles_cronicos (id_perfil) ON DELETE CASCADE,
    CONSTRAINT fk_evaluaciones_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Bandeja del médico. El texto visible no se guarda: se almacena la clave de
-- strings.xml y sus parámetros, para que la app lo traduzca (DM_Arquitectura_App.md, sección 5).
CREATE TABLE alertas_clinicas (
    id_alerta       VARCHAR(32) NOT NULL,
    id_paciente     VARCHAR(32) NOT NULL,
    id_medico       VARCHAR(32) NOT NULL,
    id_evaluacion   VARCHAR(32) NULL,
    origen          ENUM('segmentacion', 'metrica', 'adherencia') NOT NULL,
    condicion       VARCHAR(20) NULL,
    severidad       ENUM('informativa', 'atencion', 'urgente') NOT NULL,
    clave_titulo    VARCHAR(80) NOT NULL,
    clave_detalle   VARCHAR(80) NOT NULL,
    datos           JSON        NULL,
    estado          ENUM('nueva', 'vista', 'atendida') NOT NULL DEFAULT 'nueva',
    fecha_creacion  DATETIME    NOT NULL,
    fecha_atencion  DATETIME    NULL,
    notas_medico    VARCHAR(500) NULL,
    PRIMARY KEY (id_alerta),
    KEY idx_alertas_medico_estado (id_medico, estado, fecha_creacion),
    KEY idx_alertas_paciente_fecha (id_paciente, fecha_creacion),
    CONSTRAINT fk_alertas_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE,
    CONSTRAINT fk_alertas_medico FOREIGN KEY (id_medico) REFERENCES medicos (id_medico) ON DELETE CASCADE,
    CONSTRAINT fk_alertas_evaluacion FOREIGN KEY (id_evaluacion) REFERENCES evaluaciones_cronicas (id_evaluacion) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- El chat necesita un tercer remitente: los avisos automáticos no los escribe
-- ni el paciente ni el médico. `propio` queda en false para ambos, así que el
-- mensaje se ve como entrante en las dos pantallas.
ALTER TABLE mensajes
    MODIFY remitente ENUM('paciente', 'medico', 'sistema') NOT NULL;
