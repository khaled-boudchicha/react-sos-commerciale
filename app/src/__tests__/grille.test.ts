import { describe, expect, it } from 'vitest';
import {
  aplatir, calculerResume, clesGroupes, colonnesEffectives, colonnesVisibles, filtrer, grouper,
  paginer, testerFiltre, trier, valeursDistinctes, valider,
} from '../components/grille/moteur';
import { ColonneGrille } from '../components/grille/types';

type L = { id: number; nom: string; famille: string; prix: number | null; date: string; actif: boolean };
const donnees: L[] = [
  { id: 1, nom: 'Éponge', famille: 'Hygiène', prix: 120, date: '2026-01-05', actif: true },
  { id: 2, nom: 'Gants', famille: 'Hygiène', prix: 80, date: '2026-02-10', actif: false },
  { id: 3, nom: 'Seringue', famille: 'Matériel', prix: null, date: '2026-01-20', actif: true },
  { id: 4, nom: 'Compresse', famille: 'Matériel', prix: 45.5, date: '2026-03-01', actif: true },
  { id: 5, nom: 'Alcool', famille: 'Hygiène', prix: 300, date: '2026-01-05', actif: true },
];
const colonnes: ColonneGrille<L>[] = [
  { champ: 'nom', titre: 'Nom' },
  { champ: 'famille', titre: 'Famille' },
  { champ: 'prix', titre: 'Prix', type: 'money' },
  { champ: 'date', titre: 'Date', type: 'date' },
  { champ: 'actif', titre: 'Actif', type: 'boolean' },
];
const vide = { filtres: {}, filtresEntete: {}, recherche: '' };

describe('colonnes', () => {
  it('déduit les colonnes et leur type depuis les données', () => {
    const c = colonnesEffectives<L>(undefined, donnees);
    expect(c.map((x) => x.champ)).toEqual(['id', 'nom', 'famille', 'prix', 'date', 'actif']);
    expect(c.find((x) => x.champ === 'date')?.type).toBe('date');
    expect(c.find((x) => x.champ === 'actif')?.type).toBe('boolean');
  });
  it('ordonne, masque et place les colonnes figées', () => {
    const cols: ColonneGrille<L>[] = [...colonnes, { champ: 'id', figee: 'gauche' }];
    const v = colonnesVisibles(cols, { ordreColonnes: ['prix', 'nom'], masquees: ['date'] });
    expect(v.map((c) => c.champ)).toEqual(['id', 'prix', 'nom', 'famille', 'actif']);
  });
});

describe('filtres', () => {
  it('texte insensible à la casse et aux accents', () => {
    expect(filtrer(donnees, colonnes, { ...vide, filtres: { nom: { operateur: 'contient', valeur: 'EPON' } } }).map((l) => l.id)).toEqual([1]);
    expect(filtrer(donnees, colonnes, { ...vide, filtres: { nom: { operateur: 'commence', valeur: 'c' } } }).map((l) => l.id)).toEqual([4]);
  });
  it('numériques, entre, vide', () => {
    expect(filtrer(donnees, colonnes, { ...vide, filtres: { prix: { operateur: '>', valeur: 100 } } }).map((l) => l.id)).toEqual([1, 5]);
    expect(filtrer(donnees, colonnes, { ...vide, filtres: { prix: { operateur: 'entre', valeur: 50, valeur2: 150 } } }).map((l) => l.id)).toEqual([1, 2]);
    expect(filtrer(donnees, colonnes, { ...vide, filtres: { prix: { operateur: 'vide' } } }).map((l) => l.id)).toEqual([3]);
  });
  it('dates comparées au jour près', () => {
    expect(testerFiltre('date', '2026-01-05T10:30:00', { operateur: '=', valeur: '2026-01-05' })).toBe(true);
    expect(filtrer(donnees, colonnes, { ...vide, filtres: { date: { operateur: '<', valeur: '2026-01-10' } } }).map((l) => l.id)).toEqual([1, 5]);
  });
  it('filtre d’en-tête (valeurs retenues) et recherche globale', () => {
    expect(filtrer(donnees, colonnes, { ...vide, filtresEntete: { famille: ['Matériel'] } }).map((l) => l.id)).toEqual([3, 4]);
    expect(filtrer(donnees, colonnes, { ...vide, recherche: 'hygiene' }).map((l) => l.id)).toEqual([1, 2, 5]);
  });
  it('valeurs distinctes avec effectifs', () => {
    expect(valeursDistinctes(donnees, colonnes[1])).toEqual([{ texte: 'Hygiène', nombre: 3 }, { texte: 'Matériel', nombre: 2 }]);
  });
});

