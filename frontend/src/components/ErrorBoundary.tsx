import { Component, type ReactNode } from 'react';

interface Props   { children: ReactNode; fallback?: ReactNode; }
interface State   { hasError: boolean; message: string; }

/**
 * Catches any render-time JS error in its subtree and shows a
 * friendly message instead of a white screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          padding: '40px', margin: '24px', borderRadius: '16px',
          background: 'rgba(255,200,200,0.3)',
          border: '1px solid rgba(193,18,31,0.2)',
          color: '#c1121f',
        }}>
          <div style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '8px' }}>
            Something went wrong rendering this page
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem', opacity: 0.8 }}>
            {this.state.message}
          </div>
          <button
            onClick={() => this.setState({ hasError: false, message: '' })}
            style={{
              marginTop: '16px', padding: '8px 20px', borderRadius: '50px',
              border: 'none', background: '#c1121f', color: '#fff',
              fontWeight: 600, cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
