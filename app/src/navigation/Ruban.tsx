import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDroits } from '../lib/droits';
import { Icon, Kbd, TONE_VARS } from '../components/ui/Icon';
import { StatusDot } from '../components/ui/atoms';
import { cn } from '../components/ui/cn';
import {
  TEINTE_TON, commandesAccesRapide, estActive, ongletDeRoute, ongletsVisibles,
  type Action, type Commande, type ElementRuban, type Groupe, type Onglet,
} from './commandes';
import { usePreferencesNavigation } from './preferences';
import { TOUCHES_COMMANDES, ciblesTouches, estReplie, niveauMax } from './repli';
import AccesRapide, { elementsContextuels, elementsPersonnaliser } from './AccesRapide';
import MenuFlottant, { type Ancre, type ElementMenu } from './MenuFlottant';
import Backstage from './Backstage';
import { applyTheme } from '../screens/Parametres';

/**
 * Ruban de commandes façon Microsoft Office :
 * - barre de titre : barre d'outils Accès rapide personnalisable, recherche (Ctrl+K), état de l'agent, dossier, compte ;
 * - onglet « Fichier » (backstage) et onglets qui suivent l'écran ouvert (← → au clavier) ;
 * - groupes de grands et petits boutons, info-bulles détaillées, menu contextuel (clic droit : accès rapide) ;
 * - ruban réductible (Ctrl+F1, double-clic sur un onglet, options d'affichage) avec dépliage temporaire ;
 * - touches d'accès (Alt, puis la lettre de l'onglet, puis celle de la commande ; Alt puis 1…9 pour l'accès rapide) ;
 * - adaptation à la largeur : boutons compacts, icônes seules, puis groupes repliés en menus déroulants.
 */

export type InfosSession = {
  online: boolean;
  agent: string;
  dossier: string;
  utilisateur: string;
  plusieursAgents: boolean;
};

type Touches = null | 'onglets' | 'commandes' | 'groupe';
type MenuOuvert = { cle: number; label: string; ancre: Ancre; elements: () => ElementMenu[]; aligner?: 'start' | 'end'; largeur?: number; declencheur?: HTMLElement | null };
type GroupeOuvert = { titre: string; rect: DOMRect };

const ID_PANNEAU = 'ruban-panneau';
const idOnglet = (id: string) => `ruban-onglet-${id}`;
const teinte = (cmd: Commande) => TONE_VARS[TEINTE_TON[cmd.ton]];
/** Boutons atteignables d'un conteneur (navigation aux flèches). */
const boutons = (el: HTMLElement | null) => [...(el?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])];

