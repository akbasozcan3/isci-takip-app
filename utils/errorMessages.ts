/**
 * Centralized Error Messages
 * Turkish error messages for consistent user feedback
 */

export const ERROR_MESSAGES = {
    // Network Errors
    NETWORK_ERROR: 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.',
    TIMEOUT: 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.',
    SERVER_ERROR: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',

    // Authentication Errors
    AUTH_REQUIRED: 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.',
    INVALID_CREDENTIALS: 'E-posta veya şifre hatalı.',
    EMAIL_NOT_VERIFIED: 'E-posta doğrulanmamış. Lütfen e-postanızı doğrulayın.',
    ACCOUNT_LOCKED: 'Hesabınız kilitlendi. Destek ekibiyle iletişime geçin.',

    // Validation Errors
    REQUIRED_FIELDS: 'Lütfen tüm alanları doldurun.',
    INVALID_EMAIL: 'Geçerli bir e-posta adresi girin.',
    INVALID_PASSWORD: 'Şifre en az 6 karakter olmalıdır.',
    PASSWORDS_DONT_MATCH: 'Şifreler eşleşmiyor.',
    INVALID_PHONE: 'Geçerli bir telefon numarası girin.',

    // File Upload Errors
    FILE_TOO_LARGE: 'Dosya boyutu çok büyük. Maksimum 5MB.',
    INVALID_FILE_TYPE: 'Geçersiz dosya türü. Sadece resim dosyaları yüklenebilir.',
    UPLOAD_FAILED: 'Dosya yüklenemedi. Lütfen tekrar deneyin.',

    // Permission Errors
    PERMISSION_DENIED: 'Bu işlem için yetkiniz yok.',
    CAMERA_PERMISSION: 'Kamera izni gerekli.',
    LOCATION_PERMISSION: 'Konum izni gerekli.',
    STORAGE_PERMISSION: 'Depolama izni gerekli.',

    // Data Errors
    NOT_FOUND: 'İstenen kayıt bulunamadı.',
    ALREADY_EXISTS: 'Bu kayıt zaten mevcut.',
    DELETE_FAILED: 'Silme işlemi başarısız oldu.',
    UPDATE_FAILED: 'Güncelleme işlemi başarısız oldu.',

    // Generic Errors
    UNKNOWN_ERROR: 'Beklenmeyen bir hata oluştu.',
    TRY_AGAIN: 'Bir hata oluştu. Lütfen tekrar deneyin.',
} as const;

export const SUCCESS_MESSAGES = {
    // Authentication
    LOGIN_SUCCESS: 'Giriş başarılı!',
    LOGOUT_SUCCESS: 'Çıkış yapıldı.',
    REGISTER_SUCCESS: 'Kayıt başarılı!',
    PASSWORD_CHANGED: 'Şifreniz başarıyla değiştirildi.',

    // Profile
    PROFILE_UPDATED: 'Profil başarıyla güncellendi.',
    AVATAR_UPLOADED: 'Profil fotoğrafı yüklendi.',
    AVATAR_DELETED: 'Profil fotoğrafı silindi.',

    // Data Operations
    SAVED: 'Başarıyla kaydedildi.',
    DELETED: 'Başarıyla silindi.',
    UPDATED: 'Başarıyla güncellendi.',

    // Email
    EMAIL_SENT: 'E-posta gönderildi.',
    EMAIL_VERIFIED: 'E-posta doğrulandı.',

    // Generic
    SUCCESS: 'İşlem başarılı!',
} as const;

/**
 * Get user-friendly error message from error code
 */
export function getErrorMessage(errorCode: string): string {
    return ERROR_MESSAGES[errorCode as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Get success message from code
 */
export function getSuccessMessage(successCode: string): string {
    return SUCCESS_MESSAGES[successCode as keyof typeof SUCCESS_MESSAGES] || SUCCESS_MESSAGES.SUCCESS;
}

/**
 * Format API error response
 */
export function formatApiError(error: any): string {
    if (typeof error === 'string') {
        return error;
    }

    if (error?.message) {
        return error.message;
    }

    if (error?.error) {
        return error.error;
    }

    if (error?.code) {
        return getErrorMessage(error.code);
    }

    return ERROR_MESSAGES.UNKNOWN_ERROR;
}
