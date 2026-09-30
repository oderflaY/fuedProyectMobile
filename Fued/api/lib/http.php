<?php
declare(strict_types=1);

final class HttpError extends RuntimeException
{
    public function __construct(
        public readonly int $estado,
        public readonly string $codigo,
        string $mensaje = '',
        public readonly array $detalles = [],
    ) {
        parent::__construct($mensaje !== '' ? $mensaje : $codigo);
    }
}

function responder(mixed $datos, int $estado = 200): never
{
    http_response_code($estado);
    if ($estado !== 204) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($datos, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRESERVE_ZERO_FRACTION);
    }
    exit;
}

function responderError(HttpError $e): never
{
    $error = ['codigo' => $e->codigo, 'mensaje' => $e->getMessage()];
    if ($e->detalles !== []) {
        $error['detalles'] = $e->detalles;
    }
    responder(['error' => $error], $e->estado);
}

function cuerpoJson(): array
{
    static $cuerpo = null;
    if ($cuerpo !== null) {
        return $cuerpo;
    }
    $crudo = file_get_contents('php://input') ?: '';
    if (trim($crudo) === '') {
        return $cuerpo = [];
    }
    $datos = json_decode($crudo, true);
    if (!is_array($datos)) {
        throw new HttpError(400, 'json_invalido', 'El cuerpo de la petición no es JSON válido.');
    }
    return $cuerpo = $datos;
}

function parametro(string $nombre, ?string $defecto = null): ?string
{
    $valor = $_GET[$nombre] ?? null;
    return is_string($valor) && trim($valor) !== '' ? trim($valor) : $defecto;
}

function aplicarCors(array $origenes, string $patron = ''): void
{
    $origen = $_SERVER['HTTP_ORIGIN'] ?? '';
    $permitido = in_array('*', $origenes, true)
        || in_array($origen, $origenes, true)
        || ($patron !== '' && preg_match($patron, $origen) === 1);
    if ($origen !== '' && $permitido) {
        header('Access-Control-Allow-Origin: ' . $origen);
        header('Vary: Origin');
        header('Access-Control-Allow-Headers: Authorization, Content-Type');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Max-Age: 86400');
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function rutaSolicitada(): string
{
    $ruta = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/';
    $base = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/');
    if ($base !== '' && str_starts_with($ruta, $base)) {
        $ruta = substr($ruta, strlen($base));
    }
    $ruta = (string) preg_replace('#^/index\.php#', '', $ruta);
    return '/' . trim($ruta, '/');
}

final class Router
{
    /** @var array<int, array{0: string, 1: string, 2: callable}> */
    private array $rutas = [];

    public function get(string $patron, callable $accion): void { $this->agregar('GET', $patron, $accion); }
    public function post(string $patron, callable $accion): void { $this->agregar('POST', $patron, $accion); }
    public function put(string $patron, callable $accion): void { $this->agregar('PUT', $patron, $accion); }
    public function delete(string $patron, callable $accion): void { $this->agregar('DELETE', $patron, $accion); }

    private function agregar(string $metodo, string $patron, callable $accion): void
    {
        $regex = '#^' . preg_replace('#\{(\w+)\}#', '(?P<$1>[^/]+)', $patron) . '$#';
        $this->rutas[] = [$metodo, $regex, $accion];
    }

    public function despachar(string $metodo, string $ruta): void
    {
        $existeRuta = false;
        foreach ($this->rutas as [$metodoRuta, $regex, $accion]) {
            if (!preg_match($regex, $ruta, $coincidencias)) {
                continue;
            }
            if ($metodoRuta !== $metodo) {
                $existeRuta = true;
                continue;
            }
            $parametros = array_map('urldecode', array_filter($coincidencias, 'is_string', ARRAY_FILTER_USE_KEY));
            $accion($parametros);
            return;
        }
        throw $existeRuta
            ? new HttpError(405, 'metodo_no_permitido', 'Método no permitido para esta ruta.')
            : new HttpError(404, 'ruta_no_encontrada', 'La ruta solicitada no existe.');
    }
}
