# Component Documentation

## UI Components

### LoadingOverlay

Global loading overlay with optional message.

**Import:**
```typescript
import { LoadingOverlay } from '@/components/ui';
```

**Props:**
```typescript
interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  transparent?: boolean;
}
```

**Usage:**
```tsx
<LoadingOverlay 
  visible={isLoading} 
  message="Yükleniyor..." 
/>
```

---

### Skeleton

Shimmer loading placeholder.

**Import:**
```typescript
import { 
  Skeleton, 
  SkeletonCircle, 
  SkeletonText, 
  SkeletonCard,
  SkeletonProfile 
} from '@/components/ui';
```

**Usage:**
```tsx
// Basic skeleton
<Skeleton width="100%" height={20} />

// Circle skeleton (avatar)
<SkeletonCircle size={48} />

// Text skeleton (multiple lines)
<SkeletonText lines={3} />

// Card skeleton
<SkeletonCard />

// Profile skeleton
<SkeletonProfile />
```

---

### ErrorDisplay

User-friendly error display with retry functionality.

**Import:**
```typescript
import { ErrorDisplay, EmptyState } from '@/components/ui';
```

**Props:**
```typescript
interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  type?: 'error' | 'warning' | 'info';
  icon?: keyof typeof Ionicons.glyphMap;
  actionText?: string;
}
```

**Usage:**
```tsx
<ErrorDisplay 
  error="Bağlantı hatası"
  onRetry={handleRetry}
  type="error"
/>

<EmptyState
  icon="folder-open-outline"
  title="Veri Bulunamadı"
  description="Henüz hiç kayıt yok"
  actionText="Yenile"
  onAction={handleRefresh}
/>
```

---

### Toast

Global toast notification system.

**Setup:**
```tsx
// In App.tsx or _layout.tsx
import { ToastProvider } from '@/components/ui';

export default function App() {
  return (
    <ToastProvider>
      {/* Your app */}
    </ToastProvider>
  );
}
```

**Usage:**
```tsx
import { useToast } from '@/components/ui';

function MyComponent() {
  const { showSuccess, showError, showWarning, showInfo } = useToast();

  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Kaydedildi!');
    } catch (error) {
      showError('Kaydetme başarısız');
    }
  };

  return <Button onPress={handleSave}>Kaydet</Button>;
}
```

---

## Custom Hooks

### useProfile

Manages profile data, loading, and updates.

**Import:**
```typescript
import { useProfile } from '@/hooks/useProfile';
```

**Return Type:**
```typescript
interface UseProfileReturn {
  profile: ProfileData | null;
  loading: boolean;
  error: string | null;
  refreshing: boolean;
  loadProfile: () => Promise<void>;
  updateProfile: (updates: Partial<ProfileData>) => Promise<{ success: boolean; error?: string }>;
  refresh: () => Promise<void>;
}
```

**Usage:**
```tsx
function ProfileScreen() {
  const { profile, loading, error, refresh } = useProfile();

  if (loading) return <SkeletonProfile />;
  if (error) return <ErrorDisplay error={error} onRetry={refresh} />;

  return (
    <ScrollView refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={refresh} />
    }>
      <Text>{profile?.displayName}</Text>
      <Text>{profile?.email}</Text>
    </ScrollView>
  );
}
```

---

### useAuth

Manages authentication, logout, and account operations.

**Import:**
```typescript
import { useAuth } from '@/hooks/useAuth';
```

**Return Type:**
```typescript
interface UseAuthReturn {
  loggingOut: boolean;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  deleteAccount: () => Promise<{ success: boolean; error?: string }>;
}
```

**Usage:**
```tsx
function SettingsScreen() {
  const { showSuccess, showError } = useToast();
  const { loggingOut, logout, changePassword } = useAuth(
    (msg) => showSuccess(msg),
    (msg) => showError(msg)
  );

  return (
    <View>
      <Button onPress={logout} loading={loggingOut}>
        Çıkış Yap
      </Button>
    </View>
  );
}
```

---

### useAvatar

Manages avatar upload, selection, and deletion.

**Import:**
```typescript
import { useAvatar } from '@/hooks/useAvatar';
```

**Return Type:**
```typescript
interface UseAvatarReturn {
  avatarUrl: string | null;
  uploading: boolean;
  pickFromGallery: () => Promise<void>;
  takePhoto: () => Promise<void>;
  deleteAvatar: () => Promise<{ success: boolean; error?: string }>;
  uploadAvatar: (uri: string) => Promise<{ success: boolean; error?: string }>;
}
```

