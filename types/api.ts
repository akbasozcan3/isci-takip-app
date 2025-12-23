/**
 * API Type Definitions
 * Centralized types for API requests and responses
 */

// ============================================================================
// Common Types
// ============================================================================

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    success: boolean;
    data: T[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// ============================================================================
// User Types
// ============================================================================

export interface User {
    id: string;
    email: string;
    displayName: string;
    name?: string;
    phone?: string;
    avatarUrl?: string | null;
    createdAt: string;
    updatedAt?: string;
    emailVerified?: boolean;
    loginMethod?: 'email' | 'google';
}

export interface UserStats {
    totalLocations: number;
    totalSteps: number;
    activeDays: number;
    lastActive: string | null;
}

export interface Subscription {
    planId: string;
    planName: string;
    renewsAt?: string | null;
    features?: string[];
}

// ============================================================================
// Auth Types
// ============================================================================

export interface LoginRequest {
    email: string;
    password: string;
}

export interface LoginResponse {
    success: boolean;
    token?: string;
    user?: User;
    error?: string;
}

export interface RegisterRequest {
    email: string;
    password: string;
    displayName: string;
    phone?: string;
}

export interface RegisterResponse {
    success: boolean;
    user?: User;
    error?: string;
    requiresVerification?: boolean;
}

export interface PasswordResetRequest {
    email: string;
}

export interface PasswordResetVerify {
    email: string;
    code: string;
    newPassword: string;
}

export interface ChangePasswordRequest {
    currentPassword: string;
    newPassword: string;
}

// ============================================================================
// Profile Types
// ============================================================================

export interface UpdateProfileRequest {
    displayName?: string;
    phone?: string;
    currentPassword?: string;
    newPassword?: string;
    verificationCode?: string;
}

export interface ProfileResponse {
    success: boolean;
    user?: User;
    error?: string;
}

// ============================================================================
// Location Types
// ============================================================================

export interface Coordinates {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    heading?: number | null;
    speed?: number | null;
    altitude?: number | null;
}

export interface LocationUpdate {
    coords: Coordinates;
    timestamp: number;
    deviceId?: string;
    workerId?: string;
}

export interface LocationHistory {
    id: string;
    userId: string;
    coords: Coordinates;
    timestamp: number;
    createdAt: string;
}

// ============================================================================
// Steps Types
// ============================================================================

export interface StepsUpdate {
    steps: number;
    distance?: number;
    calories?: number;
    timestamp?: number;
}

export interface StepsHistory {
    id: string;
    userId: string;
    steps: number;
    distance?: number;
    calories?: number;
    date: string;
    timestamp: number;
}

// ============================================================================
// Group Types
// ============================================================================

export interface Group {
    id: string;
    name: string;
    description?: string;
    ownerId: string;
    members: string[];
    createdAt: string;
    updatedAt?: string;
}

export interface CreateGroupRequest {
    name: string;
    description?: string;
    members?: string[];
}

export interface UpdateGroupRequest {
    name?: string;
    description?: string;
}

export interface GroupMember {
    id: string;
    displayName: string;
    avatarUrl?: string | null;
    lastSeen?: string;
    isOnline?: boolean;
}

// ============================================================================
// Notification Types
// ============================================================================

export interface Notification {
    id: string;
    userId: string;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success' | 'message';
    read: boolean;
    data?: Record<string, any>;
    createdAt: string;
}

export interface SendNotificationRequest {
    userId: string;
    title: string;
    message: string;
    type?: string;
    data?: Record<string, any>;
}

// ============================================================================
// Message Types
// ============================================================================

export interface Message {
    id: string;
    senderId: string;
    recipientId?: string | null;
    groupId?: string | null;
    message: string;
    type: 'text' | 'image' | 'location';
    status: 'sent' | 'delivered' | 'read';
    read: boolean;
    createdAt: number;
    readAt?: number;
}

export interface SendMessageRequest {
    recipientId?: string;
    groupId?: string;
    message: string;
    type?: 'text' | 'image' | 'location';
    metadata?: Record<string, any>;
}

// ============================================================================
// Error Types
// ============================================================================

export interface ApiError {
    success: false;
    error: string;
    code?: string;
    details?: Array<{
        field: string;
        message: string;
    }>;
}

export interface ValidationError {
    field: string;
    message: string;
}

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

// ============================================================================
// Socket.IO Event Types
// ============================================================================

export interface SocketLocationUpdate {
    deviceId?: string;
    workerId?: string;
    coords: Coordinates;
    timestamp: number;
}

export interface SocketGroupLocationUpdate {
    userId: string;
    groupId: string;
    lat: number;
    lng: number;
    heading?: number;
    accuracy?: number;
    timestamp: number;
}

export interface SocketTypingEvent {
    recipientId?: string;
    groupId?: string;
    isTyping: boolean;
}

export interface SocketMessageRead {
    messageId: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export const isApiError = (response: any): response is ApiError => {
    return response && response.success === false && typeof response.error === 'string';
};

export const isUser = (obj: any): obj is User => {
    return obj && typeof obj.id === 'string' && typeof obj.email === 'string';
};

export const isGroup = (obj: any): obj is Group => {
    return obj && typeof obj.id === 'string' && typeof obj.name === 'string' && Array.isArray(obj.members);
};