export default function Ruban({ session, executer }: { session: InfosSession; executer: (a: Action) => void }) {
  const droits = useDroits();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const onglets = ongletsVisibles(droits);
  const { rubanReduit, definirRubanReduit, definirDisposition, accesRapide: idsAcces } = usePreferencesNavigation();
  const acces = commandesAccesRapide(idsAcces, droits);

  const [actif, setActif] = useState(() => ongletDeRoute(pathname));
  const [deplieTemporaire, setDeplieTemporaire] = useState(false);
  const [backstage, setBackstage] = useState(false);
  const [touches, setTouches] = useState<Touches>(null);
  const [bulle, setBulle] = useState<{ cmd: Commande; x: number; y: number } | null>(null);
  const [menu, setMenu] = useState<MenuOuvert | null>(null);
  const [groupeOuvert, setGroupeOuvert] = useState<GroupeOuvert | null>(null);
  const minuterie = useRef<number>();
  const depuisRuban = useRef(false);
  const racine = useRef<HTMLDivElement>(null);
  const corps = useRef<HTMLDivElement>(null);
  const chevronAcces = useRef<HTMLButtonElement>(null);
  const cleMenu = useRef(0);

  const onglet: Onglet | undefined = onglets.find((o) => o.id === actif) ?? onglets[0];
  const groupes = onglet?.groupes ?? [];
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
    setGroupeOuvert(null);
    if (cmd.action === 'disposition') { definirDisposition('lateral'); return; }
    if (cmd.action === 'replier') { definirRubanReduit(!rubanReduit); return; }
    if (cmd.action) { executer(cmd.action); return; }
    if (cmd.to) { depuisRuban.current = true; navigate(cmd.to); }
  }, [definirDisposition, definirRubanReduit, executer, navigate, rubanReduit]);

  const basculerReduit = useCallback(() => { definirRubanReduit(!rubanReduit); setDeplieTemporaire(false); }, [definirRubanReduit, rubanReduit]);

  const choisirOnglet = (id: string) => {
    setActif(id);
    setGroupeOuvert(null);
    if (rubanReduit) setDeplieTemporaire((v) => (id === actif ? !v : true));
  };

  // ─── Menus flottants (un seul à la fois) ──────────────────────────────────
  const ouvrirMenu = (m: Omit<MenuOuvert, 'cle'>) => {
    setBulle(null);
    window.clearTimeout(minuterie.current);
    cleMenu.current += 1;
    setMenu({ ...m, cle: cleMenu.current });
  };
  const basculerMenu = (bouton: HTMLElement, m: Omit<MenuOuvert, 'cle' | 'ancre' | 'declencheur'>) => {
    if (menu?.declencheur === bouton) { setMenu(null); return; }
    ouvrirMenu({ ...m, ancre: bouton.getBoundingClientRect(), declencheur: bouton });
  };
  const personnaliser = (bouton: HTMLElement | null) => {
    if (!bouton) return;
    ouvrirMenu({
      label: 'Personnaliser la barre d’outils Accès rapide', ancre: bouton.getBoundingClientRect(), declencheur: bouton, largeur: 280,
      elements: () => elementsPersonnaliser(usePreferencesNavigation.getState().accesRapide, droits),
    });
  };
  // Clic droit (ou touche Menu / Maj+F10) sur une commande
  const contextuel = (cmd: Commande) => (e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    const ancre: Ancre = e.clientX || e.clientY ? { x: e.clientX, y: e.clientY } : e.currentTarget.getBoundingClientRect();
    ouvrirMenu({
      label: `Options — ${cmd.libelle}`, ancre, largeur: 290,
      elements: () => elementsContextuels(cmd, usePreferencesNavigation.getState().accesRapide, {
        personnaliser: () => personnaliser(chevronAcces.current), rubanReduit, basculerReduit,
      }),
    });
  };

  // ─── Adaptation à la largeur ──────────────────────────────────────────────
  // 0 = complet, 1 = compact, 2 = petits boutons en icônes seules, 3+ = groupes repliés (par la droite)
  const [niveau, setNiveau] = useState(0);
  const [largeur, setLargeur] = useState(0);
  useEffect(() => {
    const el = racine.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setLargeur(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useLayoutEffect(() => { setNiveau(0); setGroupeOuvert(null); }, [largeur, actif]);
  useLayoutEffect(() => {
    const el = corps.current;
    if (el && niveau < niveauMax(groupes.length) && el.scrollWidth > el.clientWidth + 1) setNiveau((n) => n + 1);
  }, [niveau, largeur, actif, corpsVisible, groupes.length]);

  // Touches d'accès de l'onglet actif : une par commande, une seule par groupe replié
  const cibles = ciblesTouches(groupes, niveau);
  const toucheDe = (cmd: Commande) => cibles.find((c) => c.type === 'cmd' && c.cmd.id === cmd.id)?.touche ?? '';
  const toucheGroupe = (g: Groupe) => cibles.find((c) => c.type === 'groupe' && c.groupe.titre === g.titre)?.touche ?? '';
  const groupeAffiche = groupeOuvert ? groupes.find((g) => g.titre === groupeOuvert.titre) : undefined;

  const ouvrirGroupe = (g: Groupe, bouton: HTMLElement | null) => {
    if (!bouton) return;
    setBulle(null);
    setGroupeOuvert({ titre: g.titre, rect: bouton.getBoundingClientRect() });
  };
  const fermerGroupe = (rendreFocus: boolean) => {
    const titre = groupeOuvert?.titre;
    setGroupeOuvert(null);
    setTouches((t) => (t === 'groupe' ? 'commandes' : t));
    if (rendreFocus && titre) boutonGroupe(titre)?.focus();
  };
  const boutonGroupe = (titre: string) =>
    [...(corps.current?.querySelectorAll<HTMLElement>('[data-groupe]') ?? [])].find((b) => b.dataset.groupe === titre) ?? null;

  // Clavier : Ctrl+F1 (réduire), Alt (touches d'accès), Échap
  useEffect(() => {
    let altSeul = false;
    function bas(e: KeyboardEvent) {
      if (e.key === 'Alt') { altSeul = true; return; }
      altSeul = false;
      if (e.ctrlKey && e.key === 'F1') { e.preventDefault(); definirRubanReduit(!rubanReduit); return; }
      if (!touches) return;
      // panneau d'un groupe replié ouvert : Entrée, Espace, flèches et Tab gardent leur rôle dans le panneau
      if (touches === 'groupe' && /^(Enter| |Tab|Home|End|Arrow.*)$/.test(e.key)) return;
      const k = e.key.toUpperCase();
      e.preventDefault();
      if (e.key === 'Escape') {
        if (touches === 'groupe') { fermerGroupe(false); return; }
        setTouches(touches === 'commandes' ? 'onglets' : null);
        if (touches === 'onglets') setDeplieTemporaire(false);
        return;
      }
      if (touches === 'onglets') {
        if (k === 'F') { setTouches(null); setBackstage(true); return; }
        if (/^[1-9]$/.test(k)) { const c = acces[Number(k) - 1]; if (c) lancer(c); return; }
        const o = onglets.find((x) => x.touche === k);
        if (o) { setActif(o.id); setTouches('commandes'); if (rubanReduit) setDeplieTemporaire(true); }
        return;
      }
      if (touches === 'groupe') {
        const i = TOUCHES_COMMANDES.indexOf(k);
        const el = groupeAffiche?.elements[i];
        if (i >= 0 && el) lancer(el.cmd);
        return;
      }
      const cible = cibles.find((x) => x.touche === k);
      if (cible?.type === 'cmd') lancer(cible.cmd);
      else if (cible?.type === 'groupe') { ouvrirGroupe(cible.groupe, boutonGroupe(cible.groupe.titre)); setTouches('groupe'); }
    }
    function haut(e: KeyboardEvent) {
      if (e.key === 'Alt' && altSeul) { e.preventDefault(); setTouches((t) => (t ? null : 'onglets')); setGroupeOuvert(null); }
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
    if (menu) return;
    const r = e.currentTarget.getBoundingClientRect();
    window.clearTimeout(minuterie.current);
    minuterie.current = window.setTimeout(() => setBulle({ cmd, x: Math.min(r.left, window.innerWidth - 300), y: r.bottom + 6 }), 550);
  };
  const quitter = () => { window.clearTimeout(minuterie.current); setBulle(null); };
  useEffect(() => () => window.clearTimeout(minuterie.current), []);

  // Onglets : ← → Début Fin (l'onglet suit le focus), ↓ entre dans le ruban
  function clavierOnglets(e: React.KeyboardEvent) {
    const i = onglets.findIndex((o) => o.id === onglet?.id);
    let cible: Onglet | undefined;
    if (e.key === 'ArrowRight') cible = onglets[(i + 1) % onglets.length];
    else if (e.key === 'ArrowLeft') cible = onglets[(i - 1 + onglets.length) % onglets.length];
    else if (e.key === 'Home') cible = onglets[0];
    else if (e.key === 'End') cible = onglets[onglets.length - 1];
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!corpsVisible) setDeplieTemporaire(true);
      requestAnimationFrame(() => boutons(corps.current)[0]?.focus());
      return;
    } else return;
    e.preventDefault();
    setActif(cible.id);
    setGroupeOuvert(null);
    document.getElementById(idOnglet(cible.id))?.focus();
  }

  // Corps du ruban : ← → ↑ ↓ d'une commande à l'autre, Échap revient à l'onglet
  function clavierCorps(e: React.KeyboardEvent) {
    const els = boutons(corps.current);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (i < 0) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Escape' && !touches) { e.preventDefault(); document.getElementById(idOnglet(onglet?.id ?? ''))?.focus(); }
  }

  const options = (bouton: HTMLElement) => basculerMenu(bouton, {
    label: 'Options d’affichage du ruban', aligner: 'end', largeur: 340,
    elements: () => {
      const reduit = usePreferencesNavigation.getState().rubanReduit;
      return [
        { titre: 'Options d’affichage du ruban' },
        { libelle: 'Afficher les onglets et les commandes', coche: !reduit, radio: true, onSelect: () => { definirRubanReduit(false); setDeplieTemporaire(false); } },
        { libelle: 'Afficher les onglets uniquement', coche: reduit, radio: true, kbd: 'Ctrl+F1', onSelect: () => { definirRubanReduit(true); setDeplieTemporaire(false); } },
        'separateur',
        { libelle: 'Basculer vers le menu latéral', icone: 'layoutSidebar', onSelect: () => definirDisposition('lateral') },
      ];
    },
  });

  const props: PropsBoutons = {
    lancer, survol, quitter, contextuel, chemin: pathname, recherche: search, niveau, touches: touches === 'commandes', toucheDe,
  };

  return (
    <div ref={racine} className="relative flex-none select-none z-ribbon" onDoubleClick={(e) => e.preventDefault()}>
      <BarreTitre session={session} executer={executer} ouvrirFichier={() => setBackstage(true)}
                  basculerMenu={basculerMenu} menuOuvert={menu?.declencheur ?? null}
                  qat={(
                    <AccesRapide commandes={acces} lancer={lancer} survol={survol} quitter={quitter} contextuel={contextuel}
                                 touches={touches === 'onglets'} refChevron={chevronAcces}
                                 menuOuvert={!!menu && !!chevronAcces.current && menu.declencheur === chevronAcces.current}
                                 personnaliser={() => (menu && menu.declencheur === chevronAcces.current ? setMenu(null) : personnaliser(chevronAcces.current))} />
                  )} />

      {/* Ligne des onglets */}
      <div className="h-[34px] flex items-end gap-0.5 px-2 bg-surface">
        <button type="button" onClick={() => setBackstage(true)} aria-haspopup="dialog" aria-keyshortcuts="Alt F"
                title="Fichier — dossier, compte, récents, affichage"
                className="relative h-7 px-4 mb-[3px] rounded-sm text-sm font-bold text-ink-inverse bg-brand-700 hover:bg-brand-900 transition-colors duration-fast">
          Fichier
          {touches === 'onglets' && <ToucheAcces lettre="F" />}
        </button>
        <div role="tablist" aria-label="Onglets du ruban" className="flex items-end gap-0.5 min-w-0" onKeyDown={clavierOnglets}>
          {onglets.map((o) => {
            const sel = o.id === onglet?.id;
            const marque = sel && corpsVisible;
            return (
              <button key={o.id} id={idOnglet(o.id)} type="button" role="tab" aria-selected={sel} tabIndex={sel ? 0 : -1}
                      aria-controls={corpsVisible ? ID_PANNEAU : undefined} aria-keyshortcuts={`Alt ${o.touche}`}
                      onClick={() => choisirOnglet(o.id)} onDoubleClick={basculerReduit}
                      className={cn('relative h-[31px] px-3.5 rounded-t-sm text-sm font-semibold transition-colors duration-fast whitespace-nowrap',
                        marque ? 'text-[color:var(--ruban-accent)]' : 'text-ink-label hover:text-ink hover:bg-hover')}>
                {o.libelle}
                {marque && <span className="absolute left-2.5 right-2.5 bottom-0 h-[3px] rounded-full bg-[color:var(--ruban-accent)]" aria-hidden="true" />}
                {touches === 'onglets' && <ToucheAcces lettre={o.touche} />}
              </button>
            );
          })}
        </div>
        <div className="ml-auto mb-1 flex items-center gap-0.5 text-ink-muted flex-none">
          <button type="button" onClick={(e) => options(e.currentTarget)} aria-haspopup="menu"
                  aria-expanded={!!menu && menu.label === 'Options d’affichage du ruban'}
                  aria-label="Options d’affichage du ruban" title="Options d’affichage du ruban"
                  className="h-7 px-1.5 rounded-sm inline-flex items-center gap-0.5 hover:bg-hover hover:text-ink transition-colors duration-fast">
            <Icon name="layoutRibbon" size={16} /><Icon name="chevronDown" size={12} />
          </button>
          <button type="button" onClick={basculerReduit}
                  className="h-7 w-7 rounded-sm inline-flex items-center justify-center hover:bg-hover hover:text-ink transition-colors duration-fast"
                  title={rubanReduit ? 'Épingler le ruban (Ctrl+F1)' : 'Réduire le ruban (Ctrl+F1)'} aria-keyshortcuts="Control+F1"
                  aria-label={rubanReduit ? 'Épingler le ruban' : 'Réduire le ruban'}>
            <Icon name={rubanReduit ? 'pin' : 'chevronUp'} size={16} />
          </button>
        </div>
      </div>

      {/* Corps du ruban : en flux quand épinglé, en surimpression quand déplié temporairement */}
      {onglet && corpsVisible && (
        <div id={ID_PANNEAU} role="tabpanel" aria-labelledby={idOnglet(onglet.id)}
             className={cn('bg-surface border-y border-line-soft', rubanReduit ? 'absolute left-0 right-0 top-full shadow-lifted' : 'shadow-soft')}>
          <div ref={corps} className="flex items-stretch h-[100px] px-1.5 overflow-hidden" role="toolbar"
               aria-label={`Ruban — ${onglet.libelle}`} onKeyDown={clavierCorps}>
            {groupes.map((g, gi) => (
              <Fragment key={g.titre}>
                {gi > 0 && <div className="w-px my-2.5 flex-none bg-line-soft" aria-hidden="true" />}
                {estReplie(gi, niveau, groupes.length) ? (
                  <div className="flex flex-none px-1 py-1.5">
                    <BoutonGroupe groupe={g} ouvert={groupeOuvert?.titre === g.titre} chemin={pathname} recherche={search}
                                  touche={touches === 'commandes' ? toucheGroupe(g) : ''}
                                  onClick={(b) => (groupeOuvert?.titre === g.titre ? fermerGroupe(false) : ouvrirGroupe(g, b))} />
                  </div>
                ) : (
                  <div role="group" aria-label={g.titre} className="flex flex-col flex-none px-1">
                    <div className="flex items-start gap-0.5 flex-1 pt-1.5">{colonnes(g.elements, props)}</div>
                    <div className="text-xs text-ink-muted text-center pb-1 leading-none whitespace-nowrap" aria-hidden="true">{g.titre}</div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </div>
      )}
      {!corpsVisible && <div className="border-b border-line-soft" />}

      {groupeAffiche && groupeOuvert && corpsVisible && (
        <PanneauGroupe groupe={groupeAffiche} rect={groupeOuvert.rect} declencheur={boutonGroupe(groupeAffiche.titre)}
                       onClose={fermerGroupe}
                       props={{ ...props, niveau: 0, touches: touches === 'groupe', toucheDe: (c) => TOUCHES_COMMANDES[groupeAffiche.elements.findIndex((e) => e.cmd.id === c.id)] ?? '' }} />
      )}
      {bulle && <InfoBulle {...bulle} />}
      {menu && (
        <MenuFlottant key={menu.cle} label={menu.label} ancre={menu.ancre} elements={menu.elements()} aligner={menu.aligner}
                      largeur={menu.largeur} declencheur={menu.declencheur} onClose={() => setMenu(null)} />
      )}
      {backstage && (
        <Backstage session={session} onClose={() => setBackstage(false)}
                   lancer={(cmd) => { setBackstage(false); lancer(cmd); }} />
      )}
    </div>
  );
}

// ─── Barre de titre ─────────────────────────────────────────────────────────

function BarreTitre({ session, executer, ouvrirFichier, basculerMenu, menuOuvert, qat }: {
  session: InfosSession;
  executer: (a: Action) => void;
  ouvrirFichier: () => void;
  basculerMenu: (bouton: HTMLElement, m: { label: string; elements: () => ElementMenu[]; aligner?: 'start' | 'end'; largeur?: number }) => void;
  menuOuvert: HTMLElement | null;
  qat: ReactNode;
}) {
  const definirDisposition = usePreferencesNavigation((s) => s.definirDisposition);
  const compte = useRef<HTMLButtonElement>(null);
  const initiales = (session.utilisateur || '?').split(/[\s._-]+/).filter(Boolean).map((x) => x[0]).join('').slice(0, 2).toUpperCase() || '?';
  const etat = session.online ? 'Agent connecté' : 'Agent hors ligne';

  const menuCompte = (bouton: HTMLElement) => basculerMenu(bouton, {
    label: 'Compte', aligner: 'end', largeur: 290,
    elements: () => [
      { titre: `${session.utilisateur || 'Utilisateur'} · ${session.dossier}` },
      { libelle: 'Changer de dossier', icone: 'folder', onSelect: () => executer('dossier') },
      ...(session.plusieursAgents ? [{ libelle: 'Changer d’agent', icone: 'server' as const, onSelect: () => executer('agent') }] : []),
      { libelle: 'Compte et options', icone: 'settings', kbd: 'Alt F', onSelect: ouvrirFichier },
      { libelle: 'Basculer vers le menu latéral', icone: 'layoutSidebar', onSelect: () => definirDisposition('lateral') },
      document.documentElement.dataset.theme === 'dark'
        ? { libelle: 'Passer en mode clair', icone: 'sun', onSelect: () => applyTheme('light') }
        : { libelle: 'Passer en mode sombre', icone: 'moon', onSelect: () => applyTheme('dark') },
      'separateur',
      { libelle: 'Se déconnecter', icone: 'logout', ton: 'danger', onSelect: () => executer('deconnexion') },
    ],
  });

  return (
    <div className="h-10 flex items-center gap-3 px-3 text-ink-inverse overflow-hidden" style={{ background: 'var(--gradient-hero)' }}>
      <div className="flex items-center gap-2 flex-none">
        <div className="w-6 h-6 rounded-sm text-xs font-extrabold flex items-center justify-center bg-white/20" aria-hidden="true">GC</div>
        <span className="hidden md:inline text-sm font-bold tracking-tight">Gestion Commerciale</span>
      </div>
      {qat}
      <button type="button" onClick={() => executer('palette')} aria-keyshortcuts="Control+K"
              className="mx-auto flex-1 min-w-[150px] max-w-[440px] h-7 flex items-center gap-2 rounded-sm px-3 text-sm text-left bg-white/15 border border-white/25 hover:bg-white/25 transition-colors duration-fast">
        <Icon name="search" size={14} />
        <span className="opacity-90 truncate">Rechercher un client, un article, une pièce…</span>
        <span className="ml-auto flex items-center gap-0.5 flex-none"><Kbd tone="inverse">Ctrl</Kbd><Kbd tone="inverse">K</Kbd></span>
      </button>
      <div className="flex items-center gap-1.5 flex-none text-xs font-semibold">
        <span className="inline-flex items-center rounded-full px-2.5 h-6 bg-white/15" title={`${etat} — ${session.agent}`}>
          <StatusDot online={session.online} label={<span className="sr-only xl:not-sr-only">{session.online ? 'Connecté' : 'Hors ligne'}</span>} />
        </span>
        <button type="button" onClick={() => executer('dossier')} title="Changer de dossier"
                className="inline-flex items-center gap-1.5 rounded-sm px-2 h-7 hover:bg-white/15 transition-colors duration-fast">
          <Icon name="folder" size={14} /> <span className="max-w-[90px] xl:max-w-[180px] truncate">{session.dossier}</span>
        </button>
        <button ref={compte} type="button" onClick={(e) => menuCompte(e.currentTarget)}
                aria-haspopup="menu" aria-expanded={!!menuOuvert && menuOuvert === compte.current}
                aria-label={`Compte — ${session.utilisateur}`} title={`${session.utilisateur} — compte et options`}
                className="w-[26px] h-[26px] rounded-full text-xs font-extrabold inline-flex items-center justify-center bg-ink-inverse text-brand-700 hover:ring-2 hover:ring-white/40">
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
  contextuel: (c: Commande) => (e: React.MouseEvent<HTMLElement>) => void;
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

function BoutonGrand({ cmd, lancer, survol, quitter, contextuel, chemin, recherche, niveau, touches, toucheDe }: PropsBoutons & { cmd: Commande }) {
  const actif = estActive(cmd, chemin, recherche);
  const t = teinte(cmd);
  const compact = niveau >= 1;
  return (
    <button type="button" onClick={() => lancer(cmd)} onMouseEnter={survol(cmd)} onMouseLeave={quitter} onContextMenu={contextuel(cmd)}
            aria-current={actif ? 'page' : undefined} aria-keyshortcuts={cmd.raccourci?.replace('Ctrl', 'Control')}
            className={cn('relative flex flex-col items-center gap-1 rounded-md px-1.5 pt-1.5 pb-1 h-[76px] transition-colors duration-fast',
              compact ? 'w-[62px]' : 'min-w-[64px] max-w-[88px]',
              actif ? 'bg-brand-soft ring-1 ring-inset ring-brand-line' : 'hover:bg-hover')}>
      <span className="w-8 h-8 rounded-sm inline-flex items-center justify-center flex-none" style={{ color: t.text, background: t.soft }}>
        <Icon name={cmd.icone} size={compact ? 18 : 20} />
      </span>
      <span className={cn('text-center text-xs font-semibold leading-[13px] line-clamp-2', actif ? 'text-brand-text' : 'text-ink-label')}>
        {cmd.court ?? cmd.libelle}
      </span>
      {touches && <ToucheAcces lettre={toucheDe(cmd)} />}
    </button>
  );
}

function BoutonPetit({ cmd, lancer, survol, quitter, contextuel, chemin, recherche, niveau, touches, toucheDe }: PropsBoutons & { cmd: Commande }) {
  const actif = estActive(cmd, chemin, recherche);
  const iconeSeule = niveau >= 2;
  return (
    <button type="button" onClick={() => lancer(cmd)} onMouseEnter={survol(cmd)} onMouseLeave={quitter} onContextMenu={contextuel(cmd)}
            aria-label={cmd.libelle} aria-current={actif ? 'page' : undefined}
            className={cn('relative h-6 flex items-center gap-1.5 rounded-sm px-1.5 text-xs font-semibold whitespace-nowrap transition-colors duration-fast',
              actif ? 'bg-brand-soft text-brand-text' : 'text-ink-label hover:bg-hover hover:text-ink')}>
      <Icon name={cmd.icone} size={15} style={{ color: actif ? undefined : teinte(cmd).text }} />
      {!iconeSeule && <span>{cmd.libelle}</span>}
      {touches && <ToucheAcces lettre={toucheDe(cmd)} petit />}
    </button>
  );
}

/** Groupe replié (largeur insuffisante) : un seul grand bouton qui déroule les commandes du groupe. */
function BoutonGroupe({ groupe, ouvert, chemin, recherche, touche, onClick }: {
  groupe: Groupe; ouvert: boolean; chemin: string; recherche: string; touche: string; onClick: (b: HTMLElement) => void;
}) {
  const premier = groupe.elements[0].cmd;
  const t = teinte(premier);
  const actif = groupe.elements.some((e) => estActive(e.cmd, chemin, recherche));
  return (
    <button type="button" data-groupe={groupe.titre} onClick={(e) => onClick(e.currentTarget)}
            aria-haspopup="true" aria-expanded={ouvert} aria-label={`${groupe.titre} (${groupe.elements.length} commandes)`}
            className={cn('relative flex flex-col items-center gap-1 rounded-md px-1.5 pt-1.5 pb-1 h-full min-w-[64px] max-w-[92px] transition-colors duration-fast',
              ouvert ? 'bg-active ring-1 ring-inset ring-line' : actif ? 'bg-brand-soft ring-1 ring-inset ring-brand-line' : 'hover:bg-hover')}>
      <span className="w-8 h-8 rounded-sm inline-flex items-center justify-center flex-none" style={{ color: t.text, background: t.soft }}>
        <Icon name={premier.icone} size={20} />
      </span>
      <span className={cn('text-center text-xs font-semibold leading-[13px] line-clamp-2', actif ? 'text-brand-text' : 'text-ink-label')}>{groupe.titre}</span>
      <Icon name="chevronDown" size={12} className="text-ink-muted mt-auto" />
      {touche && <ToucheAcces lettre={touche} />}
    </button>
  );
}

/** Panneau déroulant d'un groupe replié : mêmes boutons que dans le ruban, ← → ↑ ↓, Entrée, Échap. */
function PanneauGroupe({ groupe, rect, declencheur, onClose, props }: {
  groupe: Groupe; rect: DOMRect; declencheur: HTMLElement | null; onClose: (rendreFocus: boolean) => void; props: PropsBoutons;
}) {
  const panneau = useRef<HTMLDivElement>(null);
  const [left, setLeft] = useState(rect.left);

  useLayoutEffect(() => {
    const l = panneau.current?.offsetWidth ?? 0;
    setLeft(Math.max(8, Math.min(rect.left, window.innerWidth - l - 8)));
  }, [rect]);

  useEffect(() => {
    boutons(panneau.current)[0]?.focus();
    const dehors = (e: MouseEvent) => {
      const c = e.target as Node;
      if (!panneau.current?.contains(c) && !declencheur?.contains(c)) onClose(false);
    };
    window.addEventListener('mousedown', dehors, true);
    return () => window.removeEventListener('mousedown', dehors, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onKey(e: React.KeyboardEvent) {
    const els = boutons(panneau.current);
    const i = els.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(true); }
    else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); els[(i + 1) % els.length]?.focus(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); els[(i - 1 + els.length) % els.length]?.focus(); }
    else if (e.key === 'Home') { e.preventDefault(); els[0]?.focus(); }
    else if (e.key === 'End') { e.preventDefault(); els[els.length - 1]?.focus(); }
    else if (e.key === 'Tab') { e.preventDefault(); onClose(true); }
  }

  return (
    <div ref={panneau} role="group" aria-label={groupe.titre} onKeyDown={onKey}
         className="fixed z-popover bg-raised border border-line-soft rounded-md shadow-lifted px-1.5 pt-1.5 animate-pop-in flex flex-col"
         style={{ left, top: rect.bottom + 4 }}>
      <div className="flex items-start gap-0.5">{colonnes(groupe.elements, props)}</div>
      <div className="text-xs text-ink-muted text-center py-1 leading-none whitespace-nowrap border-t border-line-soft mt-1.5" aria-hidden="true">{groupe.titre}</div>
    </div>
  );
}

function ToucheAcces({ lettre, petit }: { lettre: string; petit?: boolean }) {
  if (!lettre) return null;
  return (
    <span className={cn('absolute z-10 min-w-4 h-4 px-1 rounded-xs bg-ink text-surface text-2xs font-extrabold leading-4 text-center shadow-card pointer-events-none',
      petit ? 'left-[11px] top-[10px]' : 'left-1/2 -translate-x-1/2 top-[28px]')} aria-hidden="true">
      {lettre}
    </span>
  );
}

function InfoBulle({ cmd, x, y }: { cmd: Commande; x: number; y: number }) {
  const t = teinte(cmd);
  return (
    <div role="tooltip" className="fixed z-tooltip w-[280px] rounded-md bg-raised border border-line-soft shadow-lifted p-3 pointer-events-none animate-fade-in"
         style={{ left: Math.max(8, x), top: y }}>
      <div className="flex items-center gap-2">
        <span className="w-6 h-6 rounded-xs inline-flex items-center justify-center flex-none" style={{ color: t.text, background: t.soft }}>
          <Icon name={cmd.icone} size={14} />
        </span>
        <span className="text-sm font-bold text-ink truncate">{cmd.libelle}</span>
        {cmd.raccourci && (
          <span className="ml-auto flex items-center gap-0.5 flex-none">
            {cmd.raccourci.split('+').map((k) => <Kbd key={k}>{k}</Kbd>)}
          </span>
        )}
      </div>
      {cmd.aide && <p className="mt-1.5 text-xs text-ink-label">{cmd.aide}</p>}
    </div>
  );
}
