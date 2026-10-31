import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Button } from '../ui/Button';
import { cn } from '../ui/cn';
import { LARGEUR_APERCU, type Apercu } from './useApercu';

/** En dessous de cette largeur utile, le panneau passe en superposition au lieu de réduire la grille. */
const SEUIL_SUPERPOSITION = 1280;
/** Écart entre le panneau collant et les bords haut / bas de la zone qui défile. */
const MARGE = 12;

/** Bouton bascule « Aperçu » (barre d'outils de la grille). */
export function BoutonApercu({ apercu }: { apercu: Pick<Apercu<unknown>, 'actif' | 'basculer'> }) {
  return (
    <Button size="sm" icon="layoutSidebar" pressed={apercu.actif} onClick={() => apercu.basculer()}
            title={apercu.actif
              ? "Masquer l'aperçu (le clic sur une ligne ouvrira de nouveau la pièce)"
              : "Afficher un aperçu de la pièce à côté de la liste (clic : aperçu, double-clic ou Entrée : ouvrir)"}>
      Aperçu
    </Button>
  );
}

/**
 * Grille + panneau d'aperçu. Large écran : côte à côte (le panneau est collant et défile avec la page) ;
 * sous ~1280 px de largeur utile : le panneau se superpose à droite de la grille (ombre), seulement quand
 * une pièce est sélectionnée. Sans aperçu actif, rend la grille telle quelle.
 *
 * `panneau(fermer)` : `fermer` masque la superposition (désélection) ou, côte à côte, désactive l'aperçu,
 * puis rend le focus à la grille.
 */
export default function ApercuDisposition<T>({ apercu, children, panneau, libelle = 'Aperçu de la pièce' }: {
  apercu: Apercu<T>;
  children: ReactNode;
  panneau: (fermer: () => void) => ReactNode;
  libelle?: string;
}) {
  const racine = useRef<HTMLDivElement>(null);
  const zoneGrille = useRef<HTMLDivElement>(null);
  const [largeurUtile, setLargeurUtile] = useState<number | null>(null);
  const [hauteurMax, setHauteurMax] = useState<number | null>(null);

  // Largeur utile (contenu) et hauteur visible de la zone qui défile (main#contenu)
  useLayoutEffect(() => {
    const el = racine.current;
    if (!el || !apercu.actif) return;
    const defilement = el.closest('main') as HTMLElement | null;
    const mesurer = () => {
      setLargeurUtile(el.clientWidth);
      setHauteurMax(Math.max(240, (defilement?.clientHeight ?? window.innerHeight) - MARGE * 2));
    };
    mesurer();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(mesurer) : null;
    ro?.observe(el);
    if (defilement) ro?.observe(defilement);
    window.addEventListener('resize', mesurer);
    return () => { ro?.disconnect(); window.removeEventListener('resize', mesurer); };
  }, [apercu.actif]);

  const superposition = largeurUtile !== null && largeurUtile < SEUIL_SUPERPOSITION;

  const rendreFocus = () => requestAnimationFrame(() => {
    zoneGrille.current?.querySelector<HTMLElement>('div.overflow-auto[tabindex="0"]')?.focus();
  });
  const fermer = useCallback(() => {
    if (superposition) apercu.deselectionner();
    else apercu.basculer(false);
    rendreFocus();
  }, [superposition, apercu]);

  // Redimensionnement par la poignée gauche (souris) ou au clavier (← →)
  const glisser = useRef<{ x: number; l: number } | null>(null);
  const limiteMax = Math.min(LARGEUR_APERCU.max, Math.max(LARGEUR_APERCU.min, Math.floor((largeurUtile ?? 1600) * 0.6)));
  const redimensionner = (px: number) => apercu.changerLargeur(Math.min(limiteMax, px));
  const debutGlisser = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    glisser.current = { x: e.clientX, l: apercu.largeur };
  };
  const pendantGlisser = (e: PointerEvent<HTMLDivElement>) => {
    if (glisser.current) redimensionner(glisser.current.l + (glisser.current.x - e.clientX));
  };
  const finGlisser = () => { glisser.current = null; };
  const clavierPoignee = (e: KeyboardEvent<HTMLDivElement>) => {
    const pas = e.shiftKey ? 64 : 16;
    if (e.key === 'ArrowLeft') redimensionner(apercu.largeur + pas);
    else if (e.key === 'ArrowRight') redimensionner(apercu.largeur - pas);
    else if (e.key === 'Home') redimensionner(LARGEUR_APERCU.defaut);
    else return;
    e.preventDefault();
  };

  // Structure identique avec ou sans aperçu : basculer ne remonte pas la grille (page, ligne active conservées)
  const visible = apercu.actif && (!superposition || apercu.selection !== null);
  const largeur = Math.min(apercu.largeur, limiteMax);

  return (
    <div ref={racine} className={cn('relative flex items-stretch min-w-0', visible && !superposition && 'gap-3')}>
      <div ref={zoneGrille} className="flex-1 min-w-0 flex flex-col">{children}</div>
      {visible && largeurUtile !== null && (
        <div className={cn('flex-none', superposition && 'absolute top-0 bottom-0 right-0 z-sticky pointer-events-none')}
             style={{ width: largeur }}>
          <aside aria-label={libelle}
                 className={cn(
                   'sticky pointer-events-auto flex flex-col min-h-0 bg-surface border-l border-line animate-slide-in',
                   superposition ? 'shadow-lifted rounded-l-md border-y border-line-soft' : 'rounded-md border border-line-soft shadow-soft',
                 )}
                 style={{ top: MARGE, maxHeight: hauteurMax ?? undefined }}>
            <div role="separator" aria-orientation="vertical" aria-label="Largeur de l'aperçu"
                 aria-valuemin={LARGEUR_APERCU.min} aria-valuemax={limiteMax} aria-valuenow={largeur} tabIndex={0}
                 title="Glisser pour redimensionner (← → au clavier)"
                 onPointerDown={debutGlisser} onPointerMove={pendantGlisser} onPointerUp={finGlisser} onPointerCancel={finGlisser}
                 onKeyDown={clavierPoignee} onDoubleClick={() => redimensionner(LARGEUR_APERCU.defaut)}
                 className="absolute -left-1 top-0 bottom-0 w-2 z-[1] cursor-col-resize outline-none rounded-xs hover:bg-brand-soft focus-visible:bg-brand-soft" />
            {panneau(fermer)}
          </aside>
        </div>
      )}
    </div>
  );
}
