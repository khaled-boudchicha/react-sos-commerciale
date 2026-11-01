import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { apollo } from './api/client';
import { useSession } from './store/session';
import App from './App';
import { ToastProvider } from './components/ui/Toast';
import { loadTheme } from './screens/Parametres';
import { loadPalette } from './lib/apparence';
// Polices embarquées (aucun appel à Google Fonts : rendu identique hors ligne, pas de fuite d'usage vers un tiers)
import '@fontsource/plus-jakarta-sans/latin-400.css';
import '@fontsource/plus-jakarta-sans/latin-500.css';
import '@fontsource/plus-jakarta-sans/latin-600.css';
import '@fontsource/plus-jakarta-sans/latin-700.css';
import '@fontsource/plus-jakarta-sans/latin-800.css';
import '@fontsource/jetbrains-mono/latin-400.css';
import '@fontsource/jetbrains-mono/latin-500.css';
import '@fontsource/jetbrains-mono/latin-600.css';
import '@fontsource/jetbrains-mono/latin-700.css';
import '@fontsource/jetbrains-mono/latin-800.css';
import './styles/index.css';
import './styles/report-theme.css';
import { initialiserImpression } from './impression';
import { usePreferencesNavigation } from './navigation/preferences';
import PontNotifications from './impression/PontNotifications';
import { surveillerErreursGlobales } from './lib/journalErreurs';

// Erreurs de script et promesses non gérées : journal local (Diagnostic), avant tout le reste
surveillerErreursGlobales();
initialiserImpression();
void useSession.getState().hydrate();
void loadTheme();
void loadPalette();
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
