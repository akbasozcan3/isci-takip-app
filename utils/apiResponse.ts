/**
 * Professional API Response Types
 * Type-safe API response handling
 */

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  errorId?: string;
  timestamp?: string;
  details?: unknown;
  field?: string;
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;

/**
 * Type guard to check if response is successful
 */
export function isSuccessResponse<T>(
  response: ApiResponse<T>
): response is ApiSuccessResponse<T> {
  return response.success === true;
}

/**
 * Type guard to check if response is error
 */
export function isErrorResponse(
  response: ApiResponse
): response is ApiErrorResponse {
  return response.success === false;
}

/**
 * Extract data from response or throw error
 */
export function extractData<T>(response: ApiResponse<T>): T {
  if (isSuccessResponse(response)) {
    return response.data;
  }
  throw new Error(response.error || 'API request failed');
}

/**
 * Safe data extraction with fallback
 */
export function extractDataSafe<T>(
  response: ApiResponse<T>,
  fallback: T
): T {
  if (isSuccessResponse(response)) {
    return response.data;
  }
  return fallback;
}

