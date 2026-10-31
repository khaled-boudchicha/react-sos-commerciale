import { describe, expect, it } from 'vitest';
import {
  ACCES_RAPIDE_DEFAUT, ACCES_RAPIDE_PROPOSES, C, COMMANDES_PAR_ID, ONGLETS, TEINTE_TON,
  commandeDeChemin, commandesAccesRapide, type Commande, type Droits,
} from '../navigation/commandes';
import { normaliserAccesRapide } from '../navigation/preferences';
import { TOUCHES_COMMANDES, ciblesTouches, estReplie, nbGroupesReplies, niveauMax } from '../navigation/repli';
import { MAX_RECENTS, ajouterRecent, ilYA, titreDePage, type Recent } from '../navigation/recents';

/** Droits simulés : tout autorisé sauf ce que `refuse` interdit (modules, libellés, codes de pièce). */
const droits = (refuse: string[] = []): Droits => ({
  droits: undefined, admin: refuse.length === 0,
  peut: (m: string, l: string) => !refuse.includes(m) && !refuse.includes(l),
  peutUn: (m: string, ls: string[]) => !refuse.includes(m) && ls.some((l) => !refuse.includes(l)),
  aModule: (m: string) => !refuse.includes(m),
  restreintAuxSiennes: () => false,
  comptesAutorises: <T,>(c: T[]) => c,
  peutDoc: (sens: string, code: string) => !refuse.includes(sens) && !refuse.includes(`${sens}:${code}`),
} as unknown as Droits);

describe('barre d’accès rapide', () => {
  it('défaut et propositions : uniquement des commandes connues', () => {
    expect([...ACCES_RAPIDE_DEFAUT]).toEqual(['tableau', 'nouvelleFA', 'comptoir']);
    for (const id of [...ACCES_RAPIDE_DEFAUT, ...ACCES_RAPIDE_PROPOSES]) expect(COMMANDES_PAR_ID[id], id).toBeDefined();
  });

  it('chaque commande du ruban peut être ajoutée (identifiant du registre)', () => {
    for (const o of ONGLETS) for (const g of o.groupes) for (const e of g.elements) expect(COMMANDES_PAR_ID[e.cmd.id], e.cmd.id).toBeDefined();
    for (const c of Object.values(C) as Commande[]) expect(TEINTE_TON[c.ton]).toBeDefined();
  });

  it('préférences enregistrées : valeur absente ou invalide → défaut ; doublons et non-chaînes retirés', () => {
    expect(normaliserAccesRapide(undefined)).toEqual([...ACCES_RAPIDE_DEFAUT]);
    expect(normaliserAccesRapide('tableau')).toEqual([...ACCES_RAPIDE_DEFAUT]);
    expect(normaliserAccesRapide([])).toEqual([]);
    expect(normaliserAccesRapide(['articles', 3, '', 'articles', null, 'clients'])).toEqual(['articles', 'clients']);
  });

  it('identifiants inconnus ignorés, commandes interdites masquées, ordre conservé', () => {
    const ids = ['inconnu', 'clients', 'nouvelleFA', 'tableau', 'clients'];
    expect(commandesAccesRapide(ids, droits()).map((c) => c.id)).toEqual(['clients', 'nouvelleFA', 'tableau']);
    expect(commandesAccesRapide(ids, droits(['vente:FA'])).map((c) => c.id)).toEqual(['clients', 'tableau']);
  });
});

