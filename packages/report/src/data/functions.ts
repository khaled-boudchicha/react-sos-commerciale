/** Catalogue des fonctions du langage d'expressions (documentation affichée dans le designer). */
export type FonctionDoc = { nom: string; signature: string; description: string; categorie: string };

const f = (categorie: string, nom: string, signature: string, description: string): FonctionDoc => ({ categorie, nom, signature, description });

export const FONCTIONS_DOC: FonctionDoc[] = [
  f('Agrégats', 'SUM', 'SUM(Lignes.total_ht)', 'Somme sur les lignes du jeu de données (ou du groupe en pied de groupe)'),
  f('Agrégats', 'COUNT', 'COUNT(Lignes)', 'Nombre de lignes'),
  f('Agrégats', 'AVG', 'AVG(Lignes.prix_ht)', 'Moyenne'),
  f('Agrégats', 'MIN', 'MIN(Lignes.prix_ht)', 'Plus petite valeur (avec 2 arguments ou plus : minimum de ces valeurs)'),
  f('Agrégats', 'MAX', 'MAX(Lignes.prix_ht)', 'Plus grande valeur (avec 2 arguments ou plus : maximum de ces valeurs)'),
  f('Agrégats', 'FIRST', 'FIRST(Lignes.designation)', 'Valeur de la première ligne'),
  f('Agrégats', 'LAST', 'LAST(Lignes.designation)', 'Valeur de la dernière ligne'),
  f('Agrégats', 'SUMIF', 'SUMIF(Lignes.total_ht, Lignes.tva = 19)', 'Somme conditionnelle'),
  f('Agrégats', 'COUNTIF', 'COUNTIF(Lignes.qte > 5)', 'Nombre de lignes vérifiant une condition'),
  f('Agrégats', 'DISTINCTCOUNT', 'DISTINCTCOUNT(Lignes.famille)', 'Nombre de valeurs différentes'),
  f('Logique', 'IIF', "IIF(Facture.reste_a_payer > 0, 'Impayé', 'Soldé')", 'Condition : si / alors / sinon (aussi IF, SI)'),
  f('Logique', 'COALESCE', "COALESCE(Facture.tel, 'Non renseigné')", 'Première valeur non vide'),
  f('Logique', 'ISNULL', 'ISNULL(Facture.observation)', 'Vrai si la valeur est vide'),
  f('Logique', 'AND', 'AND(a, b)', 'Et logique (ou opérateur and / &&)'),
  f('Logique', 'OR', 'OR(a, b)', 'Ou logique (ou opérateur or / ||)'),
  f('Logique', 'NOT', 'NOT(a)', 'Négation (ou opérateur not / !)'),
  f('Texte', 'UPPER', 'UPPER(Facture.raison)', 'Majuscules'),
  f('Texte', 'LOWER', 'LOWER(Facture.raison)', 'Minuscules'),
  f('Texte', 'PROPER', 'PROPER(Facture.raison)', 'Première lettre de chaque mot en majuscule'),
  f('Texte', 'TRIM', 'TRIM(Facture.raison)', 'Supprime les espaces en début et fin'),
  f('Texte', 'LEN', 'LEN(Facture.numero)', 'Nombre de caractères'),
  f('Texte', 'LEFT', 'LEFT(Facture.numero, 4)', 'Premiers caractères'),
  f('Texte', 'RIGHT', 'RIGHT(Facture.numero, 4)', 'Derniers caractères'),
  f('Texte', 'MID', 'MID(Facture.numero, 2, 3)', 'Extrait (début à partir de 1, longueur)'),
  f('Texte', 'REPLACE', "REPLACE(Facture.tel, ' ', '')", 'Remplace du texte'),
  f('Texte', 'CONTAINS', "CONTAINS(Facture.raison, 'SARL')", 'Vrai si le texte contient la valeur'),
  f('Texte', 'PADLEFT', "PADLEFT(Facture.numero, 8, '0')", 'Complète à gauche'),
  f('Texte', 'CONCAT', 'CONCAT(a, b, c)', 'Assemble des textes (ou opérateur &)'),
  f('Nombres', 'ROUND', 'ROUND(Facture.total_ttc, 2)', 'Arrondi à n décimales'),
  f('Nombres', 'FLOOR', 'FLOOR(x)', 'Arrondi à l’entier inférieur'),
  f('Nombres', 'CEIL', 'CEIL(x)', 'Arrondi à l’entier supérieur'),
  f('Nombres', 'ABS', 'ABS(x)', 'Valeur absolue'),
  f('Nombres', 'VAL', "VAL('12,5')", 'Convertit un texte en nombre'),
  f('Nombres', 'FORMATNUM', "FORMATNUM(Facture.total_ttc, '#,##0.00')", 'Formate un nombre (milliers espacés, virgule décimale)'),
  f('Dates', 'TODAY', 'TODAY()', 'Date du jour'),
  f('Dates', 'NOW', 'NOW()', 'Date et heure actuelles'),
  f('Dates', 'YEAR', 'YEAR(Facture.date)', 'Année'),
  f('Dates', 'MONTH', 'MONTH(Facture.date)', 'Mois (1 à 12)'),
  f('Dates', 'DAY', 'DAY(Facture.date)', 'Jour du mois'),
  f('Dates', 'DATEADD', 'DATEADD(Facture.date, 30)', 'Ajoute des jours à une date'),
  f('Dates', 'DATEDIFF', 'DATEDIFF(Facture.date, TODAY())', 'Nombre de jours entre deux dates'),
  f('Dates', 'FORMATDATE', "FORMATDATE(Facture.date, 'dd/MM/yyyy')", 'Formate une date'),
  f('Formats', 'FORMAT', "FORMAT(Facture.total_ttc, '#,##0.00')", 'Formate un nombre ou une date selon le motif'),
  f('Montants', 'ENLETTRES', 'ENLETTRES(Facture.total)', 'Entier en toutes lettres (« Mille Deux Cent… »)'),
];

/** Ajoute (ou remplace) une entrée du catalogue ; appelé par `enregistrerFonction`. */
export function documenterFonction(doc: FonctionDoc): void {
  const i = FONCTIONS_DOC.findIndex((x) => x.nom === doc.nom);
  if (i >= 0) FONCTIONS_DOC[i] = doc; else FONCTIONS_DOC.push(doc);
}

export const categoriesFonctions = (): string[] => [...new Set(FONCTIONS_DOC.map((x) => x.categorie))];

/** Variables système disponibles partout. */
export const VARIABLES_SYSTEME: { nom: string; description: string }[] = [
  { nom: 'Page', description: 'Numéro de la page courante' },
  { nom: 'TotalPages', description: 'Nombre total de pages' },
  { nom: 'Date', description: 'Date du jour' },
  { nom: 'Now', description: 'Date et heure d’impression' },
  { nom: 'Row', description: 'Numéro de la ligne courante (à partir de 1)' },
  { nom: 'ReportName', description: 'Titre de l’état' },
];
