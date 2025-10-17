<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\MailerService;
use App\Services\VerificationService;
use App\Services\PasswordResetService;
use App\Support\Response;
use App\Support\Env;

final class AuthController
{
    public function resendCode(): void
    {
        $input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
        $email = trim((string)($input['email'] ?? ''));
        if ($email === '') {
            Response::json(['error' => 'email required'], 400);
            return;
        }

        $service = new VerificationService();
        $result = $service->resendCode($email);
        if ($result['error'] ?? false) {
            Response::json(['error' => $result['error']], (int)($result['status'] ?? 400));
            return;
        }

        $code = (string)$result['code'];
        $mailer = new MailerService();
        $sent = $mailer->sendVerificationCode($email, $code);
        $body = ['ok' => true];
        if (!$sent && (($result['dev_return_code'] ?? false) === true)) {
            $body['dev_code'] = $code;
        }
        Response::json($body);
    }

    public function verifyCode(): void
    {
        $input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
        $email = trim((string)($input['email'] ?? ''));
        $code = trim((string)($input['code'] ?? ''));
        if ($email === '' || $code === '') {
            Response::json(['error' => 'email/code required'], 400);
            return;
        }

        $service = new VerificationService();
        $result = $service->verifyCode($email, $code);
        if ($result['error'] ?? false) {
            Response::json(['error' => $result['error']], (int)($result['status'] ?? 400));
            return;
        }
        Response::json(['ok' => true]);
    }

    public function forgotPassword(): void
    {
        $input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
        $email = trim((string)($input['email'] ?? ''));
        if ($email === '') {
            Response::json(['error' => 'email required'], 400);
            return;
        }

        $service = new PasswordResetService();
        $result = $service->requestReset($email);
        if ($result['error'] ?? false) {
            Response::json(['error' => $result['error']], (int)($result['status'] ?? 400));
            return;
        }

        $code = (string)$result['code'];
        $mailer = new MailerService();
        $sent = $mailer->sendPasswordResetCode($email, $code);
        $body = ['ok' => true];
        if (!$sent && (($result['dev_return_code'] ?? false) === true)) {
            $body['dev_code'] = $code;
        }
        Response::json($body);
    }

    public function resetPassword(): void
    {
        $input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
        $email = trim((string)($input['email'] ?? ''));
        $code = trim((string)($input['code'] ?? ''));
        $password = (string)($input['password'] ?? '');
        if ($email === '' || $code === '' || $password === '') {
            Response::json(['error' => 'email/code/password required'], 400);
            return;
        }

        $service = new PasswordResetService();
        $result = $service->applyReset($email, $code, $password);
        if ($result['error'] ?? false) {
            Response::json(['error' => $result['error']], (int)($result['status'] ?? 400));
            return;
        }
        Response::json(['ok' => true]);
    }

    // Register on Node API after PHP verification
    public function register(): void
    {
        $input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
        $email = trim((string)($input['email'] ?? ''));
        $password = (string)($input['password'] ?? '');
        $name = (string)($input['name'] ?? '');
        $phone = (string)($input['phone'] ?? '');
        $username = (string)($input['username'] ?? '');
        if ($email === '' || $password === '') {
            Response::json(['error' => 'email/password required'], 400);
            return;
        }
        // Optional: trust PHP verification; forward to Node without pre_token
        $nodeBase = rtrim((string)Env::get('NODE_API_BASE', 'https://isci-takip-app.onrender.com'), '/');
        $payload = json_encode([
            'email' => $email,
            'password' => $password,
            'name' => $name ?: null,
            'phone' => $phone ?: null,
            'username' => $username ?: null,
            'pre_token' => null,
        ]);
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $payload,
                'timeout' => 20,
            ]
        ]);
        $res = @file_get_contents($nodeBase . '/auth/register', false, $ctx);
        $ok = $res !== false;
        if (!$ok) {
            Response::json(['error' => 'register failed'], 500);
            return;
        }
        $data = json_decode($res, true) ?: [];
        Response::json($data ?: ['ok' => true]);
    }

    public function login(): void
    {
        $input = json_decode(file_get_contents('php://input') ?: '[]', true) ?: [];
        $username = (string)($input['username'] ?? $input['email'] ?? '');
        $password = (string)($input['password'] ?? '');
        if ($username === '' || $password === '') {
            Response::json(['error' => 'username/password required'], 400);
            return;
        }
        $nodeBase = rtrim((string)Env::get('NODE_API_BASE', 'https://isci-takip-app.onrender.com'), '/');
        $payload = http_build_query(['username' => $username, 'password' => $password]);
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
                'content' => $payload,
                'timeout' => 20,
            ]
        ]);
        $res = @file_get_contents($nodeBase . '/auth/login', false, $ctx);
        if ($res === false) {
            Response::json(['error' => 'login failed'], 500);
            return;
        }
        $data = json_decode($res, true) ?: [];
        Response::json($data ?: ['error' => 'login failed'], empty($data) ? 500 : 200);
    }
}


