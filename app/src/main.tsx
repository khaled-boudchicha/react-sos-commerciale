import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { apollo } from './api/client';
import { useSession } from './store/session';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import { loadTheme } from './screens/Parametres';
import './styles/index.css';
import './styles/report-theme.css';
import { initialiserImpression } from './impression';
import { usePreferencesNavigation } from './navigation/preferences';
import PontNotifications from './impression/PontNotifications';

initialiserImpression();
void useSession.getState().hydrate();
void loadTheme();
void usePreferencesNavigation.getState().charger();

// Aide au dev navigateur (hors Electron) : window.__session.getState().setAuth(...)
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__session = useSession;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={apollo}>
      <ToastProvider>
        <PontNotifications />
        <App />
      </ToastProvider>
    </ApolloProvider>
  </React.StrictMode>,
);
