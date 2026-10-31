import type { CSSProperties } from 'react';
import { Icon, type IconName } from '../components/ui/Icon';

/**
 * Adaptateur historique de la navigation : le jeu d'icônes est désormais unique
 * (components/ui/Icon.tsx). Ruban, barre latérale et menu Fichier continuent d'utiliser
 * `<Icone nom="…" taille={…} />`.
 */
export type NomIcone = IconName;

export function Icone({ nom, taille = 18, trait = 1.75, className, style }: {
  nom: NomIcone; taille?: number; trait?: number; className?: string; style?: CSSProperties;
}) {
  return <Icon name={nom} size={taille} strokeWidth={trait} className={className} style={style} />;
}
