<?php
declare(strict_types=1);

namespace App\Services;

use App\Support\Env;
use PDO;

final class PasswordResetService
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Db::connect();
        $this->ensureSchema();
    }

    public function requestReset(string $email): array
    {
        $now = time();
        $cooldown = 60;
        $limitPerDay = (int)$this->getEnvInt('OTP_DAILY_LIMIT', 5);
        $expireMinutes = (int)$this->getEnvInt('OTP_EXPIRE_MIN', 15);

        $this->db->beginTransaction();
        try {
            $user = $this->findUserByEmail($email);
            if (!$user) {
                $this->db->rollBack();
                return ['error' => 'not found', 'status' => 404];
            }

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
                return ['error' => 'Daily reset limit reached', 'status' => 429];
            }

            $stmt = $this->db->prepare('UPDATE password_resets SET used_at = :now WHERE email = :email AND used_at IS NULL');
            $stmt->execute([':now' => $now, ':email' => $email]);

            $code = str_pad((string)random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $expiresAt = $now + ($expireMinutes * 60);
            $stmt = $this->db->prepare('INSERT INTO password_resets(email, code, created_at, expires_at, used_at) VALUES(:email, :code, :created, :expires, NULL)');
            $stmt->execute([
                ':email' => $email,
                ':code' => $code,
                ':created' => $now,
                ':expires' => $expiresAt,
            ]);

            $meta['last_sent_at'] = $now;
            $meta['sent_count'] = (int)($meta['sent_count'] ?? 0) + 1;
            $this->saveResendMeta($email, $meta);

            $this->db->commit();
            $dev = Env::get('DEV_RETURN_CODE', '1') === '1';
            return ['ok' => true, 'code' => $code, 'dev_return_code' => $dev];
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            return ['error' => 'reset request failed', 'status' => 500];
        }
    }

    public function applyReset(string $email, string $code, string $newPassword): array
    {
        $now = time();

        $this->db->beginTransaction();
        try {
            $stmt = $this->db->prepare('SELECT id, code, expires_at, used_at FROM password_resets WHERE email = :email AND code = :code ORDER BY id DESC LIMIT 1');
            $stmt->execute([':email' => $email, ':code' => $code]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if (!$row || (int)$row['expires_at'] < $now || $row['used_at'] !== null) {
                $this->db->rollBack();
                return ['error' => 'Invalid or expired code', 'status' => 400];
            }

            $stmt = $this->db->prepare('UPDATE password_resets SET used_at = :now WHERE id = :id');
            $stmt->execute([':now' => $now, ':id' => (int)$row['id']]);

            $hash = password_hash($newPassword, PASSWORD_DEFAULT);
            $stmt = $this->db->prepare('UPDATE users SET password = :password WHERE email = :email');
            $stmt->execute([':password' => $hash, ':email' => $email]);

            $this->db->commit();
            return ['ok' => true];
        } catch (\Throwable $e) {
            if ($this->db->inTransaction()) $this->db->rollBack();
            return ['error' => 'reset failed', 'status' => 500];
        }
    }

    private function ensureSchema(): void
    {
        $this->db->exec('CREATE TABLE IF NOT EXISTS password_resets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            code TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL,
            used_at INTEGER NULL
        )');

        $this->db->exec('CREATE TABLE IF NOT EXISTS reset_meta (
            email TEXT PRIMARY KEY,
            last_sent_at INTEGER NOT NULL,
            sent_count INTEGER NOT NULL,
            day_key TEXT NOT NULL
        )');
    }

    private function findUserByEmail(string $email): ?array
    {
        $stmt = $this->db->prepare('SELECT id, email FROM users WHERE email = :email LIMIT 1');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    private function getResendMeta(string $email): array
    {
        $stmt = $this->db->prepare('SELECT last_sent_at, sent_count, day_key FROM reset_meta WHERE email = :email');
        $stmt->execute([':email' => $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        return $row ?: [];
    }

    private function saveResendMeta(string $email, array $meta): void
    {
        $stmt = $this->db->prepare('REPLACE INTO reset_meta(email, last_sent_at, sent_count, day_key) VALUES(:email, :last_sent_at, :sent_count, :day_key)');
        $stmt->execute([
            ':email' => $email,
            ':last_sent_at' => (int)($meta['last_sent_at'] ?? 0),
            ':sent_count' => (int)($meta['sent_count'] ?? 0),
            ':day_key' => (string)($meta['day_key'] ?? date('Ymd')),
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
