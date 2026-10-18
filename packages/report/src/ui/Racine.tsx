import type { ReactNode } from 'react';

/**
 * Racine de portée : toutes les règles CSS du paquet sont préfixées `.gcr-root` (aucune fuite vers l'application
 * hôte, aucun reset global). `display: contents` (cf. report.css) : l'enveloppe n'a aucun effet sur la mise en page.
 */
export function Racine({ children }: { children: ReactNode }) {
  return <div className="gcr-root">{children}</div>;
}
