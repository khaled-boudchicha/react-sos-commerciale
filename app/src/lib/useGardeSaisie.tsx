import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useBlocker } from 'react-router-dom';
import ConfirmDialog from '../components/ui/ConfirmDialog';

/**
 * Garde « modifications non enregistrées » d'un éditeur : tant que `modifie` est vrai, quitter l'écran
 * (menu, ruban, palette, bouton Retour, raccourci) demande confirmation.
 *
 *   const garde = useGardeSaisie(modifie);
 *   …après un enregistrement réussi : garde.liberer(); navigate(...)
 *   …dans le rendu : {garde.dialogue}
 */
export function useGardeSaisie(modifie: boolean, message = 'Les modifications de cette pièce n’ont pas été enregistrées.'): {
  dialogue: ReactNode;
  liberer: () => void;
} {
  const libere = useRef(false);
  const actif = useRef(modifie);
  actif.current = modifie;

  // Évalué au moment de la navigation : un enregistrement réussi (liberer) laisse partir sans question
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    actif.current && !libere.current && currentLocation.pathname !== nextLocation.pathname);

  const dialogue = blocker.state === 'blocked' ? (
    <ConfirmDialog danger title="Quitter sans enregistrer ?"
                   message={<><p>{message}</p><p className="mt-2">Si vous quittez cet écran, elles seront perdues.</p></>}
                   confirmLabel="Quitter sans enregistrer" cancelLabel="Continuer la saisie"
                   onConfirm={() => blocker.proceed?.()} onCancel={() => blocker.reset?.()} />
  ) : null;

  return { dialogue, liberer: () => { libere.current = true; } };
}

/**
 * Vrai dès que l'état saisi (`empreinte`) diffère de celui de départ. Le départ est figé au premier
 * rendu où `pret` est vrai (pièce source chargée et recopiée), pour ne pas compter le pré-remplissage.
 */
export function useModifie(empreinte: string, pret: boolean): boolean {
  const [base, setBase] = useState<string | null>(null);
  useEffect(() => { if (base === null && pret) setBase(empreinte); }, [base, pret, empreinte]);
  return base !== null && base !== empreinte;
}
