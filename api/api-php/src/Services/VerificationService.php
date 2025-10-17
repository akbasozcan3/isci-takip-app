<?php
declare(strict_types=1);

namespace App\Services;

use App\Support\Env;
use App\Support\Response;
use PDO;

final class VerificationService
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Db::connect();
        $this->ensureSchema();
    }

    public function resendCode(string $email): array
    {
        $now = time();
        $cooldown = 60; // seconds
        $limitPerDay = (int)($this->getEnvInt('OTP_DAILY_LIMIT', 5));
        $expireMinutes = (int)($this->getEnvInt('OTP_EXPIRE_MIN', 15));

        $this->db->beginTransaction();
        try {
            // ensure user exists
            $user = $this->findUserByEmail($email);
            if (!$user) {
                $this->db->rollBack();
                return ['error' => 'not found', 'status' => 404];
            }
            if ((string)($user['is_verified'] ?? '0') === '1') {
                $this->db->rollBack();
                return ['ok' => true, 'code' => ''];
            }

            // cooldown & daily limit
            $meta = $this->getResendMeta($email);
            $dayKey = date('Ymd', $now);
            if (($meta['day_key'] ?? '') !== $dayKey) {
                $meta['day_key'] = $dayKey;
                $meta['sent_count'] = 0;
            }
            if (($meta['last_sent_at'] ?? 0) > 0 && ($now - (int)$meta['last_sent_at']) < $cooldown) {
                $this->db->rollBack();
                return ['error' => 'Please wait before requesting another code', 'status' => 429];
            }
            if ((int)($meta['sent_count'] ?? 0) >= $limitPerDay) {
                $this->db->rollBack();
                return ['error' => 'Daily resend limit reached', 'status' => 429];
            }

            // invalidate previous active codes
            $stmt = $this->db->prepare('UPDATE verification_codes SET used_at = :now WHERE email = :email AND used_at IS NULL');
            $stmt->execute([':now' => $now, ':email' => $email]);

            // create new code
            $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $expiresAt = $now + ($expireMinutes * 60);
            $stmt = $this->db->prepare('INSERT INTO verification_codes(email, code, created_at, expires_at, used_at) VALUES(:email, :code, :created, :expires, NULL)');
            $stmt->execute([
                ':email' => $email,
                ':code' => $code,
                ':created' => $now,
                ':expires' => $expiresAt,
            ]);

            // update meta
            $meta['last_sent_at'] = $now;
            $meta['sent_count'] = (int)($meta['sent_count'] ?? 0) + 1;
            $this->saveResendMeta($email, $meta);

            $this->db->commit();
            $dev = Env::get('DEV_RETURN_CODE', '1') === '1';
            return ['ok' => true, 'code' => $code, 'dev_return_code' => $dev];
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            return ['error' => 'resend failed', 'status' => 500];
        }
    }

    public function verifyCode(string $email, string $code): array
    {
        $now = time();
        $maxAttempts = (int)($this->getEnvInt('OTP_MAX_ATTEMPTS', 5));
        $lockMinutes = 15;

        $this->db->beginTransaction();
        try {
            $va = $this->getAttempts($email);
            if (($va['locked_until'] ?? 0) > $now) {
                $this->db->rollBack();
                return ['error' => 'Too many attempts. Try later.', 'status' => 429];
            }

            $stmt = $this->db->prepare('SELECT id, code, expires_at, used_at FROM verification_codes WHERE email = :email AND code = :code ORDER BY id DESC LIMIT 1');
            $stmt->execute([':email' => $email, ':code' => $code]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row || (int)$row['expires_at'] < $now || $row['used_at'] !== null) {
                $va['count'] = (int)($va['count'] ?? 0) + 1;
                if ($va['count'] >= $maxAttempts) {
                    $va['locked_until'] = $now + ($lockMinutes * 60);
                    $va['count'] = 0;
                }
                $this->saveAttempts($email, $va);
                $this->db->commit();
                return ['error' => 'Invalid or expired code', 'status' => 400];
            }

            // mark used
            $stmt = $this->db->prepare('UPDATE verification_codes SET used_at = :now WHERE id = :id');
            $stmt->execute([':now' => $now, ':id' => (int)$row['id']]);

            // set user verified
            $stmt = $this->db->prepare('UPDATE users SET is_verified = 1 WHERE email = :email');
            $stmt->execute([':email' => $email]);

            // reset attempts
            $this->saveAttempts($email, ['count' => 0, 'locked_until' => 0]);
            $this->db->commit();
            return ['ok' => true];
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            return ['error' => 'verify failed', 'status' => 500];
        }
    }

    private function ensureSchema(): void
    {
        // users table (minimal)
        $this->db->exec('CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT,
            is_verified INTEGER DEFAULT 0
        )');

        // verification codes
        $this->db->exec('CREATE TABLE IF NOT EXISTS verification_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            used_at INTEGER NULL
        )');

        // resend meta
        $this->db->exec('CREATE TABLE IF NOT EXISTS resend_meta (
            email TEXT PRIMARY KEY,
            last_sent_at INTEGER NOT NULL,
            sent_count INTEGER NOT NULL,
            day_key TEXT NOT NULL
        )');

        // attempts meta
        $this->db->exec('CREATE TABLE IF NOT EXISTS verify_attempts (
            email TEXT PRIMARY KEY,
            count INTEGER NOT NULL,
            locked_until INTEGER NOT NULL
        )');
    }

    private function findUserByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT id, email, is_verified FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function getResendMeta(string $email): array
    {
        $stmt = $this->db->prepare('SELECT last_sent_at, sent_count, day_key FROM resend_meta WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        return $row ?: [];
    }

    private function saveResendMeta(string $email, array $meta): void
    {
        $stmt = $this->db->prepare('REPLACE INTO resend_meta(email, last_sent_at, sent_count, day_key) VALUES(:email, :last_sent_at, :sent_count, :day_key)');
        $stmt->execute([
            ':email' => $email,
            ':last_sent_at' => (int)($meta['last_sent_at'] ?? 0),
            ':sent_count' => (int)($meta['sent_count'] ?? 0),
            ':day_key' => (string)($meta['day_key'] ?? date('Ymd')),
        ]);
    }

    private function getAttempts(string $email): array
    {
        $stmt = $this->db->prepare('SELECT count, locked_until FROM verify_attempts WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        return $row ?: ['count' => 0, 'locked_until' => 0];
    }

    private function saveAttempts(string $email, array $va): void
    {
        $stmt = $this->db->prepare('REPLACE INTO verify_attempts(email, count, locked_until) VALUES(:email, :count, :locked_until)');
        $stmt->execute([
            ':email' => $email,
            ':count' => (int)($va['count'] ?? 0),
            ':locked_until' => (int)($va['locked_until'] ?? 0),
        ]);
    }

    private function getEnvInt(string $key, int $default): int
    {
        $v = Env::get($key);
        if ($v === null) return $default;
        $i = (int)filter_var($v, FILTER_VALIDATE_INT);
        return $i > 0 ? $i : $default;
    }
}


