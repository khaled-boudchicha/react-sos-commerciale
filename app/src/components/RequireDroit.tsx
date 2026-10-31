import { ReactNode } from 'react';
import { StatePanel } from './ui/States';
import { Button } from './ui/Button';

/** Garde de route : affiche « Accès refusé » si l'utilisateur dossier n'a pas le droit requis. */
export default function RequireDroit({ si, children }: { si: boolean; children: ReactNode }) {
  if (si) return <>{children}</>;
  return (
    <StatePanel kind="forbidden" title="Accès refusé"
                description={<>Votre profil utilisateur ne donne pas accès à cet écran. Demandez à un administrateur de vous accorder
                  le droit correspondant (Paramètres → Utilisateurs &amp; droits).</>}
                actions={<Button variant="primary" icon="dashboard" to="/">Tableau de bord</Button>} />
  );
}