describe('tri', () => {
  it('multi-colonnes, vides en fin dans les deux sens', () => {
    expect(trier(donnees, colonnes, [{ champ: 'prix', sens: 'asc' }]).map((l) => l.id)).toEqual([4, 2, 1, 5, 3]);
    expect(trier(donnees, colonnes, [{ champ: 'prix', sens: 'desc' }]).map((l) => l.id)).toEqual([5, 1, 2, 4, 3]);
    expect(trier(donnees, colonnes, [{ champ: 'famille', sens: 'asc' }, { champ: 'nom', sens: 'desc' }]).map((l) => l.id)).toEqual([2, 1, 5, 3, 4]);
  });
});

describe('groupes, totaux, pagination', () => {
  const arbre = grouper(donnees, colonnes, ['famille', 'actif']);
  it('arbre multi-niveaux', () => {
    expect(arbre.map((g) => [g.texte, g.lignes.length])).toEqual([['Hygiène', 3], ['Matériel', 2]]);
    expect(arbre[0].enfants!.map((g) => g.texte)).toEqual(['Non', 'Oui']);
    expect(clesGroupes(arbre)).toContain('famille=Hygiène|actif=Oui');
  });
  it('aplatissement selon les groupes repliés', () => {
    const tout = aplatir(arbre, { groupesBascules: [], tousReplies: false });
    expect(tout.filter((e) => e.type === 'ligne')).toHaveLength(5);
    const replie = aplatir(arbre, { groupesBascules: ['famille=Hygiène'], tousReplies: false });
    expect(replie.filter((e) => e.type === 'ligne')).toHaveLength(2);
    const tousReplies = aplatir(arbre, { groupesBascules: [], tousReplies: true });
    expect(tousReplies).toHaveLength(2);
  });
  it('totaux', () => {
    expect(calculerResume({ colonne: 'prix', type: 'sum' }, donnees, colonnes)).toBeCloseTo(545.5);
    expect(calculerResume({ colonne: 'prix', type: 'avg' }, donnees, colonnes)).toBeCloseTo(136.375);
    expect(calculerResume({ colonne: 'prix', type: 'max' }, donnees, colonnes)).toBe(300);
    expect(calculerResume({ colonne: 'nom', type: 'count' }, donnees, colonnes)).toBe(5);
    expect(calculerResume({ colonne: 'x', type: 'custom', calculer: (l) => l.filter((x) => x.actif).length }, donnees, colonnes)).toBe(4);
  });
  it('pagination bornée', () => {
    expect(paginer([1, 2, 3, 4, 5], 1, 2)).toEqual({ elements: [3, 4], pages: 3, page: 1 });
    expect(paginer([1, 2, 3], 9, 2).page).toBe(1);
  });
});

describe('validation', () => {
  it('règles requis / min / custom', () => {
    const col: ColonneGrille<L> = { champ: 'prix', titre: 'Prix', validation: [{ type: 'requis' }, { type: 'min', valeur: 0 }] };
    expect(valider(col, '', donnees[0])).toMatch(/requise/);
    expect(valider(col, -1, donnees[0])).toMatch(/Minimum/);
    expect(valider(col, 10, donnees[0])).toBeNull();
  });
});
