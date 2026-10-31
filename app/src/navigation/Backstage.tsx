import { useEffect, useState, type ReactNode } from 'react';
import { useDroits } from '../lib/droits';
import { Icone, type NomIcone } from './icones';
import { C, type Commande } from './commandes';
import ChoixDisposition from './ChoixDisposition';
import type { InfosSession } from './Ruban';
import { Kbd } from '../components/ui/Icon';
import { StatusDot } from '../components/ui/atoms';

/**
 * Menu « Fichier » plein écran (backstage d'Office) : informations du poste, session, raccourcis et
 * options d'affichage. Échap ou la flèche de retour le referment.
 */
export default function Backstage({ session, onClose, lancer }: { session: InfosSession; onClose: () => void; lancer: (c: Commande) => void }) {
  const droits = useDroits();
  const [vue, setVue] = useState<'infos' | 'affichage'>('infos');
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => { void window.gc?.version?.().then(setVersion); }, []);
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
      <nav className="w-[248px] flex-none flex flex-col text-white py-3" style={{ background: 'var(--gradient-hero)' }}>
        <button onClick={onClose} className="mx-3 mb-3 w-9 h-9 rounded-full inline-flex items-center justify-center hover:bg-white/15" aria-label="Retour" title="Retour (Échap)">
          <Icone nom="chevronGauche" taille={20} />
        </button>
        <Entree icone="info" libelle="Informations" actif={vue === 'infos'} onClick={() => setVue('infos')} />
        <Entree icone="ruban" libelle="Affichage" actif={vue === 'affichage'} onClick={() => setVue('affichage')} />
        <Separateur />
        {session_.map((c) => <Entree key={c.id} icone={c.icone} libelle={c.libelle} onClick={() => lancer(c)} />)}
        {application.length > 0 && <Separateur />}
        {application.map((c) => <Entree key={c.id} icone={c.icone} libelle={c.libelle} onClick={() => lancer(c)} />)}
        <div className="mt-auto px-5 pt-3 text-xs opacity-80">Gestion Commerciale{version ? ` · v${version}` : ''}</div>
      </nav>

      <main className="flex-1 overflow-auto p-10" style={{ background: 'var(--bg)' }}>
        {vue === 'infos' ? (
          <div className="max-w-[860px]">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-6">Informations</h1>
            <div className="grid grid-cols-2 gap-4">
              <Carte titre="Dossier" icone="dossier">
                <div className="text-lg font-bold text-ink">{session.dossier}</div>
                <div className="text-sm text-ink-muted">Utilisateur : <b className="text-ink-label">{session.utilisateur}</b></div>
                <Action onClick={() => lancer(C.dossier)}>Changer de dossier ou d’utilisateur</Action>
              </Carte>
              <Carte titre="Agent" icone="serveur">
                <div className="flex items-center gap-2 text-lg font-bold text-ink">
                  <StatusDot online={session.online} />
                  {session.online ? 'Connecté' : 'Hors ligne'}
                </div>
                <div className="text-sm text-ink-muted truncate">{session.agent}</div>
                {session.plusieursAgents && <Action onClick={() => lancer(C.agent)}>Changer d’agent</Action>}
              </Carte>
              <Carte titre="Application" icone="tableau">
                <div className="text-lg font-bold text-ink">Gestion Commerciale {version ? `v${version}` : ''}</div>
                <div className="text-sm text-ink-muted">SOFTLY — gestion commerciale, stock et trésorerie</div>
                {C.parametres.si(droits) && <Action onClick={() => lancer(C.parametres)}>Ouvrir les paramètres</Action>}
              </Carte>
              <Carte titre="Raccourcis clavier" icone="info">
                <ul className="text-sm text-ink-label flex flex-col gap-1.5">
                  {[['Ctrl K', 'Recherche globale'], ['Ctrl /', 'Tous les raccourcis'], ['Alt', 'Touches d’accès du ruban (puis lettre)'], ['Ctrl F1', 'Réduire / épingler le ruban'], ['Échap', 'Fermer / revenir']].map(([k, l]) => (
                    <li key={k} className="flex items-center gap-2"><span className="min-w-[64px]"><Kbd>{k}</Kbd></span>{l}</li>
                  ))}
                </ul>
              </Carte>
            </div>
          </div>
        ) : (
          <div className="max-w-[860px]">
            <h1 className="text-2xl font-extrabold tracking-tight text-ink mb-2">Affichage</h1>
            <p className="text-sm text-ink-muted mb-5">Disposition du menu de navigation sur ce poste.</p>
            <ChoixDisposition />
          </div>
        )}
      </main>
    </div>
  );
}

function Entree({ icone, libelle, actif, onClick }: { icone: NomIcone; libelle: string; actif?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="mx-2 flex items-center gap-3 px-3 h-[38px] rounded-md text-base font-semibold text-left hover:bg-white/10 transition-colors"
            style={actif ? { background: 'rgb(255 255 255 / .2)' } : undefined}>
      <Icone nom={icone} taille={17} /> {libelle}
    </button>
  );
}

const Separateur = () => <div className="mx-5 my-2 h-px" style={{ background: 'rgb(255 255 255 / .22)' }} />;

function Carte({ titre, icone, children }: { titre: string; icone: NomIcone; children: ReactNode }) {
  return (
    <section className="bg-surface border border-line-soft rounded-md shadow-soft p-4 flex flex-col gap-1.5">
      <div className="flex items-center gap-2 text-2xs font-bold uppercase tracking-wider text-ink-muted mb-1">
        <Icone nom={icone} taille={14} /> {titre}
      </div>
      {children}
    </section>
  );
}

function Action({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button onClick={onClick} className="self-start mt-1.5 text-sm font-bold text-brand-text hover:underline underline-offset-2">{children}</button>;
}
