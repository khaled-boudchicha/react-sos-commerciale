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
import ShortcutsDialog from './ShortcutsDialog';
import { useSessionKeepAlive } from '../api/useSessionKeepAlive';
import { useDroitsSync } from '../api/useDroitsSync';
import { useDroits } from '../lib/droits';
import { applyTheme } from '../screens/Parametres';
import { Icon, Kbd } from './ui/Icon';
import { IconButton } from './ui/Button';
import { Menu } from './ui/Menu';
import { StatusDot } from './ui/atoms';
import { cn } from './ui/cn';

export { LIBELLES_REFERENTIELS } from '../navigation/commandes';

const CLE_REPLI = 'gc.sidebar.replie';
const lireRepli = () => { try { return localStorage.getItem(CLE_REPLI) === '1'; } catch { return false; } };

export const initiales = (nom: string) =>
  (nom || '?').split(/[\s._-]+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || '?';

export default function AppShell() {
  const { agent, dossier, dossierUser, accessError, logout } = useSession();
  const location = useLocation();
  const droits = useDroits();
  useDroitsSync();
  const [paletteOuverte, setPaletteOuverte] = useState(false);
  const [changerDossier, setChangerDossier] = useState(false);
  const [changerAgent, setChangerAgent] = useState(false);
  const [aide, setAide] = useState(false);
  const [replie, setReplie] = useState(lireRepli);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => (document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'));
  const disposition = usePreferencesNavigation((s) => s.disposition);

  // Renouvellement du JWT + veille sur le blocage de compte / l'abonnement
  useSessionKeepAlive();

  // ⌘K / Ctrl+K : palette de commandes ; Ctrl+/ : aide aux raccourcis
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOuverte((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setAide((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const basculerRepli = () => setReplie((r) => {
    try { localStorage.setItem(CLE_REPLI, r ? '0' : '1'); } catch { /* stockage indisponible */ }
    return !r;
  });
  const basculerTheme = () => {
    const t = theme === 'dark' ? 'light' : 'dark';
    setTheme(t);
    applyTheme(t);
  };

  // Statut agent temps quasi-réel : polling myAgents (pas de subscriptions côté cloud)
  const { data } = useQuery(MY_AGENTS, { pollInterval: 20_000, fetchPolicy: 'network-only' });
  // Bascule proposée seulement si le compte a plusieurs agents
  const plusieursAgents = Array.isArray(data?.myAgents) && data.myAgents.length > 1;
  const live = (data?.myAgents as { agentId: string; isOnline: boolean }[] | undefined)
    ?.find((a) => a.agentId === agent?.agentId);
  const online = live?.isOnline ?? agent?.isOnline ?? false;
  const nomAgent = String(agent?.label ?? agent?.agentId ?? '');
  const utilisateur = String(dossierUser?.name || dossierUser?.username || '');

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
      {aide && <ShortcutsDialog onClose={() => setAide(false)} />}
    </>
  );

  const contenu = (
    <main className="flex-1 overflow-auto min-h-0" id="contenu">
      <div className="px-6 py-5 max-w-[1680px] mx-auto">
        <ErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </div>
    </main>
  );

  // Disposition « ruban » (style Office) : commandes en haut, contenu sur toute la largeur
  if (disposition === 'ruban') {
    return (
      <div className="h-screen flex flex-col overflow-hidden">
        <Ruban executer={executer} session={{
          online, agent: nomAgent, dossier: String(dossier ?? ''),
          utilisateur: String(dossierUser?.username ?? ''), plusieursAgents,
        }} />
        {surcouches}
        {contenu}
      </div>
    );
  }

  const sections = MENU_LATERAL
    .map((section) => ({ ...section, commandes: section.commandes.filter((c) => !c.si || c.si(droits)) }))
    .filter((section) => section.commandes.length > 0);

  return (
    <div className="h-screen flex overflow-hidden">
      <aside className={cn('flex-none bg-surface border-r border-line-soft flex flex-col transition-[width] duration-slow',
        replie ? 'w-[64px]' : 'w-[232px]')}>
        {/* Marque */}
        <div className={cn('h-[56px] flex items-center gap-2.5 border-b border-line-soft flex-none', replie ? 'justify-center px-2' : 'px-4')}>
          <div className="w-8 h-8 rounded-md text-ink-inverse font-extrabold text-sm flex items-center justify-center flex-none shadow-soft"
               style={{ background: 'var(--gradient-hero)' }} aria-hidden="true">GC</div>
          {!replie && (
            <div className="min-w-0 flex-1">
              <div className="font-extrabold text-base leading-tight text-ink truncate">Gestion Commerciale</div>
              <div className="text-2xs font-bold tracking-widest uppercase text-gold-text">SOFTLY · Desktop</div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav aria-label="Navigation principale" className={cn('flex-1 overflow-y-auto py-2', replie ? 'px-2' : 'px-3')}>
          {sections.map((section) => (
            <div key={section.groupe ?? 'racine'} className="mb-1">
              {section.groupe && (replie
                ? <div className="mx-2 my-2 border-t border-line-soft" aria-hidden="true" />
                : <div className="text-2xs font-bold tracking-widest uppercase text-ink-muted px-2.5 pt-3 pb-1.5">{section.groupe}</div>)}
              {section.commandes.map((c) => {
                const actif = estActive(c, location.pathname, location.search);
                return (
                  <NavLink key={c.id} to={c.to!} title={replie ? c.libelle : c.aide} aria-current={actif ? 'page' : undefined}
                    className={cn('group relative flex items-center gap-2.5 h-9 rounded-md text-sm font-semibold mb-0.5 transition-colors duration-fast',
                      replie ? 'justify-center' : 'px-2.5',
                      actif ? 'bg-brand-soft text-brand-text' : 'text-ink-label hover:bg-hover hover:text-ink')}>
                    {actif && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-brand-700" aria-hidden="true" />}
                    <span className={cn('inline-flex h-7 w-7 items-center justify-center rounded-sm flex-none transition-colors',
                      actif ? '' : 'group-hover:bg-surface')}
                          style={{ color: actif ? 'var(--brand-text)' : COULEUR_TON[c.ton] }}>
                      <Icone nom={c.icone} taille={17} />
                    </span>
                    {!replie && <span className="truncate">{c.libelle}</span>}
                  </NavLink>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Compte et dossier */}
        <div className={cn('border-t border-line-soft flex-none', replie ? 'p-2 flex flex-col items-center gap-1' : 'p-3')}>
          {replie ? (
            <>
              <IconButton icon="folder" label={`Dossier ${dossier} — changer`} onClick={() => setChangerDossier(true)} />
              <IconButton icon="chevronsRight" label="Déplier le menu" onClick={basculerRepli} />
            </>
          ) : (
            <>
              <button onClick={() => setChangerDossier(true)} title="Changer de dossier ou d'utilisateur"
                      className="w-full flex items-center gap-2.5 rounded-md border border-line-soft bg-sunken px-2.5 py-2 text-left hover:border-brand-line hover:bg-hover transition-colors">
                <span className="w-8 h-8 rounded-full bg-brand-soft text-brand-text text-xs font-extrabold flex items-center justify-center flex-none">
                  {initiales(utilisateur)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink truncate">{utilisateur || '—'}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted truncate"><Icon name="folder" size={12} />{dossier}</span>
                </span>
                <Icon name="chevronRight" size={14} className="text-ink-muted" />
              </button>
              <div className="flex items-center justify-between mt-2">
                <IconButton icon="chevronsLeft" label="Réduire le menu" size="sm" onClick={basculerRepli} />
                <div className="flex items-center gap-0.5">
                  <IconButton icon="layoutRibbon" label="Afficher le ruban de commandes (style Office)" size="sm"
                              onClick={() => usePreferencesNavigation.getState().definirDisposition('ruban')} />
                  {plusieursAgents && <IconButton icon="server" label="Changer d’agent" size="sm" onClick={() => setChangerAgent(true)} />}
                  <IconButton icon="logout" label="Se déconnecter (changer d’utilisateur)" size="sm" onClick={logout} />
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-[56px] flex-none bg-surface border-b border-line-soft flex items-center gap-3 px-5">
          <button onClick={() => setPaletteOuverte(true)}
                  className="flex-1 max-w-[440px] h-control-md flex items-center gap-2.5 bg-sunken border border-line rounded-md px-3 text-ink-muted text-sm hover:border-brand-line hover:bg-surface transition-colors">
            <Icon name="search" size={16} />
            <span className="truncate">Rechercher un client, un article, une pièce, un écran…</span>
            <span className="ml-auto flex items-center gap-0.5"><Kbd>Ctrl</Kbd><Kbd>K</Kbd></span>
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className={cn('hidden md:inline-flex items-center gap-2 h-8 px-3 rounded-full text-xs font-semibold border',
              online ? 'bg-success-soft border-success-line text-success-text' : 'bg-danger-soft border-danger-line text-danger-text')}
                  title={`${online ? 'Agent connecté' : 'Agent hors ligne'} — ${nomAgent}`}>
              <StatusDot online={online} />
              <span className="max-w-[200px] truncate">{online ? 'Connecté' : 'Hors ligne'} · {nomAgent}</span>
            </span>
            <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'} onClick={basculerTheme} />
            <IconButton icon="keyboard" label="Raccourcis clavier (Ctrl+/)" onClick={() => setAide(true)} />
            <Menu label="Compte" icon="user" iconOnly variant="ghost" width={250} items={[
              { heading: `${utilisateur || 'Utilisateur'} · ${dossier ?? ''}` },
              { label: 'Changer de dossier', icon: 'folder', onSelect: () => setChangerDossier(true) },
              ...(plusieursAgents ? [{ label: 'Changer d’agent', icon: 'server' as const, onSelect: () => setChangerAgent(true) }] : []),
              { label: 'Ruban de commandes', icon: 'layoutRibbon', onSelect: () => usePreferencesNavigation.getState().definirDisposition('ruban') },
              'separator',
              { label: 'Se déconnecter', icon: 'logout', tone: 'danger', onSelect: logout },
            ]} />
          </div>
        </header>

        {surcouches}
        {contenu}
      </div>
    </div>
  );
}

/** Bandeau d'erreur d'accès poussé par le serveur (compte bloqué, abonnement, agent). */
function BandeauAcces({ code, onLogout }: { code: string; onLogout: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-ink-inverse" style={{ background: 'var(--danger-solid)' }}>
      <Icon name="alertCircle" size={16} />
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
