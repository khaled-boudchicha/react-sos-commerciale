import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDroits } from '../lib/droits';
import { Icone } from './icones';
import { C, COULEUR_TON, estActive, ongletDeRoute, ongletsVisibles, type Action, type Commande, type ElementRuban, type Onglet } from './commandes';
import { usePreferencesNavigation } from './preferences';
import Backstage from './Backstage';

/**
 * Ruban de commandes façon Microsoft Office : barre de titre (accès rapide, recherche, état de l'agent, compte),
 * onglet « Fichier » (backstage), onglets contextuels qui suivent l'écran ouvert, groupes de grands et petits
 * boutons, info-bulles détaillées, ruban réductible (Ctrl+F1, double-clic sur un onglet) et touches d'accès
 * (Alt, puis la lettre de l'onglet, puis celle de la commande). S'adapte à la largeur de la fenêtre.
 */

export type InfosSession = {
  online: boolean;
  agent: string;
  dossier: string;
  utilisateur: string;
  plusieursAgents: boolean;
};

const TOUCHES_COMMANDES = '123456789ABCDEGHIJKLMNOPQRSTUVWXYZ';
const teinte = (couleur: string, pct: number) => `color-mix(in srgb, ${couleur} ${pct}%, transparent)`;

export default function Ruban({ session, executer }: { session: InfosSession; executer: (a: Action) => void }) {
  const droits = useDroits();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const onglets = ongletsVisibles(droits);
  const { rubanReduit, definirRubanReduit, definirDisposition } = usePreferencesNavigation();

  const [actif, setActif] = useState(() => ongletDeRoute(pathname));
  const [deplieTemporaire, setDeplieTemporaire] = useState(false);
  const [backstage, setBackstage] = useState(false);
  const [touches, setTouches] = useState<null | 'onglets' | 'commandes'>(null);
  const [bulle, setBulle] = useState<{ cmd: Commande; x: number; y: number } | null>(null);
  const minuterie = useRef<number>();
  const depuisRuban = useRef(false);
  const racine = useRef<HTMLDivElement>(null);

  const onglet: Onglet | undefined = onglets.find((o) => o.id === actif) ?? onglets[0];
  const corpsVisible = !rubanReduit || deplieTemporaire;

  // L'onglet suit l'écran ouvert, sauf quand la navigation vient d'un clic dans le ruban (comme Office).
  useEffect(() => {
    if (!depuisRuban.current) setActif(ongletDeRoute(pathname));
    depuisRuban.current = false;
  }, [pathname]);

  const lancer = useCallback((cmd: Commande) => {
    setTouches(null);
    setDeplieTemporaire(false);
    setBulle(null);
    if (cmd.action === 'disposition') { definirDisposition('lateral'); return; }
    if (cmd.action === 'replier') { definirRubanReduit(!rubanReduit); return; }
    if (cmd.action) { executer(cmd.action); return; }
    if (cmd.to) { depuisRuban.current = true; navigate(cmd.to); }
  }, [definirDisposition, definirRubanReduit, executer, navigate, rubanReduit]);

  const choisirOnglet = (id: string) => {
    setActif(id);
    if (rubanReduit) setDeplieTemporaire((v) => (id === actif ? !v : true));
  };

  // Commandes de l'onglet actif, avec leur touche d'accès
  const elements: ElementRuban[] = onglet?.groupes.flatMap((g) => g.elements) ?? [];
  const toucheDe = (cmd: Commande) => TOUCHES_COMMANDES[elements.findIndex((e) => e.cmd.id === cmd.id)] ?? '';

  // Clavier : Ctrl+F1 (réduire), Alt (touches d'accès), Échap
  useEffect(() => {
    let altSeul = false;
    function bas(e: KeyboardEvent) {
      if (e.key === 'Alt') { altSeul = true; return; }
      altSeul = false;
      if (e.ctrlKey && e.key === 'F1') { e.preventDefault(); definirRubanReduit(!rubanReduit); return; }
      if (!touches) return;
      const k = e.key.toUpperCase();
      e.preventDefault();
      if (e.key === 'Escape') { setTouches(touches === 'commandes' ? 'onglets' : null); if (touches === 'onglets') setDeplieTemporaire(false); return; }
      if (touches === 'onglets') {
        if (k === 'F') { setTouches(null); setBackstage(true); return; }
        const o = onglets.find((x) => x.touche === k);
        if (o) { setActif(o.id); setTouches('commandes'); if (rubanReduit) setDeplieTemporaire(true); }
        return;
      }
      const el = elements.find((x) => toucheDe(x.cmd) === k);
      if (el) lancer(el.cmd);
    }
    function haut(e: KeyboardEvent) {
      if (e.key === 'Alt' && altSeul) { e.preventDefault(); setTouches((t) => (t ? null : 'onglets')); }
      altSeul = false;
    }
    window.addEventListener('keydown', bas);
    window.addEventListener('keyup', haut);
    return () => { window.removeEventListener('keydown', bas); window.removeEventListener('keyup', haut); };
  });

  // Clic hors du ruban : referme le ruban déplié temporairement et les touches d'accès
  useEffect(() => {
    if (!deplieTemporaire && !touches) return;
    const f = (e: MouseEvent) => { if (!racine.current?.contains(e.target as Node)) { setDeplieTemporaire(false); setTouches(null); } };
    window.addEventListener('mousedown', f);
    return () => window.removeEventListener('mousedown', f);
  }, [deplieTemporaire, touches]);

  // Info-bulles détaillées (après un court délai, comme Office)
  const survol = (cmd: Commande) => (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => setBulle({ cmd, x: Math.min(r.left, window.innerWidth - 290), y: r.bottom + 6 }), 550);
  };
  const quitter = () => { window.clearTimeout(minuterie.current); setBulle(null); };
  useEffect(() => () => window.clearTimeout(minuterie.current), []);

  // Adaptation à la largeur : 0 = complet, 1 = compact, 2 = petits boutons en icônes seules
  const corps = useRef<HTMLDivElement>(null);
  const [niveau, setNiveau] = useState(0);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = racine.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargeur(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => { setNiveau(0); }, [largeur, actif]);
  useLayoutEffect(() => {
    const el = corps.current;
    if (el && niveau < 2 && el.scrollWidth > el.clientWidth + 1) setNiveau((n) => n + 1);
  }, [niveau, largeur, actif, corpsVisible]);

  const props = { lancer, survol, quitter, chemin: pathname, recherche: search, niveau, touches: touches === 'commandes', toucheDe };

  return (
    <div ref={racine} className="relative flex-none select-none z-30" onDoubleClick={(e) => e.preventDefault()}>
      <BarreTitre session={session} executer={executer} lancer={lancer} ouvrirFichier={() => setBackstage(true)} droits={droits} />

      {/* Onglets */}
      <div className="h-[34px] flex items-end gap-0.5 px-2 bg-surface" role="tablist" aria-label="Onglets du ruban">
        <button onClick={() => setBackstage(true)} title="Fichier — dossier, compte, paramètres"
                className="relative h-[28px] px-4 mb-[3px] rounded-md text-[12.5px] font-bold text-white hover:brightness-110"
                style={{ background: 'var(--brand-700)' }}>
          Fichier
          {touches === 'onglets' && <ToucheAcces lettre="F" />}
        </button>
        {onglets.map((o) => {
          const sel = o.id === onglet?.id;
          return (
            <button key={o.id} role="tab" aria-selected={sel}
                    onClick={() => choisirOnglet(o.id)} onDoubleClick={() => { definirRubanReduit(!rubanReduit); setDeplieTemporaire(false); }}
                    style={sel && corpsVisible ? { color: 'var(--ruban-accent)' } : undefined}
                    className={`relative h-[31px] px-3.5 rounded-t-md text-[12.5px] font-semibold transition-colors ${sel && corpsVisible ? '' : 'text-ink-label hover:text-ink hover:bg-line-soft'}`}>
              {o.libelle}
              {sel && corpsVisible && <span className="absolute left-2.5 right-2.5 bottom-0 h-[3px] rounded-full" style={{ background: 'var(--ruban-accent)' }} />}
              {touches === 'onglets' && <ToucheAcces lettre={o.touche} />}
            </button>
          );
        })}
        <div className="ml-auto mb-1 flex items-center gap-1 text-ink-muted">
          <button onClick={() => { definirRubanReduit(!rubanReduit); setDeplieTemporaire(false); }}
                  className="h-7 w-7 rounded-md inline-flex items-center justify-center hover:bg-line-soft hover:text-ink"
                  title={rubanReduit ? 'Épingler le ruban (Ctrl+F1)' : 'Réduire le ruban (Ctrl+F1)'} aria-label={rubanReduit ? 'Épingler le ruban' : 'Réduire le ruban'}>
            <Icone nom={rubanReduit ? 'epingle' : 'chevronHaut'} taille={16} />
          </button>
        </div>
      </div>

      {/* Corps du ruban : en flux quand épinglé, en surimpression quand déplié temporairement */}
      {onglet && corpsVisible && (
        <div className={`${rubanReduit ? 'absolute left-0 right-0 top-full shadow-lifted' : ''} bg-surface border-y border-line-soft`}
             style={{ boxShadow: rubanReduit ? undefined : 'var(--shadow-soft)' }}>
          <div ref={corps} className="flex items-stretch h-[94px] px-1.5 overflow-hidden" role="toolbar" aria-label={`Ruban — ${onglet.libelle}`}>
            {onglet.groupes.map((g, gi) => (
              <Fragment key={g.titre}>
                {gi > 0 && <div className="w-px my-2.5 flex-none" style={{ background: 'var(--line-soft)' }} />}
                <div className="flex flex-col flex-none px-1">
                  <div className="flex items-start gap-0.5 flex-1 pt-1.5">{colonnes(g.elements, props)}</div>
                  <div className="text-[10.5px] text-ink-muted text-center pb-1 leading-none whitespace-nowrap">{g.titre}</div>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
      )}
      {!corpsVisible && <div className="border-b border-line-soft" />}

      {bulle && <InfoBulle {...bulle} />}
      {backstage && (
        <Backstage session={session} onClose={() => setBackstage(false)}
                   lancer={(cmd) => { setBackstage(false); lancer(cmd); }} />
      )}
    </div>
  );
}

// ─── Barre de titre ─────────────────────────────────────────────────────────

function BarreTitre({ session, executer, lancer, ouvrirFichier, droits }: {
  session: InfosSession; executer: (a: Action) => void; lancer: (c: Commande) => void; ouvrirFichier: () => void; droits: ReturnType<typeof useDroits>;
}) {
  const acces = ([C.tableau, C.nouvelleFA, C.comptoir] as Commande[]).filter((c) => !c.si || c.si(droits));
  const initiales = (session.utilisateur || '?').split(/[\s._-]+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="h-[40px] flex items-center gap-3 px-3 text-white overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
      <div className="flex items-center gap-2 flex-none">
        <div className="w-6 h-6 rounded-md text-[10.5px] font-extrabold flex items-center justify-center" style={{ background: 'rgb(255 255 255 / .18)' }}>GC</div>
        <span className="text-[12.5px] font-bold tracking-tight">Gestion Commerciale</span>
      </div>
      {/* Barre d'outils Accès rapide */}
      <div className="flex items-center gap-0.5 pl-2 ml-1 border-l" style={{ borderColor: 'rgb(255 255 255 / .22)' }} aria-label="Accès rapide">
        {acces.map((c) => (
          <button key={c.id} onClick={() => lancer(c)} title={c.libelle} aria-label={c.libelle}
                  className="h-7 w-7 rounded-md inline-flex items-center justify-center opacity-90 hover:opacity-100 hover:bg-white/15">
            <Icone nom={c.icone} taille={15} />
          </button>
        ))}
      </div>
      <button onClick={() => executer('palette')}
              className="mx-auto flex-1 min-w-[150px] max-w-[440px] h-[28px] flex items-center gap-2 rounded-md px-3 text-[12px] text-left hover:bg-white/25 transition-colors"
              style={{ background: 'rgb(255 255 255 / .16)', border: '1px solid rgb(255 255 255 / .22)' }}>
        <Icone nom="rechercher" taille={14} />
        <span className="opacity-90 truncate">Rechercher un client, un article, une pièce…</span>
        <span className="ml-auto font-mono text-[10px] rounded px-1.5 py-px" style={{ background: 'rgb(255 255 255 / .18)' }}>Ctrl K</span>
      </button>
      <div className="flex items-center gap-2 flex-none text-[11.5px] font-semibold">
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 h-[24px]" style={{ background: 'rgb(255 255 255 / .14)' }}
              title={`${session.online ? 'Agent connecté' : 'Agent hors ligne'} — ${session.agent}`}>
          <span className="w-2 h-2 rounded-full" style={{ background: session.online ? '#4ADE80' : '#F87171', boxShadow: '0 0 0 2px rgb(255 255 255 / .25)' }} />
          <span className="hidden xl:inline">{session.online ? 'Connecté' : 'Hors ligne'}</span>
        </span>
        <button onClick={() => executer('dossier')} className="inline-flex items-center gap-1.5 rounded-md px-2 h-[26px] hover:bg-white/15" title="Changer de dossier">
          <Icone nom="dossier" taille={14} /> <span className="max-w-[90px] xl:max-w-[180px] truncate">{session.dossier}</span>
        </button>
        <button onClick={ouvrirFichier} title={`${session.utilisateur} — compte et options`}
                className="w-[26px] h-[26px] rounded-full text-[10.5px] font-extrabold inline-flex items-center justify-center hover:ring-2 hover:ring-white/40"
                style={{ background: 'rgb(255 255 255 / .92)', color: 'var(--brand-700)' }}>
          {initiales}
        </button>
      </div>
    </div>
  );
}

// ─── Boutons ────────────────────────────────────────────────────────────────

type PropsBoutons = {
  lancer: (c: Commande) => void;
  survol: (c: Commande) => (e: React.MouseEvent<HTMLElement>) => void;
  quitter: () => void;
  chemin: string;
  recherche: string;
  niveau: number;
  touches: boolean;
  toucheDe: (c: Commande) => string;
};

/** Grands boutons isolés ; petits boutons empilés par colonnes de trois (disposition Office). */
function colonnes(elements: ElementRuban[], p: PropsBoutons): ReactNode[] {
  const sortie: ReactNode[] = [];
  let pile: Commande[] = [];
  const viderPile = () => {
    if (!pile.length) return;
    const lot = pile;
    sortie.push(<div key={`p-${lot[0].id}`} className="flex flex-col gap-px pt-0.5">{lot.map((c) => <BoutonPetit key={c.id} cmd={c} {...p} />)}</div>);
    pile = [];
  };
  for (const e of elements) {
    if (e.taille === 'grand') { viderPile(); sortie.push(<BoutonGrand key={e.cmd.id} cmd={e.cmd} {...p} />); }
    else { pile.push(e.cmd); if (pile.length === 3) viderPile(); }
  }
  viderPile();
  return sortie;
}

function BoutonGrand({ cmd, lancer, survol, quitter, chemin, recherche, niveau, touches, toucheDe }: PropsBoutons & { cmd: Commande }) {
  const actif = estActive(cmd, chemin, recherche);
  const couleur = COULEUR_TON[cmd.ton];
  const compact = niveau >= 1;
  return (
    <button onClick={() => lancer(cmd)} onMouseEnter={survol(cmd)} onMouseLeave={quitter} aria-current={actif ? 'page' : undefined}
            className={`relative flex flex-col items-center gap-1 rounded-md px-1.5 pt-1 pb-1 transition-colors ${compact ? 'w-[60px]' : 'min-w-[62px] max-w-[86px]'} h-[66px] ${actif ? '' : 'hover:bg-line-soft'}`}
            style={actif ? { background: teinte('var(--ruban-accent)', 10), boxShadow: `inset 0 0 0 1px ${teinte('var(--ruban-accent)', 22)}` } : undefined}>
      <span className="w-[30px] h-[30px] rounded-[8px] inline-flex items-center justify-center flex-none" style={{ color: couleur, background: teinte(couleur, 12) }}>
        <Icone nom={cmd.icone} taille={compact ? 18 : 19} />
      </span>
      <span className={`text-center font-semibold leading-[12.5px] line-clamp-2 ${compact ? 'text-[10.5px]' : 'text-[11px]'}`}
            style={{ color: actif ? 'var(--ruban-accent)' : 'var(--text-label)' }}>
        {cmd.court ?? cmd.libelle}
      </span>
      {touches && <ToucheAcces lettre={toucheDe(cmd)} />}
    </button>
  );
}

function BoutonPetit({ cmd, lancer, survol, quitter, chemin, recherche, niveau, touches, toucheDe }: PropsBoutons & { cmd: Commande }) {
  const actif = estActive(cmd, chemin, recherche);
  const iconeSeule = niveau >= 2;
  return (
    <button onClick={() => lancer(cmd)} onMouseEnter={survol(cmd)} onMouseLeave={quitter} aria-label={cmd.libelle} aria-current={actif ? 'page' : undefined}
            className={`relative h-[22px] flex items-center gap-1.5 rounded px-1.5 text-[11.5px] font-semibold whitespace-nowrap transition-colors ${actif ? '' : 'hover:bg-line-soft'}`}
            style={actif ? { background: teinte('var(--ruban-accent)', 10), color: 'var(--ruban-accent)' } : { color: 'var(--text-label)' }}>
      <Icone nom={cmd.icone} taille={15} style={{ color: COULEUR_TON[cmd.ton] }} />
      {!iconeSeule && <span>{cmd.libelle}</span>}
      {touches && <ToucheAcces lettre={toucheDe(cmd)} petit />}
    </button>
  );
}

function ToucheAcces({ lettre, petit }: { lettre: string; petit?: boolean }) {
  if (!lettre) return null;
  return (
    <span className={`absolute ${petit ? 'left-[11px] top-[9px]' : 'left-1/2 -translate-x-1/2 top-[24px]'} z-10 min-w-[16px] h-[16px] px-1 rounded-[4px] text-[10px] font-extrabold leading-[16px] text-center pointer-events-none`}
          style={{ background: 'var(--text)', color: 'var(--surface)', boxShadow: 'var(--shadow-card)' }}>
      {lettre}
    </span>
  );
}

function InfoBulle({ cmd, x, y }: { cmd: Commande; x: number; y: number }) {
  return (
    <div className="fixed z-[80] w-[270px] rounded-md bg-surface border border-line-soft p-3 pointer-events-none" role="tooltip"
         style={{ left: Math.max(8, x), top: y, boxShadow: 'var(--shadow-lifted)' }}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-[6px] inline-flex items-center justify-center flex-none" style={{ color: COULEUR_TON[cmd.ton], background: teinte(COULEUR_TON[cmd.ton], 12) }}>
          <Icone nom={cmd.icone} taille={14} />
        </span>
        <span className="text-[12.5px] font-bold text-ink">{cmd.libelle}</span>
        {cmd.raccourci && <span className="ml-auto font-mono text-[10px] text-ink-muted border border-line rounded px-1.5">{cmd.raccourci}</span>}
      </div>
      {cmd.aide && <p className="mt-1.5 text-[11.5px] leading-snug text-ink-label">{cmd.aide}</p>}
    </div>
  );
}
