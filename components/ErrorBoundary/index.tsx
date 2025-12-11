/**
 * Professional Error Boundary Component
 * Catches and handles React errors gracefully
 */

import { Ionicons } from '@expo/vector-icons';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../ui/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundaryClass extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to error tracking service (e.g., Sentry)
    // You can integrate error tracking here
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onReset }) => {
  const theme = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.bg.primary }]}>
      <View style={[styles.content, { backgroundColor: theme.colors.surface.elevated }]}>
        <View style={[styles.iconContainer, { backgroundColor: theme.colors.semantic.danger + '20' }]}>
          <Ionicons 
            name="alert-circle" 
            size={48} 
            color={theme.colors.semantic.danger} 
          />
        </View>
        
        <Text style={[styles.title, { color: theme.colors.text.primary }]}>
          Bir Hata Oluştu
        </Text>
        
        <Text style={[styles.message, { color: theme.colors.text.secondary }]}>
          {error?.message || 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'}
        </Text>
        
        {__DEV__ && error && (
          <View style={[styles.errorDetails, { backgroundColor: theme.colors.bg.secondary }]}>
            <Text style={[styles.errorText, { color: theme.colors.text.tertiary }]}>
              {error.stack}
            </Text>
          </View>
        )}
        
        <Pressable
          onPress={onReset}
          style={[styles.button, { backgroundColor: theme.colors.primary.main }]}
          android_ripple={{ color: theme.colors.primary.light }}
        >
          <Text style={styles.buttonText}>Tekrar Dene</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20
  },
  content: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center'
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 12,
    textAlign: 'center'
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24
  },
  errorDetails: {
    width: '100%',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    maxHeight: 200
  },
  errorText: {
    fontSize: 12,
    fontFamily: 'monospace'
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 120
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
  }
});

export const ErrorBoundary = ErrorBoundaryClass;
export default ErrorBoundaryClass;

