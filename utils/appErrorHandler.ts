/**
 * Centralized Error Handling Utility
 * Provides consistent error handling across the application
 */

/**
 * Custom application error class
 */
export class AppError extends Error {
    constructor(
        message: string,
        public code: string,
        public userMessage: string,
        public statusCode: number = 500
    ) {
        super(message);
        this.name = 'AppError';
    }
}

/**
 * Error codes
 */
export const ErrorCodes = {
    // Network errors
    NETWORK_ERROR: 'NETWORK_ERROR',
    TIMEOUT_ERROR: 'TIMEOUT_ERROR',
    CONNECTION_ERROR: 'CONNECTION_ERROR',

    // Auth errors
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',

    // Validation errors
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    INVALID_INPUT: 'INVALID_INPUT',

    // Resource errors
    NOT_FOUND: 'NOT_FOUND',
    ALREADY_EXISTS: 'ALREADY_EXISTS',

    // Server errors
    SERVER_ERROR: 'SERVER_ERROR',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',

    // Unknown
    UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};

/**
 * Get user-friendly error message
 */
export const getUserFriendlyMessage = (error: unknown): string => {
    if (error instanceof AppError) {
        return error.userMessage;
    }

    if (error instanceof Error) {
        // Network errors
        if (error.message.includes('Network request failed')) {
            return 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.';
        }

        if (error.message.includes('timeout')) {
            return 'İstek zaman aşımına uğradı. Lütfen tekrar deneyin.';
        }

        // Auth errors
        if (error.message.includes('Unauthorized') || error.message.includes('401')) {
            return 'Oturum süreniz doldu. Lütfen tekrar giriş yapın.';
        }

        if (error.message.includes('Forbidden') || error.message.includes('403')) {
            return 'Bu işlem için yetkiniz yok.';
        }

        // Validation errors
        if (error.message.includes('validation') || error.message.includes('invalid')) {
            return 'Girdiğiniz bilgiler geçersiz. Lütfen kontrol edin.';
        }

        // Resource errors
        if (error.message.includes('not found') || error.message.includes('404')) {
            return 'Aradığınız kayıt bulunamadı.';
        }

        // Server errors
        if (error.message.includes('500') || error.message.includes('server error')) {
            return 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.';
        }

        // Return original message if no match
        return error.message;
    }

    return 'Bir hata oluştu. Lütfen tekrar deneyin.';
};

/**
 * Log error to console (development) or monitoring service (production)
 */
export const logError = (error: unknown, context: string): void => {
    const timestamp = new Date().toISOString();

    if (__DEV__) {
        console.error(`[${context}] ${timestamp}`, error);
    } else {
        // In production, send to error monitoring service (e.g., Sentry)
        console.error(`[${context}] ${timestamp}`, error);
    }
};

/**
 * Handle API error with consistent logging and user feedback
 */
export interface ErrorResult {
    success: false;
    error: string;
    code?: string;
}

export interface SuccessResult<T> {
    success: true;
    data: T;
}

export type Result<T> = SuccessResult<T> | ErrorResult;

export const handleApiError = async <T>(
    apiCall: () => Promise<T>,
    context: string
): Promise<Result<T>> => {
    try {
        const data = await apiCall();
        return { success: true, data };
    } catch (error) {
        logError(error, context);
        const userMessage = getUserFriendlyMessage(error);

        return {
            success: false,
            error: userMessage,
            code: error instanceof AppError ? error.code : ErrorCodes.UNKNOWN_ERROR
        };
    }
};

/**
 * Create specific error types
 */
export const createNetworkError = (message: string = 'Bağlantı hatası'): AppError => {
    return new AppError(
        'Network error',
        ErrorCodes.NETWORK_ERROR,
        message,
        0
    );
};

export const createAuthError = (message: string = 'Oturum süreniz doldu'): AppError => {
    return new AppError(
        'Authentication error',
        ErrorCodes.UNAUTHORIZED,
        message,
        401
    );
};

export const createValidationError = (message: string = 'Geçersiz bilgi'): AppError => {
    return new AppError(
        'Validation error',
        ErrorCodes.VALIDATION_ERROR,
        message,
        400
    );
};

export const createServerError = (message: string = 'Sunucu hatası'): AppError => {
    return new AppError(
        'Server error',
        ErrorCodes.SERVER_ERROR,
        message,
        500
    );
};

/**
 * Check if error is a specific type
 */
export const isNetworkError = (error: unknown): boolean => {
    if (error instanceof AppError) {
        return error.code === ErrorCodes.NETWORK_ERROR;
    }
    if (error instanceof Error) {
        return error.message.includes('Network') || error.message.includes('network');
    }
    return false;
};

export const isAuthError = (error: unknown): boolean => {
    if (error instanceof AppError) {
        return error.code === ErrorCodes.UNAUTHORIZED || error.code === ErrorCodes.TOKEN_EXPIRED;
    }
    if (error instanceof Error) {
        return error.message.includes('401') || error.message.includes('Unauthorized');
    }
    return false;
};
