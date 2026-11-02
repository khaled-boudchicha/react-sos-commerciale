import { configReport, type StockageModeles } from './config';
import { listerModelesIntegres, modeleIntegre } from './registre';
import { FichierEtatInvalide, ReportDef, cloner, nouvelId, normaliserEtat } from './model';

/**
 * Stockage des modèles d'impression.
 *  - Par défaut : localStorage du navigateur (clés `<espaceNoms>.fichiers` / `.defaut`).
 *  - Application hôte : n'importe quel `StockageModeles` fourni via `configurerReport` (fichiers Electron, API REST…).
 *  - Modèles intégrés : en lecture seule, à dupliquer pour les modifier.
 */

export type SourceModele = 'integre' | 'fichier';

export type ModeleInfo = {
  /** Identifiant stable : `integre:<id>` ou `fichier:<nom.gcr>`. */
  ref: string;
  source: SourceModele;
  /** Nom de fichier (source = fichier) ou identifiant intégré. */
  file: string;
  name: string;
  kind: string;
  description?: string;
  modified: string;
};

const cleFichiers = () => `${configReport().espaceNoms}.fichiers`;
const cleDefaut = () => `${configReport().espaceNoms}.defaut`;
const cleVersions = () => `${configReport().espaceNoms}.versions`;

/** Stockage fourni par l'hôte, sinon null (repli localStorage). */
const api = (): StockageModeles | null => configReport().stockage ?? null;
/** Vrai si l'hôte sait ouvrir le dossier des modèles (bouton « Dossier »). */
export const peutOuvrirDossier = () => !!api()?.ouvrirDossier;

// ─── Repli navigateur ───────────────────────────────────────────────────────

function lireNav(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(cleFichiers()) || '{}') as Record<string, string>; } catch { return {}; }
}
function ecrireNav(m: Record<string, string>) {
  try { localStorage.setItem(cleFichiers(), JSON.stringify(m)); } catch { /* quota / mode privé */ }
}

// ─── Noms de fichier ────────────────────────────────────────────────────────

export function nomFichier(nom: string): string {
  const base = nom.normalize('NFC').replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^[.\s]+/, '').slice(0, 80).trim();
  return `${base || 'Modèle'}.gcr`;
}

async function nomLibre(souhait: string): Promise<string> {
  const pris = new Set((await listerModeles()).filter((m) => m.source === 'fichier').map((m) => m.file.toLowerCase()));
  let f = nomFichier(souhait);
  if (!pris.has(f.toLowerCase())) return f;
  const base = f.replace(/\.gcr$/i, '');
  for (let i = 2; i < 1000; i++) { f = `${base} (${i}).gcr`; if (!pris.has(f.toLowerCase())) return f; }
  return `${base} ${nouvelId('')}.gcr`;
}

// ─── Opérations ─────────────────────────────────────────────────────────────

export async function listerModeles(kind?: string): Promise<ModeleInfo[]> {
  const integres: ModeleInfo[] = listerModelesIntegres().map((m) => {
    const e = m.build();
    return { ref: `integre:${m.id}`, source: 'integre', file: m.id, name: e.name, kind: e.kind, description: e.description, modified: e.modified };
  });
  let fichiers: ModeleInfo[] = [];
  const a = api();
  if (a) {
    fichiers = (await a.liste()).map((f) => ({ ref: `fichier:${f.file}`, source: 'fichier' as const, file: f.file, name: f.name, kind: f.kind, description: f.description, modified: f.modified }));
  } else {
    fichiers = Object.entries(lireNav()).flatMap(([file, contenu]) => {
      try { const j = JSON.parse(contenu); return [{ ref: `fichier:${file}`, source: 'fichier' as const, file, name: String(j.name ?? file), kind: String(j.kind ?? 'document'), description: j.description, modified: String(j.modified ?? '') }]; } catch { return []; }
    });
  }
  const tous = [...fichiers.sort((x, y) => x.name.localeCompare(y.name, 'fr')), ...integres];
  return kind ? tous.filter((m) => m.kind === kind) : tous;
}

export async function chargerModele(ref: string): Promise<ReportDef> {
  const [source, ...reste] = ref.split(':');
  const id = reste.join(':');
  if (source === 'integre') {
    const e = modeleIntegre(id);
    if (!e) throw new FichierEtatInvalide('Modèle intégré introuvable.');
    return e;
  }
  const brut = api() ? await api()!.lire(id) : lireNav()[id];
  if (brut == null) throw new FichierEtatInvalide(`Fichier « ${id} » introuvable.`);
  try { return normaliserEtat(JSON.parse(brut)); } catch (e) {
    throw e instanceof FichierEtatInvalide ? e : new FichierEtatInvalide('Fichier de modèle corrompu.');
  }
}

/** Enregistre un modèle. Sans `file`, crée un nouveau fichier (nom dérivé du titre, jamais d'écrasement). */
export async function enregistrerModele(def: ReportDef, file?: string): Promise<string> {
  const e = { ...cloner(def), modified: new Date().toISOString() };
  const cible = file ?? await nomLibre(e.name);
  const contenu = JSON.stringify(e, null, 2);
  if (api()) {
    const r = await api()!.ecrire(cible, contenu);
    if (!r.ok) throw new Error(r.raison ?? 'Enregistrement impossible.');
  } else {
    ecrireNav({ ...lireNav(), [cible]: contenu });
  }
  return cible;
}

