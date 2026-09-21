<?php
declare(strict_types=1);

/**
 * Constructor de consultas del ORM. Se obtiene con `Modelo::consulta()` y
 * devuelve instancias del modelo, no arreglos.
 *
 *   Cita::donde('id_medico', $id)->donde('estado', 'pendiente')->ordenar('fecha_hora')->obtener();
 */
final class Consulta
{
    private const OPERADORES = ['=', '<>', '!=', '<', '<=', '>', '>=', 'LIKE'];

    /** @var array<int, array{sql: string, parametros: array}> */
    private array $condiciones = [];
    private array $orden = [];
    private ?int $limite = null;
    private ?int $desplazamiento = null;
    private array $relaciones = [];

    /** @param class-string<Modelo> $modelo */
    public function __construct(private readonly string $modelo)
    {
    }

    public function donde(string $columna, mixed $valorUOperador, mixed $valor = null): self
    {
        [$operador, $comparado] = func_num_args() === 2 ? ['=', $valorUOperador] : [$valorUOperador, $valor];
        $operador = strtoupper((string) $operador);
        if (!in_array($operador, self::OPERADORES, true)) {
            throw new InvalidArgumentException("Operador no permitido: $operador");
        }
        $this->condiciones[] = ['sql' => $this->columna($columna) . " $operador ?", 'parametros' => [$comparado]];
        return $this;
    }

    public function dondeNulo(string $columna): self
    {
        $this->condiciones[] = ['sql' => $this->columna($columna) . ' IS NULL', 'parametros' => []];
        return $this;
    }

    public function dondeNoNulo(string $columna): self
    {
        $this->condiciones[] = ['sql' => $this->columna($columna) . ' IS NOT NULL', 'parametros' => []];
        return $this;
    }

    public function dondeEn(string $columna, array $valores): self
    {
        if ($valores === []) {
            $this->condiciones[] = ['sql' => '1 = 0', 'parametros' => []];
            return $this;
        }
        $marcas = implode(', ', array_fill(0, count($valores), '?'));
        $this->condiciones[] = ['sql' => $this->columna($columna) . " IN ($marcas)", 'parametros' => array_values($valores)];
        return $this;
    }

    /** Escape hatch para condiciones que el constructor no cubre (subconsultas, OR...). */
    public function dondeCrudo(string $sql, array $parametros = []): self
    {
        $this->condiciones[] = ['sql' => "($sql)", 'parametros' => $parametros];
        return $this;
    }

    public function ordenar(string $columna, string $direccion = 'ASC'): self
    {
        $direccion = strtoupper($direccion) === 'DESC' ? 'DESC' : 'ASC';
        $this->orden[] = $this->columna($columna) . ' ' . $direccion;
        return $this;
    }

    public function limitar(int $limite, ?int $desplazamiento = null): self
    {
        $this->limite = max(0, $limite);
        $this->desplazamiento = $desplazamiento !== null ? max(0, $desplazamiento) : null;
        return $this;
    }

    /** Carga por adelantado relaciones `perteneceA` para evitar N+1 consultas. */
    public function con(string ...$relaciones): self
    {
        $this->relaciones = [...$this->relaciones, ...$relaciones];
        return $this;
    }

    /** @return array<int, Modelo> */
    public function obtener(): array
    {
        $sql = 'SELECT * FROM ' . $this->tabla() . $this->sqlCondiciones();
        if ($this->orden !== []) {
            $sql .= ' ORDER BY ' . implode(', ', $this->orden);
        }
        if ($this->limite !== null) {
            $sql .= ' LIMIT ' . $this->limite . ($this->desplazamiento !== null ? ' OFFSET ' . $this->desplazamiento : '');
        }
        $modelo = $this->modelo;
        $modelos = array_map(static fn (array $fila) => $modelo::hidratar($fila), consultar($sql, $this->parametros()));
        foreach ($this->relaciones as $relacion) {
            $modelo::precargar($modelos, $relacion);
        }
        return $modelos;
    }

    public function primero(): ?Modelo
    {
        return $this->limitar(1)->obtener()[0] ?? null;
    }

    public function contar(): int
    {
        return (int) valor('SELECT COUNT(*) FROM ' . $this->tabla() . $this->sqlCondiciones(), $this->parametros());
    }

    public function existe(): bool
    {
        return $this->contar() > 0;
    }

    /** Devuelve una columna suelta de todas las filas (por ejemplo, ids). */
    public function columnaDe(string $columna): array
    {
        $sql = 'SELECT ' . $this->columna($columna) . ' FROM ' . $this->tabla() . $this->sqlCondiciones();
        return array_column(consultar($sql, $this->parametros()), $columna);
    }

    public function actualizar(array $cambios): int
    {
        $modelo = $this->modelo;
        $asignaciones = [];
        $parametros = [];
        foreach ($cambios as $columna => $valor) {
            $asignaciones[] = $this->columna($columna) . ' = ?';
            $parametros[] = $modelo::valorHaciaBd($columna, $valor);
        }
        if ($asignaciones === []) {
            return 0;
        }
        return ejecutar(
            'UPDATE ' . $this->tabla() . ' SET ' . implode(', ', $asignaciones) . $this->sqlCondiciones(),
            [...$parametros, ...$this->parametros()]
        );
    }

    public function eliminar(): int
    {
        return ejecutar('DELETE FROM ' . $this->tabla() . $this->sqlCondiciones(), $this->parametros());
    }

    private function tabla(): string
    {
        $modelo = $this->modelo;
        return $modelo::tabla();
    }

    /** Valida el nombre de columna contra el modelo: nunca se concatena texto del usuario. */
    private function columna(string $columna): string
    {
        $modelo = $this->modelo;
        if (!$modelo::tieneColumna($columna)) {
            throw new InvalidArgumentException("La columna '$columna' no existe en " . $this->modelo);
        }
        return $columna;
    }

    private function sqlCondiciones(): string
    {
        return $this->condiciones === [] ? '' : ' WHERE ' . implode(' AND ', array_column($this->condiciones, 'sql'));
    }

    private function parametros(): array
    {
        return array_merge(...array_column($this->condiciones, 'parametros')) ?: [];
    }
}
