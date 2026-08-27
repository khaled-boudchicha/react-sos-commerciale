import React from 'react';
import ReactDOM from 'react-dom/client';
import { ApolloProvider } from '@apollo/client';
import { apollo } from './api/client';
import { useSession } from './store/session';
import App from './App';
import { loadTheme } from './screens/Parametres';
import './styles/index.css';

void useSession.getState().hydrate();
void loadTheme();

// Aide au dev navigateur (hors Electron) : window.__session.getState().setAuth(...)
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__session = useSession;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ApolloProvider client={apollo}>
      <App />
    </ApolloProvider>
  </React.StrictMode>,
);
