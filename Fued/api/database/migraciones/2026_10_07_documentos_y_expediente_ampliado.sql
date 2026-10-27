-- Documentos del expediente (fotos, escaneos y PDF con sus metadatos EXIF),
-- vacunas, antecedentes familiares y datos complementarios del paciente.
-- Es idempotente (MariaDB): se puede correr más de una vez.
--   mysql -u fued -p fued < database/migraciones/2026_10_07_documentos_y_expediente_ampliado.sql

ALTER TABLE pacientes
    ADD COLUMN IF NOT EXISTS seguro_medico    VARCHAR(40)   NULL AFTER donador_organos,
    ADD COLUMN IF NOT EXISTS numero_poliza    VARCHAR(40)   NULL AFTER seguro_medico,
    ADD COLUMN IF NOT EXISTS medico_cabecera  VARCHAR(120)  NULL AFTER numero_poliza,
    ADD COLUMN IF NOT EXISTS tabaquismo       ENUM('nunca', 'exfumador', 'actual') NULL AFTER medico_cabecera,
    ADD COLUMN IF NOT EXISTS alcohol          ENUM('no', 'ocasional', 'frecuente') NULL AFTER tabaquismo,
    ADD COLUMN IF NOT EXISTS actividad_fisica ENUM('sedentaria', 'moderada', 'activa') NULL AFTER alcohol,
    ADD COLUMN IF NOT EXISTS discapacidad     VARCHAR(255)  NULL AFTER actividad_fisica,
    ADD COLUMN IF NOT EXISTS notas_medicas    VARCHAR(1000) NULL AFTER discapacidad;

CREATE TABLE IF NOT EXISTS vacunas (
    id           VARCHAR(32)  NOT NULL,
    id_paciente  VARCHAR(32)  NOT NULL,
    vacuna       VARCHAR(120) NOT NULL,
    fecha        DATE         NOT NULL,
    dosis        VARCHAR(40)  NULL,
    lote         VARCHAR(40)  NULL,
    PRIMARY KEY (id),
    KEY idx_vacunas_paciente (id_paciente),
    CONSTRAINT fk_vacunas_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS antecedentes_familiares (
    id            VARCHAR(32)  NOT NULL,
    id_paciente   VARCHAR(32)  NOT NULL,
    parentesco    VARCHAR(60)  NOT NULL,
    padecimiento  VARCHAR(160) NOT NULL,
    notas         VARCHAR(255) NULL,
    PRIMARY KEY (id),
    KEY idx_antecedentes_paciente (id_paciente),
    CONSTRAINT fk_antecedentes_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS documentos_medicos (
    id               VARCHAR(32)  NOT NULL,
    id_paciente      VARCHAR(32)  NOT NULL,
    categoria        ENUM('receta', 'laboratorio', 'imagenologia', 'nota_medica', 'identificacion', 'seguro', 'otro') NOT NULL DEFAULT 'otro',
    titulo           VARCHAR(160) NOT NULL,
    fecha_documento  DATE         NULL,
    notas            VARCHAR(500) NULL,
    origen           ENUM('camara', 'escaner', 'galeria', 'archivo') NOT NULL DEFAULT 'archivo',
    archivo_ruta     VARCHAR(255) NOT NULL,
    archivo_nombre   VARCHAR(255) NOT NULL,
    archivo_mime     VARCHAR(120) NOT NULL,
    archivo_bytes    INT UNSIGNED NOT NULL,
    metadatos        LONGTEXT     NULL,
    subido_por       VARCHAR(32)  NOT NULL,
    subido_por_rol   ENUM('paciente', 'medico') NOT NULL,
    fecha_subida     DATETIME     NOT NULL,
    PRIMARY KEY (id),
    KEY idx_documentos_paciente (id_paciente, fecha_subida),
    CONSTRAINT fk_documentos_paciente FOREIGN KEY (id_paciente) REFERENCES pacientes (id_paciente) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
