<?php
declare(strict_types=1);

use GraphQL\Error\DebugFlag;
use GraphQL\GraphQL;
use GraphQL\Validator\DocumentValidator;
use GraphQL\Validator\Rules\QueryComplexity;
use GraphQL\Validator\Rules\QueryDepth;

/**
 * GraphQL de estadísticas. POST /graphql con {query, variables}; pide sesión (cualquier rol).
 * GET /graphql abre GraphiQL para explorar el esquema desde el navegador (el token se pone en Headers).
 */
return function (Router $r): void {
    $r->post('/graphql', function (): void {
        sesion();
        require_once __DIR__ . '/../lib/graphql.php';

        $d = cuerpoJson();
        $consulta = $d['query'] ?? null;
        if (!is_string($consulta) || trim($consulta) === '') {
            throw new HttpError(400, 'consulta_requerida', 'Falta la consulta GraphQL en "query".');
        }
        DocumentValidator::addRule(new QueryDepth(6));
        DocumentValidator::addRule(new QueryComplexity(300));

        $resultado = GraphQL::executeQuery(
            esquemaGraphql(),
            $consulta,
            null,
            null,
            is_array($d['variables'] ?? null) ? $d['variables'] : null,
            is_string($d['operationName'] ?? null) ? $d['operationName'] : null,
        );
        responder($resultado->toArray(DebugFlag::NONE));
    });

    $r->get('/graphql', function (): void {
        header('Content-Type: text/html; charset=utf-8');
        echo <<<'HTML'
            <!doctype html>
            <html lang="es">
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1">
              <title>Fued GraphQL</title>
              <link rel="stylesheet" href="https://unpkg.com/graphiql@3.8.3/graphiql.min.css">
              <style>body { margin: 0; height: 100vh; } #graphiql { height: 100vh; }</style>
            </head>
            <body>
              <div id="graphiql">Cargando GraphiQL…</div>
              <script src="https://unpkg.com/react@18.3.1/umd/react.production.min.js"></script>
              <script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
              <script src="https://unpkg.com/graphiql@3.8.3/graphiql.min.js"></script>
              <script>
                const fetcher = GraphiQL.createFetcher({ url: location.pathname });
                ReactDOM.createRoot(document.getElementById('graphiql')).render(
                  React.createElement(GraphiQL, {
                    fetcher,
                    defaultHeaders: '{\n  "Authorization": "Bearer PEGA_AQUI_TU_TOKEN"\n}',
                    defaultQuery: '{\n  resumen { pacientes medicos citas tomas alertas }\n  adherenciaPorMes(meses: 6) { mes porcentaje }\n}\n',
                  }),
                );
              </script>
            </body>
            </html>
            HTML;
        exit;
    });
};
