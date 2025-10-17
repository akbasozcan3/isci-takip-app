<?php
declare(strict_types=1);

namespace App\Services;

use App\Support\Env;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;

final class MailerService
{
    private function configure(PHPMailer $mailer): void
    {
        $mailer->isSMTP();
        $mailer->Host = Env::get('SMTP_HOST', 'smtp.gmail.com');
        $mailer->SMTPAuth = true;
        $mailer->Username = Env::get('SMTP_USER', '');
        $mailer->Password = Env::get('SMTP_PASS', '');
        $mailer->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mailer->Port = (int)(Env::get('SMTP_PORT', '587'));
        $mailer->CharSet = 'UTF-8';

        // Optional debug
        if (Env::get('DEBUG_SMTP', '0') === '1') {
            $mailer->SMTPDebug = SMTP::DEBUG_SERVER;
        }

        // Gmail requires from = authenticated user or an alias; fallback safely
        $from = Env::get('SMTP_FROM', Env::get('SMTP_USER', 'no-reply@example.com'));
        $fromName = Env::get('SMTP_FROM_NAME', 'My App');
        $mailer->setFrom($from ?: 'no-reply@example.com', $fromName ?: 'My App');
    }

    public function sendVerificationCode(string $toEmail, string $code): bool
    {
        $mailer = new PHPMailer(true);
        try {
            $this->configure($mailer);
            $mailer->addAddress($toEmail);
            $mailer->isHTML(true);
            $mailer->Subject = 'E-posta Doğrulama Kodunuz';
            $mailer->Body = sprintf('<p>Doğrulama kodunuz: <strong style="font-size:18px;letter-spacing:2px">%s</strong></p><p>15 dakika içinde kullanın.</p>', htmlspecialchars($code));
            $mailer->AltBody = 'Dogurlama kodunuz: ' . $code . ' (15 dk)';
            return $mailer->send();
        } catch (\Throwable $e) {
            // Avoid throwing; log if needed
            if (Env::get('DEBUG_SMTP', '0') === '1') {
                error_log('[PHPMailer] sendVerificationCode error: ' . $e->getMessage());
            }
            return false;
        }
    }

    public function sendPasswordResetCode(string $toEmail, string $code): bool
    {
        $mailer = new PHPMailer(true);
        try {
            $this->configure($mailer);
            $mailer->addAddress($toEmail);
            $mailer->isHTML(true);
            $mailer->Subject = 'Şifre Sıfırlama Kodunuz';
            $mailer->Body = sprintf('<p>Şifre sıfırlama kodunuz: <strong style="font-size:18px;letter-spacing:2px">%s</strong></p><p>15 dakika içinde kullanın.</p>', htmlspecialchars($code));
            $mailer->AltBody = 'Sifre sifirlama kodunuz: ' . $code . ' (15 dk)';
            return $mailer->send();
        } catch (\Throwable $e) {
            if (Env::get('DEBUG_SMTP', '0') === '1') {
                error_log('[PHPMailer] sendPasswordResetCode error: ' . $e->getMessage());
            }
            return false;
        }
    }
}
