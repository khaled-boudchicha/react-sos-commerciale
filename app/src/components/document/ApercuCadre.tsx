import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { IconButton } from '../ui/Button';
import { Icon, Kbd } from '../ui/Icon';
import { EmptyState } from '../ui/States';

/**
 * Coquille commune des panneaux d'aperçu rapide (pièces, tiers, articles) : en-tête fixe,
 * corps qui défile (remis en haut à chaque changement de `cle`), Échap ferme le panneau.
 */
export default function ApercuCadre({ entete, children, onFermer, cle }: {
  entete: ReactNode;
  children: ReactNode;
  onFermer: () => void;
  /** Identifiant de l'élément affiché : quand il change, le corps revient en haut. */
  cle?: unknown;
}) {
  const corps = useRef<HTMLDivElement>(null);
  useEffect(() => { corps.current?.scrollTo?.({ top: 0 }); }, [cle]);

  const surTouche = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Escape' || e.defaultPrevented) return;
    e.preventDefault();
    e.stopPropagation();
    onFermer();
  };

  return (
    <div onKeyDown={surTouche} className="flex-1 flex flex-col min-h-0">
      <div className="flex-none border-b border-line-soft px-4 py-3">{entete}</div>
      <div ref={corps} className="flex-1 min-h-0 overflow-auto px-4 py-3.5 flex flex-col gap-4 [&>*]:shrink-0">{children}</div>
    </div>
  );
}

/** Bouton « Fermer l'aperçu (Échap) ». */
export function BoutonFermerApercu({ onFermer }: { onFermer: () => void }) {
  return <IconButton icon="close" label="Fermer l'aperçu (Échap)" size="sm" onClick={onFermer} />;
}

/** En-tête minimal (invite, erreur, accès refusé) : icône, titre, fermer. */
export function ApercuEnteteSimple({ titre, onFermer }: { titre: ReactNode; onFermer: () => void }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name="layoutSidebar" size={16} className="text-ink-muted" />
      <span className="flex-1 min-w-0 font-bold text-base text-ink">{titre}</span>
      <BoutonFermerApercu onFermer={onFermer} />
    </div>
  );
}

/** Invite affichée tant qu'aucune ligne n'est sélectionnée. */
export function ApercuInvite({ titre, ouvrir }: {
  /** Ex. « Sélectionnez une pièce ». */
  titre: string;
  /** Ce qu'ouvre le double-clic, ex. « la pièce », « la fiche ». */
  ouvrir: string;
}) {
  return (
    <EmptyState icon="eye" size="sm" title={titre}
                description={(
                  <>
                    Cliquez sur une ligne ou parcourez la liste avec les flèches du clavier.
                    <span className="block mt-1.5">Double-clic ou <Kbd>Entrée</Kbd> pour ouvrir {ouvrir}.</span>
                  </>
                )} />
  );
}
