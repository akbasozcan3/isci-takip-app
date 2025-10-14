<?php
declare(strict_types=1);

namespace App\Services;

use App\Support\Env;
use PDO;

final class Db
{
    public static function connect(): PDO
    {
        $driver = Env::get('DB_DRIVER', 'sqlite');
        if ($driver === 'mysql') {
            $host = Env::get('DB_HOST', '127.0.0.1');
            $port = Env::get('DB_PORT', '3306');
            $db = Env::get('DB_DATABASE', 'myapp');
            $user = Env::get('DB_USERNAME', 'root');
            $pass = Env::get('DB_PASSWORD', '');
            $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4', $host, $port, $db);
            $pdo = new PDO($dsn, $user, $pass, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
            return $pdo;
        }

        // default sqlite in project directory
        $path = Env::get('SQLITE_PATH', __DIR__ . '/../../storage/app.sqlite');
        $dir = dirname($path);
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $pdo = new PDO('sqlite:' . $path, null, null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        return $pdo;
    }
}


