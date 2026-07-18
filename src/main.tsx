import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { performDataMigration } from './store/migration.ts'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { LocalPersistenceError } from './store/yjs.ts'
import { registerPwa } from './pwa.ts'

registerPwa();

// Initialize theme before React renders to prevent flash.
// Default matches migration / useInquiries (light) when nothing is stored.
const initTheme = () => {
  try {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark';
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (error) {
    console.error('Failed to initialize theme:', error);
    document.documentElement.classList.remove('dark');
  }
};

const rootElement = document.getElementById('root');

const renderApp = () => {
  if (!rootElement) {
    throw new Error('IdeaMap root element was not found.');
  }

  initTheme();

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
};

const renderBlockingFailure = (error: unknown) => {
  if (!rootElement) {
    console.error('IdeaMap root element was not found.', error);
    return;
  }

  const normalized = error instanceof Error
    ? error
    : new LocalPersistenceError(
      'IdeaMap could not finish local initialization.',
      error,
    );

  createRoot(rootElement).render(
    <StrictMode>
      <ErrorBoundary initialError={normalized} />
    </StrictMode>,
  );
};

initTheme();

performDataMigration().then(renderApp, renderBlockingFailure);
