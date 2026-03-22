import React from 'react';

interface Props {
  fallbackTitle?: string;
  fallbackMessage?: string;
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage?: string;
}

export class AppErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    // Keep runtime detail in console for debugging while avoiding a hard blank screen.
    console.error('AppErrorBoundary caught an error:', error);
    this.setState({ errorMessage: error?.message || 'Unknown runtime error' });
  }

  private handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="max-w-lg w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-6 text-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {this.props.fallbackMessage || 'A runtime error occurred while rendering this view.'}
            </p>
            {this.state.errorMessage && (
              <p className="mt-3 text-xs text-rose-600 dark:text-rose-400 break-words">
                Error: {this.state.errorMessage}
              </p>
            )}
            <button
              onClick={this.handleReload}
              className="mt-4 inline-flex items-center justify-center rounded-xl bg-rose-600 text-white px-4 py-2 text-sm font-semibold hover:bg-rose-700 transition"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
