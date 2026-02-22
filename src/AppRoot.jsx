import { StrictMode } from 'react';
import App from './App.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';

export default function AppRoot() {
  return (
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>
  );
}
