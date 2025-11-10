import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { performDataMigration } from './store/migration.ts'
import { ErrorBoundary } from './components/ErrorBoundary.tsx' // Import it

// Issue #12 - Initialize theme before React renders to prevent flash
const initTheme = () => {
  try {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (!savedTheme && true); // default to dark
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  } catch (error) {
    console.error('Failed to initialize theme:', error);
    // Default to dark mode on error
    document.documentElement.classList.add('dark');
  }
};

// Initialize theme immediately
initTheme();

performDataMigration().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
});