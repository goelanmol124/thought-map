import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { performDataMigration } from './store/migration.ts'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { initAnalytics } from './analytics.ts'

initAnalytics();

// The theme class is applied by a blocking script in index.html to avoid a flash.
performDataMigration().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
});