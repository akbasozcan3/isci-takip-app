<?php
declare(strict_types=1);

namespace App\Support;

final class Router
{
    private array $routes = [
        'GET' => [],
        'POST' => [],
    ];

    public function get(string $path, callable|array $handler): void
    {
        $this->routes['GET'][$this->normalize($path)] = $handler;
    }

    public function post(string $path, callable|array $handler): void
    {
        $this->routes['POST'][$this->normalize($path)] = $handler;
    }

    public function dispatch(string $method, string $uri): void
    {
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $method = strtoupper($method);
        $handler = $this->routes[$method][$this->normalize($path)] ?? null;
        if ($handler === null) {
            Response::json(['error' => 'Not Found'], 404);
            return;
        }
        if (is_array($handler)) {
            [$class, $func] = $handler;
            $instance = new $class();
            $instance->$func();
            return;
        }
        $handler();
    }

    private function normalize(string $path): string
    {
        return rtrim($path, '/') ?: '/';
    }
}


