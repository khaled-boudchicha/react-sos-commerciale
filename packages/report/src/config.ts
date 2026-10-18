/**
 * Configuration injectée par l'application hôte. Le paquet ne connaît ni Electron, ni un backend, ni une
 * bibliothèque d'interface : tout ce qui dépend de l'environnement passe par ici, avec un repli navigateur
 * (localStorage, window.print, téléchargement) quand rien n'est fourni.
 */

export type FichierModeleInfo = { file: string; name: string; kind: string; description?: string; modified: string };

/** Où sont enregistrés les modèles `.gcr`. Implémentations fournies : localStorage (défaut). */
export interface StockageModeles {
  liste(): Promise<FichierModeleInfo[]>;
  lire(file: string): Promise<string | null>;
  ecrire(file: string, contenu: string): Promise<{ ok: boolean; raison?: string }>;
  supprimer(file: string): Promise<unknown>;
  /** Sélecteur de fichiers natif ; absent : champ `<input type="file">` du navigateur. */
  importer?(): Promise<{ nom: string; contenu: string }[]>;
  /** Enregistrer sous… ; absent : téléchargement navigateur. */
  exporter?(nom: string, contenu: string): Promise<unknown>;
  ouvrirDossier?(): Promise<void>;
  /** Libellé de l'emplacement (affiché dans la bibliothèque). */
  dossier?(): Promise<string>;
}

export type DocumentImprimable = { title: string; html: string; css: string };

/** Services d'impression optionnels (sinon : fenêtre d'impression du navigateur, « Enregistrer en PDF »). */
export interface ServicesImpression {
  /** PDF fidèle aux dimensions exactes ; retourne le chemin enregistré, ou null si annulé. */
  exporterPdf?(html: string, largeurMm: number, hauteurMm: number, nomSuggere: string): Promise<string | null>;
  /** Impression directe sans dialogue (imprimante par défaut / ticket). */
  imprimerDirect?(doc: DocumentImprimable): Promise<{ success: boolean; reason?: string }>;
  /** Vrai si l'impression directe est utilisable (défaut : vrai quand `imprimerDirect` est fourni). */
  impressionDirecteDisponible?(): boolean;
}

export interface Notifier {
  success(message: string): void;
  error(message: string): void;
  info(message: string): void;
}

export type ReportConfig = {
  stockage?: StockageModeles;
  impression?: ServicesImpression;
  /** Sinon : notifications intégrées (coin bas-droit). */
  notifier?: Notifier;
  /** Préfixe des clés localStorage : `<espaceNoms>.fichiers` et `<espaceNoms>.defaut` (défaut `gcr.modeles`). */
  espaceNoms: string;
};

let config: ReportConfig = { espaceNoms: 'gcr.modeles' };

export function configurerReport(c: Partial<ReportConfig>): void {
  config = { ...config, ...c };
}

export const configReport = (): ReportConfig => config;
