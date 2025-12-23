# Contributing Guide

## Welcome!

Thank you for considering contributing to Bavaxe GPS Tracking! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Expo CLI
- Android Studio or Xcode (for mobile development)

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/bavaxe-gps-tracking.git
   cd bavaxe-gps-tracking
   ```

3. Install dependencies:
   ```bash
   npm install
   cd backend && npm install
   ```

4. Create a branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Adding tests
- `chore/` - Maintenance tasks

Examples:
- `feature/add-dark-mode`
- `fix/login-crash`
- `docs/update-readme`

### Commit Messages

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(auth): add biometric authentication

Implemented Face ID and Touch ID support for iOS and Android.
Includes fallback to password authentication.

Closes #123
```

```
fix(profile): resolve avatar upload crash

Fixed crash when uploading large images by adding
proper error handling and file size validation.

Fixes #456
```

## Code Style

### TypeScript/JavaScript

- Use TypeScript for new code
- Follow ESLint rules
- Use Prettier for formatting
- Prefer functional components
- Use hooks over class components

**Example:**
```typescript
// ✅ Good
export const MyComponent: React.FC<Props> = ({ title }) => {
  const [count, setCount] = useState(0);
  
  return <Text>{title}: {count}</Text>;
};

// ❌ Bad
export class MyComponent extends React.Component {
  // ...
}
```

### File Naming

- Components: `PascalCase.tsx` (e.g., `ProfileScreen.tsx`)
- Hooks: `camelCase.ts` with `use` prefix (e.g., `useProfile.ts`)
- Utilities: `camelCase.ts` (e.g., `passwordValidator.ts`)
- Types: `camelCase.ts` (e.g., `api.ts`)

### Component Structure

```typescript
/**
 * Component description
 */

// 1. Imports
import React, { useState } from 'react';
import { View, Text } from 'react-native';

// 2. Types
interface Props {
  title: string;
}

// 3. Component
export const MyComponent: React.FC<Props> = ({ title }) => {
  // 3a. Hooks
  const [state, setState] = useState();
  
  // 3b. Handlers
  const handlePress = () => {
    // ...
  };
  
  // 3c. Render
  return (
    <View>
      <Text>{title}</Text>
    </View>
  );
};

// 4. Styles
const styles = StyleSheet.create({
  // ...
});
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run with coverage
npm test -- --coverage
```

### Writing Tests

- Write tests for all new features
- Maintain >80% code coverage
- Test edge cases and error scenarios
- Use descriptive test names

**Example:**
```typescript
describe('passwordValidator', () => {
  it('should return 0 for empty password', () => {
    expect(calculatePasswordStrength('')).toBe(0);
  });

  it('should return 4 for strong password', () => {
    expect(calculatePasswordStrength('MyP@ssw0rd123!')).toBe(4);
  });
});
```

## Pull Request Process

### Before Submitting

1. **Update your branch:**
   ```bash
   git checkout main
   git pull upstream main
   git checkout your-branch
   git rebase main
   ```

2. **Run tests:**
   ```bash
   npm test
   ```

3. **Run linter:**
   ```bash
   npm run lint
   ```

4. **Build the project:**
   ```bash
   npm run build
   ```

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex code
- [ ] Documentation updated
- [ ] No new warnings
- [ ] Tests pass locally
- [ ] Dependent changes merged

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #123
```

### Review Process

1. Submit PR with descriptive title and description
2. Ensure CI/CD checks pass
3. Request review from maintainers
4. Address review comments
5. Squash commits if requested
6. Wait for approval and merge

## Documentation

### When to Update Docs

- Adding new features
- Changing APIs
- Updating dependencies
- Fixing bugs that affect usage

### Documentation Files

- `README.md` - Project overview
- `docs/API.md` - API documentation
- `docs/COMPONENTS.md` - Component documentation
- `docs/TESTING.md` - Testing guide
- `CONTRIBUTING.md` - This file

## Issue Reporting

### Bug Reports

Include:
- Clear title
- Steps to reproduce
- Expected behavior
- Actual behavior
- Screenshots/videos
- Environment (OS, device, versions)
- Error messages/logs

**Template:**
```markdown
**Bug Description**
Clear description of the bug

**Steps to Reproduce**
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: iOS 17.0
- Device: iPhone 14 Pro
- App Version: 1.0.0

**Screenshots**
Add screenshots

**Additional Context**
Any other relevant information
```

### Feature Requests

Include:
- Clear title
- Problem description
- Proposed solution
- Alternatives considered
- Additional context

## Code Review Guidelines

### As a Reviewer

- Be constructive and respectful
- Explain the "why" behind suggestions
- Approve when ready, request changes when needed
- Test the changes locally if possible

### As an Author

- Respond to all comments
- Ask for clarification if needed
- Make requested changes promptly
- Thank reviewers for their time

## Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create release branch
4. Run full test suite
5. Build production bundles
6. Create GitHub release
7. Deploy to production

## Questions?

- Open an issue for questions
- Join our Discord server
- Email: support@bavaxe.com

## License

By contributing, you agree that your contributions will be licensed under the project's license.

---

Thank you for contributing! 🎉
