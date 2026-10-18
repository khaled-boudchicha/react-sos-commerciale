import { useCallback, useMemo, useRef, useState } from 'react';
import type { ObjType, ReportDef } from '../../model';
import type { PressePapier } from './ops';

const LIMITE_HISTORIQUE = 100;

export type DesignerApi = {
  def: ReportDef;
  sel: string[];
  /** Bande sélectionnée (quand aucun objet ne l'est) ; null = propriétés de l'état / de la page. */
  bandeSel: string | null;
  outil: ObjType | null;
  /** Objets copiés (presse-papiers interne du designer). */
  presse: PressePapier | null;
  setPresse: (p: PressePapier | null) => void;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  /** Modification avec entrée d'historique. */
  set: (next: ReportDef, sel?: string[]) => void;
  /** Modification pendant un geste (glisser) : visible mais sans historique tant que le geste n'est pas terminé. */
  brouillon: (next: ReportDef) => void;
  debutGeste: () => void;
  finGeste: () => void;
  select: (ids: string[]) => void;
  selectBande: (id: string | null) => void;
  setOutil: (o: ObjType | null) => void;
  undo: () => void;
  redo: () => void;
  /** Remplace tout le modèle (ouverture d'un fichier) et vide l'historique. */
  charger: (def: ReportDef, dirty?: boolean) => void;
  marquerEnregistre: () => void;
};

type Etat = {
  def: ReportDef;
  passe: ReportDef[];
  futur: ReportDef[];
  sel: string[];
  bandeSel: string | null;
  outil: ObjType | null;
  dirty: boolean;
};

export function useDesigner(initial: ReportDef, dirtyInitial = false): DesignerApi {
  const [e, setE] = useState<Etat>({ def: initial, passe: [], futur: [], sel: [], bandeSel: null, outil: null, dirty: dirtyInitial });
  const [presse, setPresse] = useState<PressePapier | null>(null);
  const instantane = useRef<ReportDef | null>(null);

  const set = useCallback((next: ReportDef, sel?: string[]) => {
    setE((s) => (next === s.def ? s : {
      ...s, def: next, passe: [...s.passe, s.def].slice(-LIMITE_HISTORIQUE), futur: [], dirty: true,
      sel: sel ?? s.sel.filter((id) => next.bands.some((b) => b.objects.some((o) => o.id === id))),
      bandeSel: s.bandeSel && next.bands.some((b) => b.id === s.bandeSel) ? s.bandeSel : null,
    }));
  }, []);

  const brouillon = useCallback((next: ReportDef) => setE((s) => ({ ...s, def: next })), []);

  const debutGeste = useCallback(() => { setE((s) => { instantane.current = s.def; return s; }); }, []);
  const finGeste = useCallback(() => {
    setE((s) => {
      const avant = instantane.current;
      instantane.current = null;
      if (!avant || avant === s.def) return s;
      return { ...s, passe: [...s.passe, avant].slice(-LIMITE_HISTORIQUE), futur: [], dirty: true };
    });
  }, []);

  const select = useCallback((ids: string[]) => setE((s) => ({ ...s, sel: ids, bandeSel: ids.length ? null : s.bandeSel })), []);
  const selectBande = useCallback((id: string | null) => setE((s) => ({ ...s, sel: [], bandeSel: id })), []);
  const setOutil = useCallback((o: ObjType | null) => setE((s) => ({ ...s, outil: o })), []);

  const undo = useCallback(() => setE((s) => {
    if (!s.passe.length) return s;
    const precedent = s.passe[s.passe.length - 1];
    return { ...s, def: precedent, passe: s.passe.slice(0, -1), futur: [s.def, ...s.futur], dirty: true,
      sel: s.sel.filter((id) => precedent.bands.some((b) => b.objects.some((o) => o.id === id))) };
  }), []);

  const redo = useCallback(() => setE((s) => {
    if (!s.futur.length) return s;
    const [suivant, ...reste] = s.futur;
    return { ...s, def: suivant, passe: [...s.passe, s.def], futur: reste, dirty: true,
      sel: s.sel.filter((id) => suivant.bands.some((b) => b.objects.some((o) => o.id === id))) };
  }), []);

  const charger = useCallback((def: ReportDef, dirty = false) => {
    setE({ def, passe: [], futur: [], sel: [], bandeSel: null, outil: null, dirty });
  }, []);

  const marquerEnregistre = useCallback(() => setE((s) => ({ ...s, dirty: false })), []);

  return useMemo(() => ({
    def: e.def, sel: e.sel, bandeSel: e.bandeSel, outil: e.outil, presse, setPresse, dirty: e.dirty,
    canUndo: e.passe.length > 0, canRedo: e.futur.length > 0,
    set, brouillon, debutGeste, finGeste, select, selectBande, setOutil, undo, redo, charger, marquerEnregistre,
  }), [e, presse, set, brouillon, debutGeste, finGeste, select, selectBande, setOutil, undo, redo, charger, marquerEnregistre]);
}
