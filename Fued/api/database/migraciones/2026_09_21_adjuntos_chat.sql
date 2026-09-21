-- Adjuntos en el chat (audios, PDF, imágenes y archivos).
-- Aplica esta migración sólo si instalaste la base antes de esta versión:
--   mysql -u fued -p fued < database/migraciones/2026_09_21_adjuntos_chat.sql

ALTER TABLE mensajes
    ADD COLUMN tipo ENUM('texto', 'audio', 'imagen', 'archivo') NOT NULL DEFAULT 'texto' AFTER remitente,
    ADD COLUMN archivo_ruta   VARCHAR(255) NULL AFTER contenido,
    ADD COLUMN archivo_nombre VARCHAR(255) NULL AFTER archivo_ruta,
    ADD COLUMN archivo_mime   VARCHAR(120) NULL AFTER archivo_nombre,
    ADD COLUMN archivo_bytes  INT UNSIGNED NULL AFTER archivo_mime,
    ADD COLUMN duracion_seg   SMALLINT UNSIGNED NULL AFTER archivo_bytes;
