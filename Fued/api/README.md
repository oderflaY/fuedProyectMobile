# Fued API (PHP + MySQL)

API REST del sistema de seguimiento médico: citas, tomas diarias de medicamentos,
signos vitales, historial clínico, control de accesos médico-paciente, chat y
perfil de emergencia por RFID. Los JSON siguen los DTO de `DM_HistorialMedico.md`
y `DM_PerfilMedico.md`.

## Requisitos

- PHP 8.1 o superior con la extensión `pdo_mysql`
- MySQL 8.0+ o MariaDB 10.5+

En CachyOS / Arch:

```bash
sudo pacman -S php mariadb
sudo sed -i 's/^;extension=pdo_mysql/extension=pdo_mysql/' /etc/php/php.ini
sudo mariadb-install-db --user=mysql --basedir=/usr --datadir=/var/lib/mysql
sudo systemctl enable --now mariadb
```

MariaDB en Arch autentica a `root` por socket, así que crea un usuario para la API:

```sql
-- sudo mariadb
CREATE USER 'fued'@'localhost' IDENTIFIED BY 'fued';
GRANT ALL PRIVILEGES ON fued.* TO 'fued'@'localhost';
GRANT ALL PRIVILEGES ON fued_test.* TO 'fued'@'localhost';
```

## Configuración

Todo está en `config.php` y se puede sobreescribir con variables de entorno:

| Variable              | Default                 | Uso                                  |
|-----------------------|-------------------------|--------------------------------------|
| `FUED_DB_HOST`        | `127.0.0.1`             | Servidor MySQL                       |
| `FUED_DB_PORT`        | `3306`                  | Puerto                               |
| `FUED_DB_NAME`        | `fued`                  | Base de datos                        |
| `FUED_DB_USER`        | `root`                  | Usuario                              |
| `FUED_DB_PASS`        | *(vacío)*               | Contraseña                           |
| `FUED_JWT_SECRET`     | secreto de desarrollo   | **Cámbialo en producción**           |
| `FUED_AUTO_VERIFICAR` | `1`                     | `0` = los médicos nuevos quedan pendientes de validar cédula |

## Instalar y ejecutar

```bash
cd api
export FUED_DB_USER=fued FUED_DB_PASS=fued

php database/instalar.php          # crea la base `fued`, las tablas y los datos demo
php -S 0.0.0.0:8080 -d upload_max_filesize=10M -d post_max_size=12M index.php
```

Los adjuntos del chat (notas de voz, PDF, fotos) se guardan en `api/almacenamiento/chat/`
y sólo se sirven a través de la API. Si usas Apache, ese `php.ini` debe permitir
`upload_max_filesize = 10M` y `post_max_size = 12M`.

Si instalaste la base **antes** de la versión con chat multimedia, aplica la migración:

```bash
mysql -u fued -p fued < database/migraciones/2026_09_21_adjuntos_chat.sql
```

`php database/instalar.php --reiniciar` borra la base y la vuelve a crear.
`--sin-demo` instala sólo las tablas. También puedes importar `database/schema.sql`
desde phpMyAdmin o MySQL Workbench (sin datos demo).

### Publicar en XAMPP (/opt/lampp)

`desplegar.sh` copia la API a `htdocs` (el código fuente sigue viviendo en el repositorio):

```bash
sudo ./api/desplegar.sh --con-base     # publica y crea la base con datos demo
sudo ./api/desplegar.sh                # sólo publica (actualizaciones posteriores)
curl http://localhost/fued-api/        # comprobación: {"nombre":"Fued API",...}
```

Queda en `/opt/lampp/htdocs/fued-api` y responde en `http://localhost/fued-api`.
El script excluye las pruebas, deja `almacenamiento/` a nombre del usuario de Apache
(`daemon`) y **no borra los adjuntos ya subidos** al volver a publicar.

XAMPP ya trae lo necesario: `pdo_mysql`, `fileinfo`, `mod_rewrite`, `AllowOverride All`
y límites de subida de 40 MB. La app móvil apunta a esta URL en
`src/environments/environment.ts`.

### Cuentas demo (contraseña `Fued12345`)

| Rol      | Correo                           |
|----------|----------------------------------|
| Paciente | `juan.perez@correo.com`          |
| Paciente | `maria.lopez@correo.com`         |
| Médico   | `dr.elena.ruiz@hospital.com`     |
| Médico   | `dr.carlos.mendez@hospital.com`  |

Tarjeta RFID demo: `rfid_hash_abc123` (paciente Juan).

## Pruebas

```bash
FUED_DB_NAME=fued_test php tests/api_test.php
```

Levanta la API en un puerto aleatorio, **recrea la base `fued_test`** y recorre los
flujos de autenticación, permisos, RFID, tomas, tratamientos, métricas, citas, chat y accesos.

## ORM y estructura

La capa de datos es un ORM propio (patrón Active Record), sin Composer ni dependencias:

```
api/
  lib/orm/Modelo.php     clase base: buscar, guardar, eliminar, casteo y relaciones
  lib/orm/Consulta.php   constructor de consultas (donde, ordenar, limitar, con...)
  modelos/               una clase por tabla: Paciente, Medico, Cita, Tratamiento...
  routes/                los endpoints; usan los modelos, no SQL
  lib/                   http, validación, JWT, conexión PDO y utilidades
```

Cada modelo declara su tabla, su llave y sus columnas con tipo, y el ORM castea solo
(`entero`, `decimal`, `booleano`, `json`, `fecha`, `fechaHora`):

