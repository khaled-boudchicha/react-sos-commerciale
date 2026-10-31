import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDroits } from '../lib/droits';
import { Icon, IconBadge, Kbd, type IconName } from '../components/ui/Icon';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/States';
import { StatusDot } from '../components/ui/atoms';
import { cn } from '../components/ui/cn';
import { C, TEINTE_TON, commandeDeChemin, commandesAccesRapide, type Commande } from './commandes';
import ChoixDisposition from './ChoixDisposition';
import { usePreferencesNavigation } from './preferences';
import { ilYA, useRecents } from './recents';
import type { InfosSession } from './Ruban';

/**
 * Menu « Fichier » plein écran (backstage d'Office) : informations du poste, écrans récents, session,
 * raccourcis et options d'affichage. Échap ou la flèche de retour le referment.
 */

type Vue = 'infos' | 'recents' | 'affichage';

export default function Backstage({ session, onClose, lancer }: { session: InfosSession; onClose: () => void; lancer: (c: Commande) => void }) {
  const droits = useDroits();
  const [vue, setVue] = useState<Vue>('infos');
  const [version, setVersion] = useState<string | null>(null);
  const retour = useRef<HTMLButtonElement>(null);

  useEffect(() => { void window.gc?.version?.().then(setVersion); }, []);
  // Focus sur « Retour » à l'ouverture, rendu à l'élément d'origine à la fermeture
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    retour.current?.focus();
    return () => precedent?.focus?.();
  }, []);
  useEffect(() => {
    const f = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [onClose]);

  const ok = (c: Commande) => !c.si || c.si(droits);
  const session_ = [C.dossier, ...(session.plusieursAgents ? [C.agent] : []), C.deconnexion];
  const application = [C.parametres, C.modeles, C.utilisateurs, C.diagnostic].filter(ok);

  return (
    <div className="fixed inset-0 z-backstage flex animate-fade-in" role="dialog" aria-modal="true" aria-label="Fichier">
      <nav className="w-[248px] flex-none flex flex-col text-ink-inverse py-3" style={{ background: 'var(--gradient-hero)' }} aria-label="Menu Fichier">
        <button ref={retour} type="button" onClick={onClose} aria-label="Retour" title="Retour (Échap)"
                className="mx-3 mb-3 w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-white/15 transition-colors duration-fast">
          <Icon name="arrowLeft" size={20} />
        </button>
        <Entree icone="info" libelle="Informations" actif={vue === 'infos'} onClick={() => setVue('infos')} />
        <Entree icone="history" libelle="Récents" actif={vue === 'recents'} onClick={() => setVue('recents')} />
        <Entree icone="layoutRibbon" libelle="Affichage" actif={vue === 'affichage'} onClick={() => setVue('affichage')} />
        <Separateur />
        {session_.map((c) => <Entree key={c.id} icone={c.icone} libelle={c.libelle} onClick={() => lancer(c)} />)}
        {application.length > 0 && <Separateur />}
        {application.map((c) => <Entree key={c.id} icone={c.icone} libelle={c.libelle} onClick={() => lancer(c)} />)}
        <div className="mt-auto px-5 pt-3 text-xs opacity-80">Gestion Commerciale{version ? ` · v${version}` : ''}</div>
      </nav>

      <main className="flex-1 overflow-auto p-10 bg-bg">
        {vue === 'infos' && (
          <div className="max-w-[860px]">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-6">Informations</h1>
            <div className="grid grid-cols-2 gap-4">
              <Carte titre="Dossier" icone="folder">
                <div className="text-lg font-bold text-ink">{session.dossier}</div>
                <div className="text-sm text-ink-muted">Utilisateur : <b className="text-ink-label">{session.utilisateur}</b></div>
                <Action onClick={() => lancer(C.dossier)}>Changer de dossier ou d’utilisateur</Action>
              </Carte>
              <Carte titre="Agent" icone="server">
                <div className="flex items-center gap-2 text-lg font-bold text-ink">
                  <StatusDot online={session.online} />
                  {session.online ? 'Connecté' : 'Hors ligne'}
                </div>
                <div className="text-sm text-ink-muted truncate">{session.agent}</div>
                {session.plusieursAgents && <Action onClick={() => lancer(C.agent)}>Changer d’agent</Action>}
              </Carte>
              <Carte titre="Application" icone="dashboard">
                <div className="text-lg font-bold text-ink">Gestion Commerciale {version ? `v${version}` : ''}</div>
                <div className="text-sm text-ink-muted">SOFTLY — gestion commerciale, stock et trésorerie</div>
                {C.parametres.si(droits) && <Action onClick={() => lancer(C.parametres)}>Ouvrir les paramètres</Action>}
              </Carte>
              <Carte titre="Raccourcis clavier" icone="keyboard">
                <ul className="text-sm text-ink-label flex flex-col gap-1.5">
                  {[
                    ['Ctrl K', 'Recherche globale'], ['Ctrl /', 'Tous les raccourcis'], ['Alt', 'Touches d’accès du ruban (puis lettre)'],
                    ['Alt 1…9', 'Commandes de l’accès rapide'], ['Ctrl F1', 'Réduire / épingler le ruban'], ['Échap', 'Fermer / revenir'],
                  ].map(([k, l]) => (
                    <li key={k} className="flex items-center gap-2"><span className="min-w-[64px]"><Kbd>{k}</Kbd></span>{l}</li>
                  ))}
                </ul>
              </Carte>
            </div>
          </div>
        )}
        {vue === 'recents' && <VueRecents onClose={onClose} />}
        {vue === 'affichage' && (
          <div className="max-w-[860px] flex flex-col gap-8">
            <section>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-2">Affichage</h1>
              <p className="text-sm text-ink-muted mb-5">Disposition du menu de navigation sur ce poste.</p>
              <ChoixDisposition />
            </section>
            <AccesRapideOptions />
          </div>
        )}
      </main>
    </div>
  );
}

