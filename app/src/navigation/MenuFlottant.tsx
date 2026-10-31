import type { ReactNode } from 'react';
import type { IconName } from '../components/ui/Icon';
import { ContextMenu, type ContextMenuAnchor, type ContextMenuItem } from '../components/ui/ContextMenu';

/**
 * Menu flottant du ruban (menu contextuel, personnalisation de l'accès rapide, options d'affichage, compte).
 * Adaptateur de compatibilité vers `components/ui/ContextMenu` : mêmes props et mêmes éléments (en français)
 * qu'avant ; le rendu, le clavier et le positionnement sont ceux de la bibliothèque. Le menu reste dans l'arbre
 * DOM du ruban (`portal={false}`) : un clic dedans ne referme pas le ruban déplié temporairement.
 */

export type ElementMenu =
  | {
    libelle: ReactNode;
    icone?: IconName;
    kbd?: string;
    ton?: 'default' | 'danger';
    desactive?: boolean;
    /** Case cochée (true / false) ; absent = simple commande. */
    coche?: boolean;
    /** Avec `coche` : choix exclusif (bouton radio). */
    radio?: boolean;
    /** Le menu reste ouvert après le choix (cases à cocher multiples). */
    garderOuvert?: boolean;
    onSelect: () => void;
  }
  | 'separateur'
  | { titre: ReactNode };

/** Point (clic droit) ou rectangle d'un bouton (menu déroulant sous le bouton). */
export type Ancre = ContextMenuAnchor;

/** Élément du ruban → élément de `ContextMenu`. */
export function versContextMenu(it: ElementMenu): ContextMenuItem {
  if (it === 'separateur') return 'separator';
  if ('titre' in it) return { heading: it.titre };
  return {
    label: it.libelle, icon: it.icone, kbd: it.kbd, tone: it.ton, disabled: it.desactive,
    checked: it.coche, radio: it.radio, keepOpen: it.garderOuvert, onSelect: it.onSelect,
  };
}

export default function MenuFlottant({ ancre, elements, onClose, label, largeur = 260, aligner = 'start', declencheur }: {
  ancre: Ancre;
  elements: ElementMenu[];
  onClose: () => void;
  label: string;
  largeur?: number;
  /** Sous un bouton : aligné sur son bord gauche (start) ou droit (end). */
  aligner?: 'start' | 'end';
  /** Bouton qui ouvre le menu : un clic dessus le referme (bascule) au lieu de le rouvrir. */
  declencheur?: HTMLElement | null;
}) {
  return (
    <ContextMenu anchor={ancre} items={elements.map(versContextMenu)} onClose={onClose} label={label}
                 width={largeur} align={aligner} trigger={declencheur} portal={false} />
  );
}
