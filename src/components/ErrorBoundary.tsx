import React from 'react';

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

/**
 * App-wide error boundary that catches render errors and chunk-load failures.
 *
 * Without this, a single uncaught error in any lazy-loaded page (e.g. Settings,
 * Sales POS) causes React to unmount the entire tree → blank white screen with
 * no way to recover except killing the APK.
 *
 * When an error is caught the user sees a friendly recovery screen with:
 *  - A "Retry" button that clears the error and attempts to re-render
 *  - A "Reload App" button as a last resort
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log for debugging — visible in Android logcat / Chrome DevTools
    console.error('[ErrorBoundary] Caught error:', error, info.componentStack);
    this.setState({ errorInfo: info.componentStack || '' });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: '' });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '50vh',
            padding: '2rem',
            textAlign: 'center',
            gap: '1rem',
          }}
        >
          <div style={{ fontSize: '2.5rem' }}>⚠️</div>
          <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>
            Something went wrong
          </h2>
          <p style={{ margin: 0, color: '#888', fontSize: '0.875rem', maxWidth: '300px' }}>
            {this.state.error?.message || 'An unexpected error occurred while loading this page.'}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                background: 'hsl(var(--primary, 220 90% 56%))',
                color: 'white',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Retry
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                border: '1px solid #ddd',
                background: 'transparent',
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '0.875rem',
              }}
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
