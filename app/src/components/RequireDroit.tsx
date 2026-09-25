import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

/** Garde de route : affiche « Accès refusé » si l'utilisateur dossier n'a pas le droit requis. */
export default function RequireDroit({ si, children }: { si: boolean; children: ReactNode }) {
  if (si) return <>{children}</>;
  return (
    <div className="bg-surface border border-line-soft rounded-md shadow-soft p-6 max-w-[560px]">
      <div className="text-[15px] font-extrabold text-ink">Accès refusé</div>
      <div className="text-[12px] text-ink-muted mt-1">
        Votre profil utilisateur ne donne pas accès à cet écran. Demandez à un administrateur de vous accorder le droit correspondant
        (Paramètres → Utilisateurs &amp; droits).
      </div>
      <Link to="/" className="inline-block mt-4 rounded-md px-3 py-1.5 font-bold text-[12px] text-white bg-brand-700">Tableau de bord</Link>
    </div>
  );
}
