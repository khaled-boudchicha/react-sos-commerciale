/**
 * Icônes au trait (24×24, currentColor) — jeu de la maquette « Vente au comptoir ».
 * Remplace les emoji : rendu net, couleur héritée du texte, taille réglable.
 */
const TRACES = {
  scan: 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 8v8M11 8v8M15 8v8',
  retour: 'M9 14 4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  imprimante: 'M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v8H6z',
  utilisateur: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M4 21a8 8 0 0 1 16 0',
  corbeille: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  especes: 'M4 6h16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2M14.5 12a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0M6 12h.01M18 12h.01',
  pourcent: 'M19 5 5 19M7.5 6.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0M18.5 17.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0',
  liste: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  cadenas: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
  croix: 'M18 6 6 18M6 6l12 12',
  panier: 'M6 6h15l-1.5 9h-12zM6 6 5 3H2M9 20h.01M18 20h.01',
} as const;

export type NomIcone = keyof typeof TRACES;

export default function Icon({ name, size = 20, strokeWidth = 2, className, label }: {
  name: NomIcone; size?: number; strokeWidth?: number; className?: string;
  /** Libellé accessible ; absent = icône décorative. */
  label?: string;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth}
         strokeLinecap="round" strokeLinejoin="round" className={className}
         role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={TRACES[name]} />
    </svg>
  );
}

/** Touche clavier affichée sur un bouton (keycap). */
export function Kbd({ children, tone = 'line', size = 'sm' }: {
  children: React.ReactNode;
  /** line = bordure grise ; brand = bordure bleue ; inverse = sur fond plein coloré. */
  tone?: 'line' | 'brand' | 'inverse';
  size?: 'sm' | 'md';
}) {
  const style: React.CSSProperties = tone === 'inverse'
    ? { background: 'rgb(255 255 255 / .2)' }
    : { border: `1px solid ${tone === 'brand' ? 'var(--brand-300)' : 'var(--line)'}`, color: tone === 'brand' ? 'inherit' : 'var(--text-label)' };
  return (
    <kbd className={`money font-bold not-italic ${size === 'md' ? 'text-[11px] px-[7px] py-[4px] rounded-[6px]' : 'text-[10.5px] px-[5px] py-px rounded-[5px]'}`}
         style={style}>{children}</kbd>
  );
}