export async function supprimerModele(file: string): Promise<void> {
  if (api()) { await api()!.supprimer(file); return; }
  const m = lireNav(); delete m[file]; ecrireNav(m);
}

/** Copie un modèle (intégré ou fichier) en un nouveau fichier personnel. */
export async function dupliquerModele(ref: string, nom?: string): Promise<string> {
  const e = await chargerModele(ref);
  const copie: ReportDef = { ...cloner(e), id: nouvelId('r'), name: nom ?? `${e.name} — copie`, created: new Date().toISOString() };
  return enregistrerModele(copie);
}

export async function importerModeles(): Promise<{ importes: string[]; erreurs: string[] }> {
  const importes: string[] = [], erreurs: string[] = [];
  let entrees: { nom: string; contenu: string }[] = [];
  if (api()?.importer) entrees = await api()!.importer!();
  else entrees = await new Promise((resolve) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.gcr,application/json'; inp.multiple = true;
    inp.onchange = async () => resolve(await Promise.all(Array.from(inp.files ?? []).map(async (f) => ({ nom: f.name, contenu: await f.text() }))));
    inp.oncancel = () => resolve([]);
    inp.click();
  });
  for (const { nom, contenu } of entrees) {
    try {
      const e = normaliserEtat(JSON.parse(contenu));
      e.id = nouvelId('r'); // un import ne remplace jamais un modèle existant
      importes.push(await enregistrerModele(e));
    } catch (err) { erreurs.push(`${nom} : ${(err as Error).message}`); }
  }
  return { importes, erreurs };
}

export async function exporterModele(def: ReportDef): Promise<void> {
  const contenu = JSON.stringify({ ...def, modified: new Date().toISOString() }, null, 2);
  const nom = nomFichier(def.name);
  if (api()?.exporter) { await api()!.exporter!(nom, contenu); return; }
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url; a.download = nom; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function ouvrirDossierModeles(): Promise<void> { await api()?.ouvrirDossier?.(); }
export async function cheminDossierModeles(): Promise<string> { return (await api()?.dossier?.()) ?? 'Stockage du navigateur'; }

// ─── Modèle par défaut par type de document ────────────────────────────────

function lireDefauts(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(cleDefaut()) || '{}') as Record<string, string>; } catch { return {}; }
}
export function modeleParDefaut(kind: string): string | null { return lireDefauts()[kind] ?? null; }
export function definirModeleParDefaut(kind: string, ref: string | null): void {
  const d = lireDefauts();
  if (ref) d[kind] = ref; else delete d[kind];
  try { localStorage.setItem(cleDefaut(), JSON.stringify(d)); } catch { /* ignoré */ }
}

// ─── Version personnelle d'un modèle livré ──────────────────────────────────
//
// « Personnaliser » un modèle livré crée un fichier ; ce fichier devient sa VERSION PERSONNELLE : partout où le
// modèle livré était utilisé (modèle imposé par un écran, ticket de caisse, défaut d'une pièce…), c'est la version
// personnelle qui sert. Le choix reste précis (un ticket personnalisé ne remplace que le ticket, jamais la facture).

type Versions = Record<string, { ref: string; date: number }>;
function lireVersions(): Versions {
  try { return JSON.parse(localStorage.getItem(cleVersions()) || '{}') as Versions; } catch { return {}; }
}
/** Enregistre (ou retire avec `null`) la version personnelle d'un modèle livré (`integre:<id>`). */
export function definirVersionPersonnelle(refLivre: string, refPerso: string | null, maintenant = Date.now()): void {
  const v = lireVersions();
  if (refPerso) v[refLivre] = { ref: refPerso, date: maintenant }; else delete v[refLivre];
  try { localStorage.setItem(cleVersions(), JSON.stringify(v)); } catch { /* ignoré */ }
}
/** Modèles livrés remplacés par chacune de leurs versions personnelles : `{ 'fichier:x.gcr': ['integre:…'] }`. */
export function modelesRemplaces(): Record<string, string[]> {
  const r: Record<string, string[]> = {};
  for (const [livre, v] of Object.entries(lireVersions())) (r[v.ref] ??= []).push(livre);
  return r;
}
/** Version personnelle d'un modèle livré (référence et date), ou null. */
export function versionPersonnelle(refLivre: string): { ref: string; date: number } | null {
  return lireVersions()[refLivre] ?? null;
}
/**
 * Modèle à utiliser pour une référence : sa version personnelle si elle existe encore parmi `disponibles`
 * (un fichier supprimé est ignoré), sinon la référence elle-même.
 */
export function resoudreVersion(ref: string, disponibles: { ref: string }[]): string {
  const v = ref.startsWith('integre:') ? versionPersonnelle(ref) : null;
  return v && disponibles.some((m) => m.ref === v.ref) ? v.ref : ref;
}
/** Oublie les versions personnelles qui pointent vers un fichier (supprimé, renommé). */
export function oublierVersionsDe(refPerso: string): void {
  const v = lireVersions();
  let change = false;
  for (const k of Object.keys(v)) if (v[k].ref === refPerso) { delete v[k]; change = true; }
  if (change) try { localStorage.setItem(cleVersions(), JSON.stringify(v)); } catch { /* ignoré */ }
}