/** Écrans récemment ouverts sur ce poste (clic = rouvrir). */
function VueRecents({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { recents, vider } = useRecents();
  const maintenant = Date.now();
  return (
    <div className="max-w-[860px]">
      <div className="flex items-end gap-3 mb-5">
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-1">Récents</h1>
          <p className="text-sm text-ink-muted">Les {recents.length > 1 ? `${recents.length} derniers écrans ouverts` : 'derniers écrans ouverts'} sur ce poste.</p>
        </div>
        {recents.length > 0 && <Button variant="ghost" size="sm" icon="trash" onClick={vider}>Effacer la liste</Button>}
      </div>
      {recents.length === 0 ? (
        <div className="bg-surface border border-line-soft rounded-md shadow-soft">
          <EmptyState icon="history" title="Aucun écran récent" description="Les écrans que vous ouvrez apparaîtront ici pour y revenir en un clic." />
        </div>
      ) : (
        <ul className="bg-surface border border-line-soft rounded-md shadow-soft divide-y divide-line-soft overflow-hidden">
          {recents.map((r) => {
            const [chemin, requete = ''] = r.chemin.split('?');
            const cmd = commandeDeChemin(chemin, requete ? `?${requete}` : '');
            return (
              <li key={r.chemin}>
                <button type="button" onClick={() => { onClose(); navigate(r.chemin); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-hover transition-colors duration-fast">
                  <IconBadge name={cmd?.icone ?? 'history'} tone={cmd ? TEINTE_TON[cmd.ton] : 'neutral'} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-base font-semibold text-ink truncate">{r.titre}</span>
                    <span className="block text-xs text-ink-muted font-mono truncate">{r.chemin}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted whitespace-nowrap">
                    <Icon name="clock" size={12} />{ilYA(r.date, maintenant)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Contenu de la barre d'outils Accès rapide (retrait, rétablissement). */
function AccesRapideOptions() {
  const droits = useDroits();
  const { disposition, accesRapide, basculerAccesRapide, retablirAccesRapide } = usePreferencesNavigation();
  if (disposition !== 'ruban') return null;
  const commandes = commandesAccesRapide(accesRapide, droits);
  return (
    <section>
      <h2 className="text-lg font-bold text-ink mb-1">Barre d’outils Accès rapide</h2>
      <p className="text-sm text-ink-muted mb-3">
        Clic droit sur un bouton du ruban pour l’ajouter ou le retirer ; le chevron au bout de la barre propose les commandes courantes.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {commandes.length === 0 && <span className="text-sm text-ink-muted">Aucune commande.</span>}
        {commandes.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1.5 h-8 pl-2.5 pr-1 rounded-md border border-line bg-surface text-sm font-semibold text-ink-label">
            <Icon name={c.icone} size={14} />{c.libelle}
            <IconButton icon="close" size="xs" label={`Retirer « ${c.libelle} » de l’accès rapide`} onClick={() => basculerAccesRapide(c.id)} />
          </span>
        ))}
        <Button variant="ghost" size="sm" icon="refresh" onClick={retablirAccesRapide}>Rétablir par défaut</Button>
      </div>
    </section>
  );
}

function Entree({ icone, libelle, actif, onClick }: { icone: IconName; libelle: string; actif?: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-current={actif ? 'page' : undefined}
            className={cn('mx-2 flex items-center gap-3 px-3 h-[38px] rounded-md text-base font-semibold text-left transition-colors duration-fast',
              actif ? 'bg-white/20' : 'hover:bg-white/10')}>
      <Icon name={icone} size={18} /> {libelle}
    </button>
  );
}

const Separateur = () => <div className="mx-5 my-2 h-px bg-white/20" aria-hidden="true" />;

function Carte({ titre, icone, children }: { titre: string; icone: IconName; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">
        <Icon name={icone} size={14} /> {titre}
      </div>
      {children}
    </section>
  );
}

function Action({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <Button variant="link" size="sm" className="self-start mt-1.5" onClick={onClick}>{children}</Button>;
}
