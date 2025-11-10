import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    if (window.confirm("Are you sure? This will delete ALL local data and reset the app.")) {
        localStorage.clear();
        // Clear IndexedDB if possible, or just rely on localStorage clear triggering a fresh state next time
        window.location.reload();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-stone-100 dark:bg-slate-900 p-4 font-sans">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6 border border-red-200 dark:border-red-900/30">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-500 mb-4">
                    <AlertTriangle size={32} />
                    <h1 className="text-2xl font-bold">Something went wrong.</h1>
                </div>
                <p className="text-stone-600 dark:text-slate-300 mb-6">
                    The application encountered a critical error.
                </p>
                <button 
                    onClick={this.handleReset} 
                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-md transition-colors"
                >
                    Emergency Reset
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}