describe('repli adaptatif du ruban', () => {
  const ventes = ONGLETS.find((o) => o.id === 'ventes')!.groupes;

  it('les groupes se replient un par un en partant de la droite', () => {
    expect(niveauMax(ventes.length)).toBe(2 + ventes.length);
    expect(nbGroupesReplies(2, ventes.length)).toBe(0);
    expect(nbGroupesReplies(3, ventes.length)).toBe(1);
    expect(nbGroupesReplies(99, ventes.length)).toBe(ventes.length);
    expect(ventes.map((_, gi) => estReplie(gi, 3, ventes.length))).toEqual([false, false, false, true]);
    expect(ventes.map((_, gi) => estReplie(gi, 4, ventes.length))).toEqual([false, false, true, true]);
  });

  it('touches d’accès : une par commande, une seule par groupe replié, stables à gauche', () => {
    const complet = ciblesTouches(ventes, 0);
    expect(complet).toHaveLength(ventes.flatMap((g) => g.elements).length);
    expect(complet.every((c) => c.type === 'cmd')).toBe(true);
    const replie = ciblesTouches(ventes, 4); // « Documents » et « Suivi » repliés
    expect(replie.filter((c) => c.type === 'groupe').map((c) => c.type === 'groupe' && c.groupe.titre)).toEqual(['Documents', 'Suivi']);
    // les commandes des groupes de gauche gardent leur touche
    for (const c of replie.filter((x) => x.type === 'cmd')) {
      const avant = complet.find((x) => x.type === 'cmd' && c.type === 'cmd' && x.cmd.id === c.cmd.id);
      expect(c.touche).toBe(avant?.touche);
    }
    const t = replie.map((c) => c.touche);
    expect(new Set(t).size).toBe(t.length);
    expect(t.every((x) => TOUCHES_COMMANDES.includes(x) && x !== 'F')).toBe(true);
  });
});

describe('écrans récents', () => {
  const r = (chemin: string, titre = chemin, date = 0): Recent => ({ chemin, titre, date });

  it('titre de la fenêtre sans le nom de l’application', () => {
    expect(titreDePage('Factures — Gestion Commerciale')).toBe('Factures');
    expect(titreDePage('Gestion Commerciale')).toBe('');
    expect(titreDePage('Stock')).toBe('Stock');
  });

  it('ajout en tête, sans doublon, borné à 10, comptoir exclu', () => {
    let l: Recent[] = [];
    l = ajouterRecent(l, r('/ventes', 'Ventes', 1));
    l = ajouterRecent(l, r('/stock', 'Stock', 2));
    l = ajouterRecent(l, r('/ventes', 'Ventes', 3));
    expect(l.map((x) => x.chemin)).toEqual(['/ventes', '/stock']);
    expect(l[0].date).toBe(3);
    expect(ajouterRecent(l, r('/comptoir'))).toEqual(l);
    expect(ajouterRecent(l, r('/ventes?type=FA')).map((x) => x.chemin)).toEqual(['/ventes?type=FA', '/ventes', '/stock']);
    for (let i = 0; i < 20; i++) l = ajouterRecent(l, r(`/ventes/${i}`));
    expect(l).toHaveLength(MAX_RECENTS);
    expect(l[0].chemin).toBe('/ventes/19');
  });

  it('durée relative', () => {
    const t0 = new Date(2026, 9, 31, 12, 0, 0).getTime();
    expect(ilYA(t0 - 20_000, t0)).toBe('à l’instant');
    expect(ilYA(t0 - 5 * 60_000, t0)).toBe('il y a 5 min');
    expect(ilYA(t0 - 2 * 3600_000, t0)).toBe('il y a 2 h');
    expect(ilYA(t0 - 26 * 3600_000, t0)).toBe('hier');
    expect(ilYA(t0 - 3 * 86400_000, t0)).toBe('il y a 3 j');
    expect(ilYA(t0 - 30 * 86400_000, t0)).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
  });

  it('icône d’un écran récent : commande exacte, sinon la section', () => {
    expect(commandeDeChemin('/ventes', '?type=FA')?.id).toBe('ventesFA');
    expect(commandeDeChemin('/ventes/42')?.id).toBe('ventes');
    expect(commandeDeChemin('/stock/mouvements')?.id).toBe('mouvements');
    expect(commandeDeChemin('/')?.id).toBe('tableau');
    expect(commandeDeChemin('/inconnu')).toBeUndefined();
  });
});
