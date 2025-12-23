# Testing Guide

## Overview

This guide covers the testing infrastructure for the Bavaxe GPS Tracking application.

## Test Stack

- **Jest**: Test runner and assertion library
- **React Native Testing Library**: Component testing
- **@testing-library/react-hooks**: Hook testing
- **Supertest**: API endpoint testing
- **Mock Service Worker (MSW)**: API mocking

## Setup

### Install Dependencies

```bash
npm install --save-dev jest @testing-library/react-native @testing-library/jest-native @testing-library/react-hooks jest-expo
```

### Backend Testing

```bash
cd backend
npm install --save-dev jest supertest
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage

# Run specific test file
npm test -- PasswordValidator.test.ts
```

## Test Examples

### 1. Utility Function Tests

**File:** `__tests__/utils/passwordValidator.test.ts`

```typescript
import {
  calculatePasswordStrength,
  analyzePassword,
  validatePassword
} from '@/utils/passwordValidator';

describe('passwordValidator', () => {
  describe('calculatePasswordStrength', () => {
    it('should return 0 for empty password', () => {
      expect(calculatePasswordStrength('')).toBe(0);
    });

    it('should return 1 for weak password', () => {
      expect(calculatePasswordStrength('abc')).toBe(1);
    });

    it('should return 4 for strong password', () => {
      expect(calculatePasswordStrength('MyP@ssw0rd123!')).toBe(4);
    });
  });

  describe('analyzePassword', () => {
    it('should provide suggestions for weak password', () => {
      const result = analyzePassword('weak');
      expect(result.score).toBeLessThan(3);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should have no suggestions for strong password', () => {
      const result = analyzePassword('MyP@ssw0rd123!');
      expect(result.score).toBe(4);
      expect(result.suggestions.length).toBe(0);
    });
  });

  describe('validatePassword', () => {
    it('should reject password shorter than 6 characters', () => {
      const result = validatePassword('abc');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('6 karakter');
    });

    it('should accept strong password', () => {
      const result = validatePassword('MyP@ssw0rd');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });
});
```

### 2. Custom Hook Tests

**File:** `__tests__/hooks/useProfile.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react-hooks';
import { useProfile } from '@/hooks/useProfile';

// Mock dependencies
jest.mock('@/utils/auth');
jest.mock('expo-secure-store');

describe('useProfile', () => {
  it('should load profile on mount', async () => {
    const { result } = renderHook(() => useProfile());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.profile).toBeDefined();
  });

  it('should handle profile update', async () => {
    const { result } = renderHook(() => useProfile());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const updateResult = await result.current.updateProfile({
      displayName: 'New Name'
    });

    expect(updateResult.success).toBe(true);
    expect(result.current.profile?.displayName).toBe('New Name');
  });
});
```

### 3. Component Tests

**File:** `__tests__/components/LoadingOverlay.test.tsx`

```typescript
import React from 'react';
import { render } from '@testing-library/react-native';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

describe('LoadingOverlay', () => {
  it('should render when visible', () => {
    const { getByText } = render(
      <LoadingOverlay visible={true} message="Loading..." />
    );

    expect(getByText('Loading...')).toBeTruthy();
  });

  it('should not render when not visible', () => {
    const { queryByText } = render(
      <LoadingOverlay visible={false} message="Loading..." />
    );

    expect(queryByText('Loading...')).toBeNull();
  });
});
```

### 4. Backend API Tests

**File:** `backend/__tests__/api/auth.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');

describe('Auth API', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'Test123!',
          displayName: 'Test User'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
    });

    it('should reject invalid email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'Test123!',
          displayName: 'Test User'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'Test123!'
        });

      expect(response.status).toBe(200);
      expect(response.body.token).toBeDefined();
    });

    it('should reject invalid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrong-password'
        });

      expect(response.status).toBe(401);
    });
  });
});
```

## Test Coverage Goals

- **Utilities**: >90% coverage
- **Hooks**: >80% coverage
- **Components**: >70% coverage
- **API Endpoints**: >80% coverage

## Best Practices

1. **Test Naming**: Use descriptive test names
2. **Arrange-Act-Assert**: Follow AAA pattern
3. **Mock External Dependencies**: Always mock API calls, storage, etc.
4. **Test Edge Cases**: Test error scenarios, empty states, etc.
5. **Keep Tests Fast**: Use mocks to avoid slow operations
6. **One Assertion Per Test**: Keep tests focused

## CI/CD Integration

Add to `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v2
```

## Troubleshooting

### Common Issues

1. **Module not found**: Check jest.config.js moduleNameMapper
2. **Timeout errors**: Increase jest timeout in tests
3. **Mock not working**: Ensure mock is defined before import

## Next Steps

1. Write tests for critical paths
2. Set up pre-commit hooks to run tests
3. Configure coverage thresholds
4. Add E2E tests with Detox
