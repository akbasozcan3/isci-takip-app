export function mapApiError(raw: string | undefined | null): string {
  const s = String(raw || '').toLowerCase();
  // Auth/Register
  if (s.includes('email already registered')) return 'Bu e‑posta adresi zaten kayıtlıdır.';
  if (s.includes('invalid email')) return 'Geçersiz e‑posta adresi.';
  if (s.includes('email not pre-verified')) return 'E‑posta doğrulaması yapılmadı. Lütfen önce e‑postanızı doğrulayın.';
  if (s.includes('password must be at least')) return 'Şifre en az 8 karakter olmalıdır.';
  if (s.includes('invalid username')) return 'Geçersiz kullanıcı adı. 3-24 karakter; a-z, 0-9, . _ - kullanın.';
  if (s.includes('username already taken')) return 'Bu kullanıcı adı zaten alınmış.';
  if (s.includes('incorrect email/username or password')) return 'Email/Kullanıcı adı veya şifre hatalı.';
  if (s.includes('account not verified')) return 'Hesabınız doğrulanmamış. Lütfen e‑postanızı doğrulayın.';
  if (s.includes('unauthorized')) return 'Yetkisiz işlem. Lütfen tekrar giriş yapın.';
  if (s.includes('not found')) return 'Kayıt bulunamadı.';
  if (s.includes('invalid or expired code')) return 'Kod hatalı veya süresi dolmuş.';
  if (s.includes('invalid email or code')) return 'Geçersiz e‑posta veya kod.';
  // Fallback
  return raw || 'İşlem başarısız. Lütfen tekrar deneyin.';
}