**Usage:**
```tsx
function AvatarPicker() {
  const { showSuccess, showError } = useToast();
  const { avatarUrl, uploading, pickFromGallery, takePhoto } = useAvatar(
    (msg) => showSuccess(msg),
    (msg) => showError(msg)
  );

  return (
    <View>
      {uploading ? (
        <ActivityIndicator />
      ) : (
        <Image source={{ uri: avatarUrl || defaultAvatar }} />
      )}
      <Button onPress={pickFromGallery}>Galeriden Seç</Button>
      <Button onPress={takePhoto}>Fotoğraf Çek</Button>
    </View>
  );
}
```

---

## Utilities

### passwordValidator

Password strength calculation and validation.

**Import:**
```typescript
import {
  calculatePasswordStrength,
  analyzePassword,
  validatePassword
} from '@/utils/passwordValidator';
```

**Functions:**

```typescript
// Calculate strength (0-4)
const score = calculatePasswordStrength('MyP@ssw0rd');

// Full analysis
const analysis = analyzePassword('MyP@ssw0rd');
// {
//   score: 4,
//   label: 'Güçlü',
//   color: '#10b981',
//   suggestions: []
// }

// Validate
const result = validatePassword('weak');
// { valid: false, error: 'Şifre çok zayıf' }
```

---

### appErrorHandler

Centralized error handling.

**Import:**
```typescript
import {
  handleApiError,
  getUserFriendlyMessage,
  createNetworkError
} from '@/utils/appErrorHandler';
```

**Functions:**

```typescript
// Type-safe API calls
const result = await handleApiError(
  () => authFetch('/users/me'),
  'ProfileScreen'
);

if (result.success) {
  setProfile(result.data);
} else {
  showError(result.error);
}

// Get user-friendly message
try {
  await someApiCall();
} catch (error) {
  const message = getUserFriendlyMessage(error);
  showError(message);
}
```

---

### accessibility

Accessibility helper utilities.

**Import:**
```typescript
import {
  createButtonA11y,
  createInputA11y,
  A11yLabels,
  A11yHints
} from '@/utils/accessibility';
```

**Usage:**

```tsx
<Pressable {...createButtonA11y('Kaydet', 'Formu kaydet')}>
  <Text>Kaydet</Text>
</Pressable>

<TextInput 
  {...createInputA11y('E-posta', 'E-posta adresinizi girin', email)}
  value={email}
  onChangeText={setEmail}
/>
```

---

## Best Practices

### Component Structure

```tsx
/**
 * Component description
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface MyComponentProps {
  title: string;
  onPress?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({
  title,
  onPress
}) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16
  },
  title: {
    fontSize: 18,
    fontFamily: 'Poppins-Bold'
  }
});
```

### Hook Usage

1. Always provide success/error callbacks
2. Handle loading states
3. Clean up on unmount
4. Use TypeScript types

### Error Handling

1. Use `handleApiError` for API calls
2. Show user-friendly messages
3. Provide retry functionality
4. Log errors for debugging

### Accessibility

1. Add accessibility labels to all interactive elements
2. Use semantic roles
3. Provide hints for complex interactions
4. Test with screen readers

---

## Examples

### Complete Form Example

```tsx
import React, { useState } from 'react';
import { View, TextInput, Button } from 'react-native';
import { useToast } from '@/components/ui';
import { validatePassword } from '@/utils/passwordValidator';
import { createInputA11y, createButtonA11y } from '@/utils/accessibility';

export const PasswordForm = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { showSuccess, showError } = useToast();

  const handleSubmit = async () => {
    const validation = validatePassword(password);
    if (!validation.valid) {
      showError(validation.error!);
      return;
    }

    setLoading(true);
    try {
      await savePassword(password);
      showSuccess('Şifre kaydedildi!');
    } catch (error) {
      showError('Kaydetme başarısız');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <TextInput
        {...createInputA11y('Şifre', 'Yeni şifrenizi girin', password)}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      <Button
        {...createButtonA11y('Kaydet', 'Şifreyi kaydet', loading)}
        onPress={handleSubmit}
        disabled={loading}
        title={loading ? 'Kaydediliyor...' : 'Kaydet'}
      />
    </View>
  );
};
```
