import type { IncidentReseau } from '../store/reseau';
import type { ErreurApp } from './journalErreurs';

/**
 * Rapport de diagnostic à transmettre au support (texte brut, copié dans le presse-papiers).
 * Ne contient AUCUN secret : ni jeton, ni mot de passe, ni code d'appairage, ni donnée de pièce.
 */
export type DonneesRapport = {
  version?: string | null;
  plateforme?: string | null;
  date: Date;
  agent?: string | null;
  dossier?: string | null;
  utilisateur?: string | null;
  connexion: string;
  protectionSession?: string | null;
  derniereReponse?: number | null;
  cache?: { articles: number; reponses: number } | null;
  controles?: { libelle: string; etat: string; detail: string; ms?: number }[];
  incidents: IncidentReseau[];
  erreurs: ErreurApp[];
};

const heure = (t: number) => new Date(t).toLocaleString('fr-FR');

export function rapportDiagnostic(d: DonneesRapport): string {
  const l: string[] = [];
  l.push('RAPPORT DE DIAGNOSTIC — Gestion Commerciale Desktop');
  l.push(`Généré le ${d.date.toLocaleString('fr-FR')}`);
  l.push('');
  l.push(`Version : ${d.version || 'inconnue'} · Plateforme : ${d.plateforme || 'navigateur'}`);
  l.push(`Agent : ${d.agent || '—'} · Dossier : ${d.dossier || '—'} · Utilisateur : ${d.utilisateur || '—'}`);
  l.push(`Connexion : ${d.connexion}${d.derniereReponse ? ` (dernière réponse du serveur : ${heure(d.derniereReponse)})` : ''}`);
  if (d.protectionSession) l.push(`Session sur ce poste : ${d.protectionSession}`);
  if (d.cache) l.push(`Cache hors ligne : ${d.cache.articles} article(s), ${d.cache.reponses} référentiel(s)`);
  if (d.controles?.length) {
    l.push('');
    l.push('Contrôles :');
    for (const c of d.controles) l.push(`  - ${c.libelle} : ${c.etat} — ${c.detail}${c.ms != null ? ` (${c.ms} ms)` : ''}`);
  }
  l.push('');
  l.push(`Incidents réseau (${d.incidents.length}) :`);
  if (!d.incidents.length) l.push('  aucun');
  for (const i of d.incidents.slice(0, 20)) {
    l.push(`  - ${heure(i.debut)} · ${i.operation} · ${i.message}${i.n > 1 ? ` · ${i.n} fois jusqu'à ${heure(i.fin)}` : ''}`);
  }
  l.push('');
  l.push(`Erreurs de l'application (${d.erreurs.length}) :`);
  if (!d.erreurs.length) l.push('  aucune');
  for (const e of d.erreurs.slice(0, 20)) {
    l.push(`  - ${heure(e.debut)} · ${e.origine} · ${e.ecran} · ${e.message}${e.n > 1 ? ` · ${e.n} fois` : ''}`);
    if (e.pile) for (const p of e.pile.split('\n').slice(1, 4)) l.push(`      ${p.trim()}`);
  }
  return l.join('\n');
}
