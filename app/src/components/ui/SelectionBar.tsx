import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Icon } from './Icon';
import { cn } from './cn';

/**
 * Sélection multiple d'une liste (pages comprises) : les lignes cochées sont mémorisées par clé,
 * y compris celles des pages déjà quittées (la grille ne renvoie que les lignes de la page affichée).
 * La sélection est vidée quand `cleListe` change (onglet, période…).
 */
export function useSelectionLignes<T>(cle: (l: T) => string | number, cleListe?: string) {
  const [etat, setEtat] = useState<{ liste?: string; lignes: Map<string | number, T> }>({ liste: cleListe, lignes: new Map() });
  // Autre liste : la sélection précédente n'a plus de sens
  const lignes = etat.liste === cleListe ? etat.lignes : new Map<string | number, T>();
  const cles = useMemo(() => [...lignes.keys()], [lignes]);
  const surSelection = useCallback((nouvelles: (string | number)[], visibles: T[]) => {
    setEtat((e) => {
      const avant = e.liste === cleListe ? e.lignes : new Map<string | number, T>();
      const parCle = new Map(visibles.map((l) => [cle(l), l]));
      const m = new Map<string | number, T>();
      for (const k of nouvelles) {
        const l = parCle.get(k) ?? avant.get(k);
        if (l !== undefined) m.set(k, l);
      }
      return { liste: cleListe, lignes: m };
    });
  }, [cle, cleListe]);
  const vider = useCallback(() => setEtat({ liste: cleListe, lignes: new Map() }), [cleListe]);
  return { lignes: [...lignes.values()], cles, nombre: lignes.size, surSelection, vider };
}

/**
 * Barre d'actions groupées (Odoo / Dynamics) : apparaît quand des lignes sont cochées,
 * rappelle le nombre et les totaux de la sélection, propose les actions de masse.
 */
export function SelectionBar({ nombre, libelle, feminin, resume, children, onClear, className }: {
  nombre: number;
  /** Accord de « sélectionné » (pièce, facture → féminin). */
  feminin?: boolean;
  /** Nom des éléments au pluriel (« pièces », « articles »). */
  libelle: string;
  /** Totaux de la sélection (montants…). */
  resume?: ReactNode;
  /** Actions (boutons `size="sm"`). */
  children?: ReactNode;
  onClear: () => void;
  className?: string;
}) {
  if (nombre === 0) return null;
  return (
    <div role="region" aria-label="Actions sur la sélection"
         className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-brand-line bg-brand-soft px-3 py-2 animate-fade-in', className)}>
      <span className="inline-flex items-center gap-2 text-sm font-bold text-brand-text" role="status" aria-live="polite">
        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand-700 px-1.5 text-xs text-ink-inverse money">{nombre}</span>
        {libelle} sélectionné{feminin ? 'e' : ''}{nombre > 1 ? 's' : ''}
      </span>
      {resume && <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-label">{resume}</span>}
      <span className="ml-auto flex flex-wrap items-center gap-2">
        {children}
        <Button size="sm" variant="ghost" icon="close" onClick={onClear} title="Effacer la sélection (Échap)">Effacer</Button>
      </span>
    </div>
  );
}

/** Élément de résumé « Libellé : valeur » de la barre de sélection. */
export function SelectionStat({ label, children, icon }: { label: ReactNode; children: ReactNode; icon?: Parameters<typeof Icon>[0]['name'] }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {icon && <Icon name={icon} size={14} className="text-ink-muted" />}
      <span className="text-ink-muted">{label}</span>
      <span className="font-semibold text-ink">{children}</span>
    </span>
  );
}
