import { Component, ErrorInfo, ReactNode } from 'react';
import { StatePanel } from './ui/States';
import { Button } from './ui/Button';

type Props = { children: ReactNode; /** Change de valeur → l'erreur est oubliée (ex. changement d'écran). */ resetKey?: string };
type State = { error: Error | null };

/**
 * Filet de sécurité de rendu : une exception dans un écran affiche un panneau
 * d'erreur au lieu d'une page blanche, sans perdre la barre latérale ni la session.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <StatePanel kind="error" title="Cet écran a rencontré une erreur"
                  description="Vos données ne sont pas affectées. Vous pouvez réessayer ou revenir au tableau de bord."
                  detail={error.message}
                  actions={(
                    <>
                      <Button variant="primary" icon="refresh" onClick={() => this.setState({ error: null })}>Réessayer</Button>
                      <Button icon="dashboard" to="/" onClick={() => this.setState({ error: null })}>Tableau de bord</Button>
                    </>
                  )} />
    );
  }
}
