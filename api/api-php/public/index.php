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
$router->post('/api/auth/register', [App\Controllers\AuthController::class, 'register']);
$router->post('/api/auth/login', [App\Controllers\AuthController::class, 'login']);
// Password reset endpoints
$router->post('/api/auth/forgot-password', [App\Controllers\AuthController::class, 'forgotPassword']);
$router->post('/api/auth/reset-password', [App\Controllers\AuthController::class, 'resetPassword']);

// Optional SMTP debug (guarded): enable only when DEBUG_SMTP=1 or provide token
$router->get('/debug/smtp-verify', function () {
    $token = $_GET['token'] ?? '';
    $allow = (App\Support\Env::get('DEBUG_SMTP', '0') === '1') || ($token !== '' && $token === App\Support\Env::get('DEBUG_SMTP_TOKEN', ''));
    if (!$allow) {
        return App\Support\Response::json(['error' => 'not found'], 404);
    }
    try {
        $m = new PHPMailer\PHPMailer\PHPMailer(true);
        $svc = new App\Services\MailerService();
        // Use reflection to access configure quickly
        $ref = new ReflectionClass(App\Services\MailerService::class);
        $method = $ref->getMethod('configure');
        $method->setAccessible(true);
        $method->invoke($svc, $m);
        if (!$m->smtpConnect()) throw new Exception('connect failed');
        $m->smtpClose();
        return App\Support\Response::json(['ok' => true]);
    } catch (Throwable $e) {
        return App\Support\Response::json(['ok' => false, 'error' => $e->getMessage()], 500);
    }
});

// Dispatch
$router->dispatch($_SERVER['REQUEST_METHOD'] ?? 'GET', $_SERVER['REQUEST_URI'] ?? '/');


