<?php
declare(strict_types=1);

namespace App\Support;

use Dotenv\Dotenv;

final class Env
{
    public static function load(string $basePath): void
    {
        if (is_file($basePath . '/.env')) {
            $dotenv = Dotenv::createImmutable($basePath);
            $dotenv->safeLoad();
        }
    }

    public static function get(string $key, ?string $default = null): ?string
    {
        $v = $_ENV[$key] ?? $_SERVER[$key] ?? getenv($key);
        return $v === false || $v === null ? $default : (string)$v;
    }
}


