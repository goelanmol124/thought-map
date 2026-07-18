import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import {
  LocalPersistenceError,
  resetLocalPersistence,
} from '../store/yjs';

interface Props {
  children?: ReactNode;
  /** When set, render the blocking recovery UI immediately (e.g. IndexedDB hydrate failure). */
  initialError?: Error | null;
}

type ResetStatus = 'idle' | 'working' | 'blocked' | 'failed';

interface State {
  hasError: boolean;
  error: Error | null;
  resetStatus: ResetStatus;
  resetDetail: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State;

  constructor(props: Props) {
    super(props);
    const initial = props.initialError ?? null;
    this.state = {
      hasError: initial != null,
      error: initial,
      resetStatus: 'idle',
      resetDetail: null,
    };
  }

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private isPersistenceFailure(): boolean {
    return this.state.error instanceof LocalPersistenceError
      || this.state.error?.name === 'LocalPersistenceError';
  }

  private handleReset = () => {
    if (this.state.resetStatus === 'working') return;

    if (!window.confirm('Are you sure? This will delete ALL local inquiry data and reset the app.')) {
      return;
    }

    void this.runEmergencyReset();
  };

  private runEmergencyReset = async () => {
    this.setState({ resetStatus: 'working', resetDetail: null });

    try {
      // Close open IDB connections first so deleteDatabase is not blocked by this tab.
      // Legacy localStorage backups stay until IndexedDB deletion succeeds.
      await resetLocalPersistence();
    } catch (error) {
      const detail = error instanceof Error
        ? error.message
        : 'IdeaMap could not clear IndexedDB. Close other tabs and retry.';
      const blocked = error instanceof LocalPersistenceError
        && detail.toLowerCase().includes('another tab');
      console.error('Emergency Reset failed before clearing backups:', error);
      this.setState({
        resetStatus: blocked ? 'blocked' : 'failed',
        resetDetail: detail,
      });
      return;
    }

    try {
      localStorage.clear();
    } catch (error) {
      // IndexedDB is already gone; surface the mirror-clear failure but still reload
      // so the user is not stuck with a wiped primary store and a broken UI.
      console.error('Failed to clear localStorage after IndexedDB reset:', error);
    }

    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const persistenceFailure = this.isPersistenceFailure();
      const { resetStatus, resetDetail } = this.state;
      const resetBusy = resetStatus === 'working';

      return (
        <div className="min-h-screen w-full flex items-center justify-center bg-stone-100 dark:bg-slate-900 p-4 font-sans">
            <div className="max-w-md w-full bg-white dark:bg-slate-800 shadow-xl rounded-lg p-6 border border-red-200 dark:border-red-900/30">
                <div className="flex items-center gap-3 text-red-600 dark:text-red-500 mb-4">
                    <AlertTriangle size={32} />
                    <h1 className="text-2xl font-bold">
                      {persistenceFailure ? 'Local data unavailable' : 'Something went wrong.'}
                    </h1>
                </div>
                <p className="text-stone-600 dark:text-slate-300 mb-4">
                    {persistenceFailure
                      ? 'IdeaMap could not load your IndexedDB store. The app will not open an empty unsaved session.'
                      : 'IdeaMap hit a critical error while loading your local inquiries.'}
                </p>
                {this.state.error?.message && (
                  <p className="text-sm text-stone-500 dark:text-slate-400 mb-4 break-words">
                    {this.state.error.message}
                  </p>
                )}
                {(resetStatus === 'blocked' || resetStatus === 'failed') && (
                  <div
                    className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
                    role="alert"
                  >
                    <p className="font-semibold mb-1">
                      {resetStatus === 'blocked'
                        ? 'Reset blocked — data was not cleared.'
                        : 'Reset failed — data was not cleared.'}
                    </p>
                    <p className="mb-2">
                      {resetDetail
                        ?? 'Close every other IdeaMap tab, then retry Emergency Reset. Legacy backups were left in place.'}
                    </p>
                    <p>
                      Do not assume your inquiries were wiped. Retry after closing other tabs, or restart the browser if the database stays locked.
                    </p>
                  </div>
                )}
                <button
                    type="button"
                    onClick={this.handleReset}
                    disabled={resetBusy}
                    className="w-full py-3 px-4 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold rounded-md transition-colors"
                >
                    {resetBusy
                      ? 'Resetting…'
                      : resetStatus === 'blocked' || resetStatus === 'failed'
                        ? 'Retry Emergency Reset'
                        : 'Emergency Reset'}
                </button>
            </div>
        </div>
      );
    }

    return this.props.children;
  }
}
