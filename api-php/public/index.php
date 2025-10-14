<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Support\Env;
use App\Support\Response;
use App\Support\Router;

Env::load(__DIR__ . '/..');

$allowOrigin = Env::get('CORS_ALLOW_ORIGIN', '*');
header('Access-Control-Allow-Origin: ' . $allowOrigin);
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$router = new Router();

// Health
$router->get('/health', function () {
    return Response::json(['ok' => true, 'service' => 'email-verification', 'ts' => time()]);
});

// Auth endpoints
$router->post('/api/auth/resend-code', [App\Controllers\AuthController::class, 'resendCode']);
$router->post('/api/auth/verify-code', [App\Controllers\AuthController::class, 'verifyCode']);

// Dispatch
$router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $_SERVER['REQUEST_URI'] ?? '/');


