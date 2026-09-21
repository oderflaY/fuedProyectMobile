<?php
declare(strict_types=1);

/**
 * Modelo base del ORM (patrón Active Record).
 *
 * Cada tabla tiene una clase que declara sus columnas con su tipo; el modelo
 * se encarga de leer, guardar, castear y relacionar sin escribir SQL a mano:
 *
 *   $paciente = Paciente::buscar('pac_01H8X9A');
 *   $paciente->tipo_sangre = 'O+';
 *   $paciente->guardar();
 *   foreach ($paciente->tratamientosActivos() as $t) { ... }
 */
abstract class Modelo
{
    /** Tabla de la base de datos. */
    protected static string $tabla = '';

    /** Llave primaria: una columna o varias (llave compuesta). */
    protected static string|array $llave = 'id';

    /** Prefijo para generar ids nuevos (`pac_`, `cit_`...). Vacío = la llave se asigna a mano. */
    protected static string $prefijoId = '';

    /** columna => tipo: texto, entero, decimal, booleano, fecha, fechaHora, json */
    protected static array $columnas = [];

    /** nombre => [ClaseRelacionada, columnaLocal] para relaciones `perteneceA`. */
    protected static array $pertenece = [];

    private array $atributos = [];
    private array $originales = [];
    private bool $enBaseDeDatos = false;
    private array $relacionesCargadas = [];

    final public function __construct(array $atributos = [])
    {
        $this->llenar($atributos);
    }

    // ---------------------------------------------------------------- lectura

    public static function tabla(): string
    {
        return static::$tabla;
    }

    public static function columnas(): array
    {
        return static::$columnas;
    }

    public static function tieneColumna(string $columna): bool
    {
        return isset(static::$columnas[$columna]) || in_array($columna, (array) static::$llave, true);
    }

    public static function consulta(): Consulta
    {
        return new Consulta(static::class);
    }

    public static function donde(string $columna, mixed $valorUOperador, mixed $valor = null): Consulta
    {
        return func_num_args() === 2
            ? static::consulta()->donde($columna, $valorUOperador)
            : static::consulta()->donde($columna, $valorUOperador, $valor);
    }

    /** @return array<int, static> */
    public static function todos(): array
    {
        return static::consulta()->obtener();
    }

    /** Busca por llave primaria; acepta un arreglo columna => valor si la llave es compuesta. */
    public static function buscar(string|int|array $llave): ?static
    {
        $consulta = static::consulta();
        foreach (static::condicionLlave($llave) as $columna => $valor) {
            $consulta->donde($columna, $valor);
        }
        $modelo = $consulta->primero();
        return $modelo instanceof static ? $modelo : null;
    }

    /** Igual que `buscar()` pero responde 404 si no existe. */
    public static function buscarOFallar(string|int|array $llave, string $codigo, string $mensaje): static
    {
        return static::buscar($llave) ?? throw new HttpError(404, $codigo, $mensaje);
    }

    /** Crea una instancia a partir de una fila de la base de datos. */
    public static function hidratar(array $fila): static
    {
        $modelo = new static();
        foreach ($fila as $columna => $valor) {
            $modelo->atributos[$columna] = static::valorDesdeBd((string) $columna, $valor);
        }
        $modelo->originales = $modelo->atributos;
        $modelo->enBaseDeDatos = true;
        return $modelo;
    }

    /** Crea, guarda y devuelve un registro nuevo. */
    public static function crear(array $atributos): static
    {
        $modelo = new static($atributos);
        $modelo->guardar();
        return $modelo;
    }

    // ---------------------------------------------------------------- escritura

    /** Asigna sólo columnas declaradas: protege contra asignación masiva. */
    public function llenar(array $atributos): static
    {
        foreach ($atributos as $columna => $valor) {
            if (static::tieneColumna((string) $columna)) {
                $this->atributos[$columna] = $valor;
            }
        }
        return $this;
    }

    public function guardar(): static
    {
        return $this->enBaseDeDatos ? $this->actualizarFila() : $this->insertarFila();
    }

    public function eliminar(): void
    {
        if (!$this->enBaseDeDatos) {
            return;
        }
        $consulta = static::consulta();
        foreach ($this->valoresLlave() as $columna => $valor) {
            $consulta->donde($columna, $valor);
        }
        $consulta->eliminar();
        $this->enBaseDeDatos = false;
    }

    public function refrescar(): static
    {
        $fresco = static::buscar($this->valoresLlave());
        if ($fresco !== null) {
            $this->atributos = $fresco->atributos;
            $this->originales = $fresco->atributos;
            $this->relacionesCargadas = [];
        }
        return $this;
    }

    public function existeEnBd(): bool
    {
        return $this->enBaseDeDatos;
    }

    /** Columnas modificadas desde la última lectura o guardado. */
    public function cambios(): array
    {
        $cambios = [];
        foreach ($this->atributos as $columna => $valor) {
            if (!array_key_exists($columna, $this->originales) || $this->originales[$columna] !== $valor) {
                $cambios[$columna] = $valor;
            }
        }
        return $cambios;
    }

    private function insertarFila(): static
    {
        $llave = static::$llave;
        if (static::$prefijoId !== '' && is_string($llave) && ($this->atributos[$llave] ?? null) === null) {
            $this->atributos[$llave] = nuevoId(static::$prefijoId);
        }
        $columnas = array_keys($this->atributos);
        $valores = array_map(fn (string $c) => static::valorHaciaBd($c, $this->atributos[$c]), $columnas);
        ejecutar(
            'INSERT INTO ' . static::$tabla . ' (' . implode(', ', $columnas) . ') VALUES ('
                . implode(', ', array_fill(0, count($columnas), '?')) . ')',
            $valores
        );
        $this->originales = $this->atributos;
        $this->enBaseDeDatos = true;
        return $this;
    }

