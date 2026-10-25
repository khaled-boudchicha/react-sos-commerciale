import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Ruban from '../navigation/Ruban';
import { Icone } from '../navigation/icones';
import { COULEUR_TON, MENU_LATERAL, estActive, type Action } from '../navigation/commandes';
import { usePreferencesNavigation } from '../navigation/preferences';
import ErrorBoundary from './ErrorBoundary';
import { useQuery } from '@apollo/client';
import { MY_AGENTS } from '../api/auth';
import { useSession } from '../store/session';
import CommandPalette from './CommandPalette';
import DossierSwitcher from './DossierSwitcher';
import AgentSwitcher from './AgentSwitcher';
import { useSessionKeepAlive } from '../api/useSessionKeepAlive';
import { useDroitsSync } from '../api/useDroitsSync';
import { useDroits } from '../lib/droits';

export { LIBELLES_REFERENTIELS } from '../navigation/commandes';

export default function AppShell() {
  const { agent, dossier, dossierUser, accessError, logout } = useSession();
  const location = useLocation();
  const droits = useDroits();
  useDroitsSync();
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [changerDossier, setChangerDossier] = useState(false);
  const [changerAgent, setChangerAgent] = useState(false);
  const disposition = usePreferencesNavigation((s) => s.disposition);

  // Renouvellement du JWT + veille sur le blocage de compte / l'abonnement
  useSessionKeepAlive();

  // ⌘K / Ctrl+K : palette de commandes (recherche globale + navigation)
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Statut agent temps quasi-réel : polling myAgents (pas de subscriptions côté cloud)
  const { data } = useQuery(MY_AGENTS, { pollInterval: 20_000, fetchPolicy: 'network-only' });
  // Bascule proposée seulement si le compte a plusieurs agents
  const plusieursAgents = Array.isArray(data?.myAgents) && data.myAgents.length > 1;
  const live = (data?.myAgents as { agentId: string; isOnline: boolean }[] | undefined)
    ?.find((a) => a.agentId === agent?.agentId);
  const online = live?.isOnline ?? agent?.isOnline ?? false;

  // Caisse plein écran (maquette « Vente au comptoir ») : ni barre latérale ni en-tête ;
  // le renouvellement de session et les alertes de compte restent actifs.
  if (location.pathname === '/comptoir') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        {accessError && <BandeauAcces code={accessError} onLogout={logout} />}
        <CommandPalette open={paletteOuverte} onClose={() => setPaletteOuverte(false)} />
        <div className="flex-1 min-h-0">
          <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>
        </div>
      </div>
    );
  }

  const executer = (a: Action) => {
    if (a === 'palette') setPaletteOuverte(true);
    else if (a === 'dossier') setChangerDossier(true);
    else if (a === 'agent') setChangerAgent(true);
    else if (a === 'deconnexion') logout();
  };

  const surcouches = (
    <>
      {accessError && <BandeauAcces code={accessError} onLogout={logout} />}
      <CommandPalette open={paletteOuverte} onClose={() => setPaletteOuverte(false)} />
      {changerDossier && <DossierSwitcher onClose={() => setChangerDossier(false)} />}
      {changerAgent && <AgentSwitcher onClose={() => setChangerAgent(false)} />}
    </>
  );

  // Disposition « ruban » (style Office) : commandes en haut, contenu sur toute la largeur
  if (disposition === 'ruban') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Ruban executer={executer} session={{
          online, agent: String(agent?.label ?? agent?.agentId ?? ''), dossier: String(dossier ?? ''),
          utilisateur: String(dossierUser?.username ?? ''), plusieursAgents,
        }} />
        {surcouches}
        <main className="flex-1 p-5 overflow-auto min-h-0">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-[212px] flex-none bg-surface border-r border-line-soft flex flex-col p-2.5">
        <div className="flex items-center gap-2.5 px-2 pb-3 border-b border-line-soft mb-2">
          <div className="w-8 h-8 rounded-md text-white font-extrabold text-[13px] flex items-center justify-center"
               style={{ background: 'var(--gradient-hero)' }}>GC</div>
          <div>
            <div className="font-bold text-[13px] leading-tight">Gestion Com.</div>
            <div className="text-[9px] font-semibold tracking-widest text-ink-muted">DESKTOP</div>
          </div>
          <button onClick={() => usePreferencesNavigation.getState().definirDisposition('ruban')}
                  title="Afficher le ruban de commandes (style Office)" aria-label="Afficher le ruban de commandes"
                  className="ml-auto h-7 w-7 rounded-md inline-flex items-center justify-center text-ink-muted hover:text-ink hover:bg-line-soft">
            <Icone nom="ruban" taille={16} />
          </button>
        </div>
        {MENU_LATERAL.map((section) => ({ ...section, commandes: section.commandes.filter((c) => !c.si || c.si(droits)) }))
          .filter((section) => section.commandes.length > 0)
          .map((section) => (
          <div key={section.groupe ?? 'racine'}>
            {section.groupe && (
              <div className="text-[9.5px] font-bold tracking-widest uppercase text-ink-muted px-2.5 pt-3 pb-1">
                {section.groupe}
              </div>
            )}
            {section.commandes.map((c) => {
              const actif = estActive(c, location.pathname, location.search);
              return (
                <NavLink key={c.id} to={c.to!}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-sm text-[12px] font-semibold mb-0.5 ${actif ? 'bg-brand-50 text-brand-700' : 'text-ink-label hover:bg-line-soft'}`}>
                  <Icone nom={c.icone} taille={15} style={{ color: actif ? 'var(--brand-700)' : COULEUR_TON[c.ton], opacity: actif ? 1 : 0.85 }} />
                  {c.libelle}
                </NavLink>
              );
            })}
          </div>
        ))}
        <div className="mt-auto border-t border-line-soft pt-2.5 px-1 text-[11px]">
          <button onClick={() => setChangerDossier(true)}
                  title="Changer de dossier ou d'utilisateur"
                  className="w-full text-left border border-line rounded-md px-2.5 py-2 font-semibold text-ink-label hover:border-brand-300">
            📁 <b className="text-ink">{dossier}</b>
            <div className="text-[10px] text-ink-muted">{dossierUser?.username as string} · changer</div>
          </button>
          {plusieursAgents && (
            <button onClick={() => setChangerAgent(true)} className="mt-2 w-full text-left px-2.5 py-1.5 rounded-sm text-ink-label font-semibold hover:bg-line-soft">
              🖥 Changer d&apos;agent
            </button>
          )}
          <button onClick={logout} className="mt-1 w-full text-left px-2.5 py-1.5 rounded-sm text-ink-muted hover:bg-line-soft">
            Changer d'utilisateur
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[50px] flex-none bg-surface border-b border-line-soft flex items-center gap-4 px-4">
          <button onClick={() => setPaletteOuverte(true)}
                  className="flex-1 max-w-[380px] flex items-center gap-2 bg-bg border border-line rounded-md px-3 py-1.5 text-ink-muted text-[12px] hover:border-brand-300">
            🔍 Rechercher client, article, pièce…
            <span className="ml-auto font-mono text-[10px] border border-line rounded px-1.5 bg-surface">⌘K</span>
          </button>
          <div className="ml-auto flex items-center gap-2 text-[11.5px] font-semibold text-ink-label">
            <span className="w-2 h-2 rounded-full" style={{ background: online ? 'var(--success)' : 'var(--danger)' }} />
            {online ? 'Agent connecté' : 'Agent hors ligne'} · {agent?.label ?? agent?.agentId}
          </div>
        </header>

        {surcouches}

        <main className="flex-1 p-5 overflow-auto">
          <ErrorBoundary resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

/** Bandeau d'erreur d'accès poussé par le serveur (compte bloqué, abonnement, agent). */
function BandeauAcces({ code, onLogout }: { code: string; onLogout: () => void }) {
  return (
    <div className="px-4 py-2 text-[12px] font-semibold text-white" style={{ background: 'var(--danger)' }}>
      {code === 'SUBSCRIPTION_EXPIRED' && 'Abonnement expiré — contactez SOFTLY pour renouveler.'}
      {code === 'SUBSCRIPTION_SUSPENDED' && 'Abonnement suspendu — contactez SOFTLY.'}
      {code === 'ACCOUNT_BLOCKED' && 'Compte bloqué — contactez SOFTLY.'}
      {code === 'AGENT_NOT_ALLOWED' && (
        <>Cet agent n&apos;est plus rattaché à votre compte.{' '}
          <button onClick={onLogout} className="underline font-bold">Se reconnecter</button></>
      )}
    </div>
  );
}
