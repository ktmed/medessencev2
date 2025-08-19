'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  resetOnPropsChange?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
}

export default class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const errorId = `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Enhanced error logging
    console.error('🚨 ErrorBoundary caught an error:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
      errorId,
      timestamp: new Date().toISOString(),
      url: typeof window !== 'undefined' ? window.location.href : 'SSR',
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'SSR'
    });

    this.setState({
      error,
      errorInfo,
      errorId
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-reset after 10 seconds to attempt recovery
    this.resetTimeoutId = window.setTimeout(() => {
      this.handleReset();
    }, 10000);
  }

  componentDidUpdate(prevProps: Props) {
    const { resetOnPropsChange, children } = this.props;
    const { hasError } = this.state;

    // Reset error boundary when props change (if enabled)
    if (hasError && resetOnPropsChange && prevProps.children !== children) {
      this.handleReset();
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
    }
  }

  handleReset = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId);
      this.resetTimeoutId = null;
    }
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: ''
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
            <div className="text-center">
              <AlertTriangle className="w-16 h-16 text-error-500 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Something went wrong
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Error ID: {this.state.errorId.slice(-8)}
              </p>
              <p className="text-gray-600 mb-6">
                The application encountered an unexpected error. This has been logged for review.
              </p>
              
              {process.env.NODE_ENV === 'development' && this.state.error && (
                <details className="text-left mb-6">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 mb-2">
                    Error Details
                  </summary>
                  <div className="bg-gray-100 p-4 rounded-md overflow-auto">
                    <pre className="text-xs text-gray-800">
                      {this.state.error.stack}
                    </pre>
                  </div>
                </details>
              )}
              
              <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
                <button
                  onClick={this.handleReset}
                  className="medical-button-primary flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Try Again</span>
                </button>
                
                <button
                  onClick={() => window.location.reload()}
                  className="medical-button-secondary flex items-center justify-center space-x-2"
                >
                  <Home className="w-4 h-4" />
                  <span>Reload Page</span>
                </button>
              </div>
              
              <div className="text-xs text-gray-500 bg-gray-50 rounded p-2">
                <p>This error has been logged for debugging.</p>
                <p>Auto-retry in 10 seconds...</p>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook version for functional components
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  return function BoundaryComponent(props: P) {
    return (
      <ErrorBoundary>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Specialized Error Boundaries for different contexts

export function ReportErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="medical-card min-h-[300px] flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Report Generation Failed
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Unable to display the medical report due to an error.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="medical-button-secondary"
            >
              Reload Application
            </button>
          </div>
        </div>
      }
      resetOnPropsChange={true}
    >
      {children}
    </ErrorBoundary>
  );
}

export function SummaryErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="medical-card min-h-[250px] flex items-center justify-center">
          <div className="text-center">
            <AlertTriangle className="w-10 h-10 text-orange-500 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Summary Unavailable
            </h3>
            <p className="text-sm text-gray-600">
              Patient summary could not be generated at this time.
            </p>
          </div>
        </div>
      }
      resetOnPropsChange={true}
    >
      {children}
    </ErrorBoundary>
  );
}

export function EnhancedFindingsErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <h4 className="font-medium text-amber-900">Enhanced Findings Error</h4>
              <p className="text-sm text-amber-800">
                Enhanced findings analysis is temporarily unavailable.
              </p>
            </div>
          </div>
        </div>
      }
      resetOnPropsChange={true}
    >
      {children}
    </ErrorBoundary>
  );
}