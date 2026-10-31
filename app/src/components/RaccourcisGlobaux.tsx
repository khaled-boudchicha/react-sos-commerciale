import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDroits } from '../lib/droits';

/**
 * Raccourcis clavier globaux des listes (héritage Delphi, charte §7) :
 * Ctrl+N = nouvelle pièce depuis le tableau de bord, la liste des ventes ou celle des achats,
 * du type de l'onglet sélectionné quand l'utilisateur a le droit de le créer.
 * Inactif quand une fenêtre modale est ouverte et au comptoir (raccourcis propres).
 */
export default function RaccourcisGlobaux() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { peutDoc } = useDroits();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey || e.key.toLowerCase() !== 'n') return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const sens = pathname === '/ventes' || pathname === '/' ? 'vente' : pathname === '/achats' ? 'achat' : null;
      if (!sens) return;
      // Type de l'onglet « Type de pièce » sélectionné, sinon le type courant de chaque sens
      const onglet = document.querySelector<HTMLElement>('[role="tablist"][aria-label="Type de pièce"] [role="tab"][aria-selected="true"]');
      const defaut = sens === 'vente' ? 'FA' : 'BR';
      const type = onglet?.dataset.code ?? defaut;
      const choisi = peutDoc(sens, type, 'creer') ? type : peutDoc(sens, defaut, 'creer') ? defaut : null;
      e.preventDefault();
      navigate(`/${sens === 'vente' ? 'ventes' : 'achats'}/nouvelle${choisi ? `?type=${choisi}` : ''}`);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pathname, navigate, peutDoc]);

  return null;
}