```php
$paciente = Paciente::buscar('pac_01H8X9A');
$paciente->tipo_sangre = 'O+';
$paciente->guardar();                       // UPDATE sólo de lo que cambió

foreach ($paciente->tratamientos() as $t) { // relación uno a muchos
    echo $t->medicamento, $t->inventarioBajo() ? ' (surtir)' : '';
}

Cita::donde('id_medico', $id)
    ->donde('estado', 'pendiente')
    ->con('paciente', 'medico')             // precarga: evita N+1 consultas
    ->ordenar('fecha_hora')
    ->limitar(50)
    ->obtener();

Tratamiento::crear([...]);                  // INSERT con id generado (trt_...)
AccesoMedico::buscar(['id_paciente' => $p, 'id_medico' => $m]); // llave compuesta
```

Detalles que vale la pena conocer:

- **Todo va con sentencias preparadas.** Los nombres de columna se validan contra las
  columnas declaradas del modelo y los operadores contra una lista blanca, así que no
  hay concatenación de texto del usuario en el SQL.
- `llenar()` sólo asigna columnas declaradas: protege contra asignación masiva.
- Los DTO de los DM viven en los modelos (`$paciente->expediente()`, `$medico->perfil()`,
  `$cita->aDto()`), no en las rutas.
- `dondeCrudo()` es la salida de emergencia para condiciones que el constructor no cubre.

## Convenciones

- Autenticación: `Authorization: Bearer <JWT>` (HS256, 7 días).
- Fechas con hora: ISO 8601 en UTC (`2026-09-05T08:00:00Z`). MySQL las guarda como `DATETIME` UTC.
- Horarios de medicamentos (`"08:00"`) y de consulta son hora local; los endpoints que
  dependen del día aceptan `?tz=America/Mexico_City` (IANA).
- IDs con prefijo: `pac_`, `doc_`, `trt_`, `log_`, `cit_`, `msg_`, `met_`, `rfid_`.
- Errores: `{"error": {"codigo": "horario_ocupado", "mensaje": "...", "detalles": {...}}}`.
- Bajas lógicas: tarjetas RFID (`extraviada`), tratamientos (`activo = 0`) y accesos médicos (`revocado_en`).
- Adjuntos del chat: máximo 8 MB; el tipo se detecta del contenido real con `finfo` (no del encabezado
  que manda el cliente) y sólo se aceptan audios, imágenes, PDF y documentos de oficina.
  Cada mensaje trae `tipo` (`texto`, `audio`, `imagen`, `archivo`) y `adjunto` con nombre, tamaño y duración.

## Endpoints

| Método | Ruta | Quién | Descripción |
|---|---|---|---|
| POST | `/auth/registro` | público | Crea cuenta de paciente o médico |
| POST | `/auth/login` | público | Devuelve `token` y `usuario` |
| GET | `/auth/yo` | sesión | Usuario actual |
| GET | `/pacientes/{id}` | paciente / médico con acceso | Expediente completo (DTO) |
| PUT | `/pacientes/{id}` | paciente | Datos personales, identificaciones, tipo de sangre, donador |
| GET/POST | `/pacientes/{id}/alergias` | lectura / escritura | También `condiciones`, `medicacion-rescate`, `cirugias`, `contactos` |
| DELETE | `/pacientes/{id}/alergias/{idElemento}` | escritura | Ídem para las otras colecciones |
| POST | `/pacientes/{id}/rfid` | escritura | Asigna tarjeta |
| PUT | `/pacientes/{id}/rfid/{idTarjeta}` | escritura | `{"estado":"extraviada"}` |
| GET/POST | `/pacientes/{id}/accesos` | paciente | Médicos autorizados / otorgar acceso |
| DELETE | `/pacientes/{id}/accesos/{idMedico}` | paciente | Revoca acceso |
| GET/POST | `/pacientes/{id}/tratamientos` | lectura / escritura | Lista / receta |
| PUT/DELETE | `/tratamientos/{idTratamiento}` | escritura | Edita / suspende |
| GET | `/pacientes/{id}/tomas?fecha=&tz=` | lectura | Agenda de tomas del día |
| POST | `/pacientes/{id}/tomas` | paciente | Marca toma `tomado` / `omitido` |
| GET | `/pacientes/{id}/adherencia?desde=&hasta=` | lectura | Historial y % de cumplimiento |
| GET/POST | `/pacientes/{id}/metricas` | lectura / escritura | Signos vitales |
| GET | `/medicos?q=` | sesión | Directorio de médicos verificados |
| GET/PUT | `/medicos/yo` | médico | Perfil (DTO) con pacientes y semáforo de riesgo |
| GET | `/medicos/{id}` | sesión | Perfil público |
| GET | `/citas?estado=&proximas=1` | sesión | Citas del usuario |
| GET | `/citas/disponibilidad?idMedico=&fecha=&tz=` | sesión | Horarios libres |
| POST | `/citas` | sesión | Paciente solicita (pendiente) / médico agenda (confirmada) |
| GET/PUT | `/citas/{id}` | participante | Detalle / confirmar, cancelar, completar, reprogramar, notas |
| GET | `/chat/conversaciones` | sesión | Conversaciones con no leídos |
| GET/POST | `/chat/{idContraparte}/mensajes?despuesDe=` | sesión | Mensajes |
| POST | `/chat/{idContraparte}/adjuntos` | sesión | Nota de voz, PDF, foto o documento (multipart: `archivo`, `contenido`, `duracionSeg`) |
| GET | `/chat/adjuntos/{idMensaje}` | participantes | Descarga el adjunto |
| GET | `/emergencia/rfid/{idTarjeta}` | público | Sólo `perfilEmergenciaReducido` |
