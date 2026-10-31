import type { Ref } from 'react';
import { Icon } from '../components/ui/Icon';
import { cn } from '../components/ui/cn';
import { ACCES_RAPIDE_PROPOSES, COMMANDES_PAR_ID, type Commande, type Droits } from './commandes';
import type { ElementMenu } from './MenuFlottant';
import { usePreferencesNavigation } from './preferences';

/**
 * Barre d'outils Accès rapide (QAT d'Office), dans la barre de titre du ruban : commandes choisies par
 * l'utilisateur (clic droit sur un bouton du ruban → Ajouter / Retirer), menu « Personnaliser » au bout de la
 * barre. Touches d'accès : Alt puis 1, 2, 3…
 */
export default function AccesRapide({ commandes, lancer, survol, quitter, contextuel, personnaliser, refChevron, menuOuvert, touches }: {
  /** Commandes visibles (identifiants connus et autorisés), dans l'ordre choisi. */
  commandes: Commande[];
  lancer: (c: Commande) => void;
  survol: (c: Commande) => (e: React.MouseEvent<HTMLElement>) => void;
  quitter: () => void;
  contextuel: (c: Commande) => (e: React.MouseEvent<HTMLElement>) => void;
  /** Ouvre (ou referme) le menu « Personnaliser » sous le bouton chevron. */
  personnaliser: () => void;
  refChevron: Ref<HTMLButtonElement>;
  menuOuvert: boolean;
  touches: boolean;
}) {
  return (
    <div role="toolbar" aria-label="Barre d’outils Accès rapide"
         className="flex items-center gap-0.5 pl-2 ml-1 border-l border-white/25 flex-none">
      {commandes.map((c, i) => (
        <button key={c.id} type="button" onClick={() => lancer(c)} onMouseEnter={survol(c)} onMouseLeave={quitter}
                onContextMenu={contextuel(c)} aria-label={c.libelle} aria-keyshortcuts={i < 9 ? `Alt ${i + 1}` : undefined}
                className="relative h-7 w-7 rounded-sm inline-flex items-center justify-center text-ink-inverse opacity-90 hover:opacity-100 hover:bg-white/15 transition-colors duration-fast">
          <Icon name={c.icone} size={16} />
          {touches && i < 9 && <ToucheQat lettre={String(i + 1)} />}
        </button>
      ))}
      <button ref={refChevron} type="button" aria-label="Personnaliser la barre d’outils Accès rapide" title="Personnaliser la barre d’outils Accès rapide"
              aria-haspopup="menu" aria-expanded={menuOuvert} onClick={personnaliser}
              className={cn('h-7 w-5 rounded-sm inline-flex items-center justify-center text-ink-inverse opacity-80 hover:opacity-100 hover:bg-white/15 transition-colors duration-fast',
                menuOuvert && 'bg-white/20 opacity-100')}>
        <Icon name="chevronDown" size={14} />
      </button>
    </div>
  );
}

function ToucheQat({ lettre }: { lettre: string }) {
  return (
    <span className="absolute left-1/2 -translate-x-1/2 top-[18px] z-10 min-w-4 h-4 px-1 rounded-xs bg-ink text-surface text-2xs font-extrabold leading-4 text-center shadow-card pointer-events-none">
      {lettre}
    </span>
  );
}

/** Éléments du menu « Personnaliser la barre d'outils Accès rapide » (cases à cocher + Rétablir par défaut). */
export function elementsPersonnaliser(ids: readonly string[], droits: Droits): ElementMenu[] {
  const { basculerAccesRapide, retablirAccesRapide } = usePreferencesNavigation.getState();
  // commandes courantes, puis celles ajoutées depuis le ruban (pour pouvoir les décocher)
  const liste = [...new Set([...ACCES_RAPIDE_PROPOSES, ...ids])]
    .map((id) => COMMANDES_PAR_ID[id])
    .filter((c): c is Commande => !!c && (!c.si || c.si(droits)));
  return [
    { titre: 'Personnaliser la barre d’accès rapide' },
    ...liste.map((c): ElementMenu => ({
      libelle: c.libelle, coche: ids.includes(c.id), garderOuvert: true, onSelect: () => basculerAccesRapide(c.id),
    })),
    'separateur',
    { libelle: 'Rétablir par défaut', icone: 'refresh', onSelect: retablirAccesRapide },
  ];
}

/** Menu contextuel d'une commande du ruban ou de la barre d'accès rapide. */
export function elementsContextuels(cmd: Commande, ids: readonly string[], options: {
  personnaliser: () => void;
  rubanReduit: boolean;
  basculerReduit: () => void;
}): ElementMenu[] {
  const { basculerAccesRapide } = usePreferencesNavigation.getState();
  const present = ids.includes(cmd.id);
  return [
    present
      ? { libelle: 'Retirer de la barre d’accès rapide', icone: 'minus', onSelect: () => basculerAccesRapide(cmd.id) }
      : { libelle: 'Ajouter à la barre d’accès rapide', icone: 'plus', onSelect: () => basculerAccesRapide(cmd.id) },
    { libelle: 'Personnaliser la barre d’accès rapide…', icone: 'settings', onSelect: options.personnaliser },
    'separateur',
    options.rubanReduit
      ? { libelle: 'Épingler le ruban', icone: 'pin', kbd: 'Ctrl+F1', onSelect: options.basculerReduit }
      : { libelle: 'Réduire le ruban', icone: 'chevronUp', kbd: 'Ctrl+F1', onSelect: options.basculerReduit },
  ];
}
