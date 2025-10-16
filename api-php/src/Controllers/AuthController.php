<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\MailerService;
use App\Services\VerificationService;
use App\Services\PasswordResetService;
use App\Support\Response;

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
}


