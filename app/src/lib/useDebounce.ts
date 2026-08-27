import { useEffect, useState } from 'react';

/**
 * Renvoie `value` avec un retard de `delay` ms après la dernière modification.
 * Sert à ne déclencher une requête (recherche, filtre) qu'une fois la frappe
 * stabilisée, plutôt qu'à chaque caractère.
 */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [differe, setDiffere] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDiffere(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return differe;
}
