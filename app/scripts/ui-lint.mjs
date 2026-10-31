#!/usr/bin/env node
/**
 * Garde-fou de la charte graphique v2 (docs/01-CHARTE-GRAPHIQUE.md §9) : signale dans app/src
 * les écarts qui font dériver l'interface — couleurs en dur, tailles de police arbitraires,
 * voiles de modale faits main, glyphes utilisés comme icônes, couleurs d'aplat employées en texte.
 *
 *   node scripts/ui-lint.mjs            rapport
 *   node scripts/ui-lint.mjs --strict   code de sortie 1 s'il reste un écart
 *
 * Exclus : impression (documents imprimés), styles (jetons), tests, comptoir (métriques de sa maquette).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = fileURLToPath(new URL('../src', import.meta.url));

/** Dossiers / fichiers exclus de toutes les règles. */
const EXCLUS = ['print/', 'impression/', 'styles/', '__tests__/', 'screens/comptoir/'];

/** Exceptions documentées par règle (chemin relatif à src, préfixe). */
const EXCEPTIONS = {
  // Export PDF de la grille : document imprimé (fond blanc imposé), hors thème de l'application
  'couleur-en-dur': ['components/grille/exportGrille.ts'],
  // NumberEdit sert surtout le comptoir (grands montants de la maquette)
  'taille-arbitraire': ['components/ui/NumberEdit.tsx'],
  // Couches plein écran légitimes : coquille modale, palette, menu Fichier, notifications
  'voile-maison': ['components/ui/', 'components/CommandPalette.tsx', 'navigation/Backstage.tsx'],
};

export const REGLES = [
  { id: 'couleur-en-dur', message: 'Couleur hexadécimale en dur : utiliser un jeton (var(--…) / classe Tailwind)',
    motif: /(?<![\w&])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b(?![\w-])/g },
  { id: 'taille-arbitraire', message: 'Taille de police arbitraire : utiliser l’échelle nommée (text-2xs … text-display)',
    motif: /\btext-\[\d+(?:\.\d+)?px\]/g },
  { id: 'voile-maison', message: 'Voile de modale fait main : utiliser Dialog (components/ui/Dialog.tsx)',
    motif: /\bfixed inset-0\b/g },
  { id: 'jeton-inexistant', message: 'Jeton inexistant (surface-alt)', motif: /\bsurface-alt\b/g },
  { id: 'glyphe-icone', message: 'Glyphe ou emoji utilisé comme icône : utiliser <Icon name=…/>',
    motif: /[✕✖✓✔⚠✎⬇🔍📁🖥🗑☰⚙＋☀🌙]/gu },
  { id: 'aplat-en-texte', message: 'Couleur d’aplat employée en texte (contraste insuffisant) : utiliser var(--x-text)',
    motif: /\bcolor:\s*['"`]var\(--(?:success|warning|danger|info|teal|violet|orange)\)['"`]/g },
];

function fichiers(dossier) {
  const sortie = [];
  for (const nom of readdirSync(dossier)) {
    const chemin = join(dossier, nom);
    if (statSync(chemin).isDirectory()) sortie.push(...fichiers(chemin));
    else if (/\.(tsx?|jsx?)$/.test(nom)) sortie.push(chemin);
  }
  return sortie;
}

/** Retourne la liste des écarts { fichier, ligne, regle, extrait }. */
export function analyser(racine = RACINE) {
  const ecarts = [];
  for (const chemin of fichiers(racine)) {
    const rel = relative(racine, chemin).split(sep).join('/');
    if (EXCLUS.some((e) => rel.startsWith(e))) continue;
    const lignes = readFileSync(chemin, 'utf8').split('\n');
    lignes.forEach((texte, i) => {
      const t = texte.trim();
      if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;   // commentaires
      for (const r of REGLES) {
        if ((EXCEPTIONS[r.id] ?? []).some((e) => rel.startsWith(e))) continue;
        r.motif.lastIndex = 0;
        if (r.motif.test(texte)) ecarts.push({ fichier: rel, ligne: i + 1, regle: r.id, extrait: t.slice(0, 120) });
      }
    });
  }
  return ecarts;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const strict = process.argv.includes('--strict');
  const ecarts = analyser();
  if (ecarts.length === 0) {
    console.log('ui-lint : aucun écart à la charte graphique.');
    process.exit(0);
  }
  const parRegle = new Map();
  for (const e of ecarts) parRegle.set(e.regle, [...(parRegle.get(e.regle) ?? []), e]);
  for (const r of REGLES) {
    const liste = parRegle.get(r.id);
    if (!liste) continue;
    console.log(`\n✗ ${r.id} (${liste.length}) — ${r.message}`);
    for (const e of liste) console.log(`  src/${e.fichier}:${e.ligne}  ${e.extrait}`);
  }
  console.log(`\nui-lint : ${ecarts.length} écart(s).`);
  process.exit(strict ? 1 : 0);
}
