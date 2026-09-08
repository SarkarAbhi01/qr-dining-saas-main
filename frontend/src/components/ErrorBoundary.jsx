import { Component } from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Without an error boundary, React unmounts the ENTIRE app on any
 * uncaught render error — producing a blank white page with zero
 * indication of what happened, visible only as a stack trace in a
 * browser console a customer would never open. This catches that,
 * logs the real error for debugging, and gives the person a way back
 * in instead of a dead end.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Unhandled render error:', error, info?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-center px-6 bg-paper">
          <p className="font-display text-2xl text-ink">Something went wrong</p>
          <p className="text-sm text-slate max-w-xs">
            This page hit an unexpected error. Reloading usually fixes it — your cart and table are
            still saved.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="flex items-center gap-2 bg-ink text-paper rounded-ticket px-4 py-2.5 text-sm font-medium"
          >
            <RefreshCw size={15} /> Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
