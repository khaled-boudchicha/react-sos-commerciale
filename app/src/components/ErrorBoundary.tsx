import { Component, ErrorInfo, ReactNode } from 'react';
import { Link } from 'react-router-dom';

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
      <div className="bg-surface border border-line-soft rounded-md shadow-soft p-6 max-w-[640px]">
        <div className="text-[15px] font-extrabold" style={{ color: 'var(--danger)' }}>Cet écran a rencontré une erreur</div>
        <div className="text-[12px] text-ink-muted mt-1">
          Vos données ne sont pas affectées. Vous pouvez réessayer ou revenir au tableau de bord.
        </div>
        <pre className="mt-3 text-[11px] money whitespace-pre-wrap rounded-sm p-3 bg-bg text-ink-label max-h-40 overflow-auto">
          {error.message}
        </pre>
        <div className="flex gap-2 mt-4">
          <button onClick={() => this.setState({ error: null })}
                  className="rounded-md px-3 py-1.5 font-bold text-[12px] text-white bg-brand-700">Réessayer</button>
          <Link to="/" onClick={() => this.setState({ error: null })}
                className="rounded-md px-3 py-1.5 font-bold text-[12px] border border-line text-ink-label">Tableau de bord</Link>
        </div>
      </div>
    );
  }
}
