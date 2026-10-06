import { useEffect, useRef } from 'react';

/**
 * Gestionnaire de raccourcis clavier déclaratif (équivalent des ActionList Delphi).
 *
 * Clés au format « Mod+Touche » : `F2`, `Escape`, `Delete`, `Alt+F1`, `Ctrl+Q`,
 * `NumpadAdd`, `NumpadSubtract`… (`Touche` = `KeyboardEvent.key`, ou `code` pour le pavé
 * numérique). Les handlers sont lus via une ref : pas besoin de mémoïser la table.
 *
 * `enabled = false` désactive tout (ex. : un dialogue modal est ouvert au-dessus).
 * Écoute en phase de bouillonnement : un champ qui consomme la touche (stopPropagation,
 * ex. Échap pour fermer une liste) garde la priorité sur le raccourci global.
 */
export type HotkeyMap = Record<string, (e: KeyboardEvent) => void>;

export function comboDepuisEvent(e: KeyboardEvent): string[] {
  const mods = `${e.ctrlKey || e.metaKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}`;
  const touche = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  // Le pavé numérique est identifié par `code` (NumpadAdd…) pour le distinguer du « + » du clavier
  return e.code.startsWith('Numpad') ? [`${mods}${e.code}`, `${mods}${touche}`] : [`${mods}${touche}`];
}

export function useHotkeys(map: HotkeyMap, enabled = true) {
  const ref = useRef(map);
  ref.current = map;

  useEffect(() => {
    if (!enabled) return;
    function onKey(e: KeyboardEvent) {
      for (const combo of comboDepuisEvent(e)) {
        const h = ref.current[combo];
        if (h) { e.preventDefault(); h(e); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled]);
}