    private function actualizarFila(): static
    {
        $cambios = $this->cambios();
        if ($cambios === []) {
            return $this;
        }
        $asignaciones = [];
        $parametros = [];
        foreach ($cambios as $columna => $valor) {
            $asignaciones[] = "$columna = ?";
            $parametros[] = static::valorHaciaBd((string) $columna, $valor);
        }
        $condiciones = [];
        foreach ($this->valoresLlave() as $columna => $valor) {
            $condiciones[] = "$columna = ?";
            $parametros[] = static::valorHaciaBd((string) $columna, $valor);
        }
        ejecutar(
            'UPDATE ' . static::$tabla . ' SET ' . implode(', ', $asignaciones) . ' WHERE ' . implode(' AND ', $condiciones),
            $parametros
        );
        $this->originales = $this->atributos;
        return $this;
    }

    // ---------------------------------------------------------------- relaciones

    /** Relación uno a muchos: devuelve una consulta para seguir filtrando. */
    protected function tieneMuchos(string $clase, string $columnaForanea): Consulta
    {
        return $clase::donde($columnaForanea, $this->llaveSimple());
    }

    protected function tieneUno(string $clase, string $columnaForanea): ?Modelo
    {
        return $this->tieneMuchos($clase, $columnaForanea)->primero();
    }

    /** Relación inversa; usa lo precargado con `->con('relacion')` si está disponible. */
    protected function perteneceA(string $nombre): ?Modelo
    {
        if (array_key_exists($nombre, $this->relacionesCargadas)) {
            return $this->relacionesCargadas[$nombre];
        }
        [$clase, $columnaLocal] = static::$pertenece[$nombre] ?? throw new InvalidArgumentException("Relación desconocida: $nombre");
        $valor = $this->atributos[$columnaLocal] ?? null;
        $relacionado = $valor === null ? null : $clase::buscar($valor);
        $this->relacionesCargadas[$nombre] = $relacionado;
        return $relacionado;
    }

    /**
     * Carga una relación `perteneceA` para varios modelos con una sola consulta.
     * @param array<int, static> $modelos
     */
    public static function precargar(array $modelos, string $nombre): void
    {
        [$clase, $columnaLocal] = static::$pertenece[$nombre] ?? throw new InvalidArgumentException("Relación desconocida: $nombre");
        $ids = array_values(array_unique(array_filter(array_map(fn (Modelo $m) => $m->$columnaLocal, $modelos), fn ($v) => $v !== null)));
        $relacionados = [];
        foreach ($clase::consulta()->dondeEn($clase::llavePrimaria(), $ids)->obtener() as $modelo) {
            $relacionados[(string) $modelo->llaveSimple()] = $modelo;
        }
        foreach ($modelos as $modelo) {
            $modelo->relacionesCargadas[$nombre] = $relacionados[(string) $modelo->$columnaLocal] ?? null;
        }
    }

    public static function llavePrimaria(): string
    {
        return is_string(static::$llave) ? static::$llave : (string) static::$llave[0];
    }

    public function llaveSimple(): string|int|null
    {
        return $this->atributos[static::llavePrimaria()] ?? null;
    }

    /** @return array<string, mixed> */
    public function valoresLlave(): array
    {
        $valores = [];
        foreach ((array) static::$llave as $columna) {
            $valores[$columna] = $this->atributos[$columna] ?? null;
        }
        return $valores;
    }

    private static function condicionLlave(string|int|array $llave): array
    {
        if (is_array($llave)) {
            return $llave;
        }
        return [static::llavePrimaria() => $llave];
    }

    // ---------------------------------------------------------------- casteo

    public static function valorDesdeBd(string $columna, mixed $valor): mixed
    {
        if ($valor === null) {
            return null;
        }
        return match (static::$columnas[$columna] ?? 'texto') {
            'entero' => (int) $valor,
            'decimal' => (float) $valor,
            'booleano' => (bool) (int) $valor,
            'json' => json_decode((string) $valor, true) ?? [],
            default => (string) $valor,
        };
    }

    public static function valorHaciaBd(string $columna, mixed $valor): mixed
    {
        if ($valor === null) {
            return null;
        }
        return match (static::$columnas[$columna] ?? 'texto') {
            'entero' => (int) $valor,
            'decimal' => (float) $valor,
            'booleano' => $valor ? 1 : 0,
            'json' => json_encode($valor),
            default => (string) $valor,
        };
    }

    // ---------------------------------------------------------------- acceso

    public function __get(string $nombre): mixed
    {
        if (isset(static::$pertenece[$nombre])) {
            return $this->perteneceA($nombre);
        }
        return $this->atributos[$nombre] ?? null;
    }

    public function __set(string $nombre, mixed $valor): void
    {
        if (!static::tieneColumna($nombre)) {
            throw new InvalidArgumentException("La columna '$nombre' no existe en " . static::class);
        }
        $this->atributos[$nombre] = $valor;
    }

    public function __isset(string $nombre): bool
    {
        return isset($this->atributos[$nombre]);
    }

    /** Todos los atributos ya casteados (útil para depurar o serializar). */
    public function atributos(): array
    {
        return $this->atributos;
    }
}
