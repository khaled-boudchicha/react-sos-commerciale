import { describe, expect, it } from 'vitest';
import { creerBande, creerEtat, creerObjet, ReportDef } from '../src/model';
import {
  ajouterBande, ajouterObjet, aligner, changerDeBande, coller, copier, deplacerBande, deplacerObjets, distribuer,
  dupliquer, dupliquerBande, memeTaille, ordreZ, redimensionner, supprimerBande, supprimerObjets, trouverObjet,
} from '../src/ui/designer/ops';

function modele(): { def: ReportDef; a: string; b: string; c: string; bande: string; bande2: string } {
  const e = creerEtat('vente', 'T');
  const b1 = creerBande('data', { dataSource: 'L', height: 20 });
  const b2 = creerBande('pageFooter', { height: 10 });
  const a = creerObjet('text', 10, 2, { w: 20, h: 5 });
  const b = creerObjet('text', 50, 6, { w: 30, h: 8 });
  const c = creerObjet('text', 100, 4, { w: 10, h: 5 });
  b1.objects = [a, b, c];
  e.bands = [b1, b2];
  return { def: e, a: a.id, b: b.id, c: c.id, bande: b1.id, bande2: b2.id };
}

describe('opérations du designer', () => {
  it('déplace en restant dans la bande et dans la largeur', () => {
    const { def, a, bande } = modele();
    const r = deplacerObjets(def, [a], -50, 100, 190);
    const o = trouverObjet(r, a)!.objet;
    expect(o.x).toBe(0);
    expect(o.y).toBeLessThanOrEqual(20);
    expect(o.y).toBeGreaterThanOrEqual(0);
    expect(trouverObjet(r, a)!.bande.id).toBe(bande);
    expect(trouverObjet(def, a)!.objet.x).toBe(10); // l'original n'est pas modifié
  });

  it('magnétisme sur la grille', () => {
    const { def, a } = modele();
    const o = trouverObjet(deplacerObjets(def, [a], 3.3, 0, 190, 2), a)!.objet;
    expect(o.x % 2).toBe(0);
  });

  it('ne déplace pas un objet verrouillé', () => {
    const { def, a } = modele();
    const v = { ...def, bands: def.bands.map((b) => ({ ...b, objects: b.objects.map((o) => (o.id === a ? { ...o, locked: true } : o)) })) };
    expect(trouverObjet(deplacerObjets(v, [a], 20, 0, 190), a)!.objet.x).toBe(10);
  });

  it('aligne à gauche / à droite / au centre', () => {
    const { def, a, b, c } = modele();
    expect(trouverObjet(aligner(def, [a, b, c], 'left'), b)!.objet.x).toBe(10);
    expect(trouverObjet(aligner(def, [a, b, c], 'right'), a)!.objet.x).toBe(90); // 110 - 20
    const centre = aligner(def, [a, b], 'centerH');
    const oa = trouverObjet(centre, a)!.objet, ob = trouverObjet(centre, b)!.objet;
    expect(oa.x + oa.w / 2).toBeCloseTo(ob.x + ob.w / 2, 1);
  });

  it('aligne verticalement', () => {
    const { def, a, b } = modele();
    expect(trouverObjet(aligner(def, [a, b], 'top'), b)!.objet.y).toBe(2);
    expect(trouverObjet(aligner(def, [a, b], 'bottom'), a)!.objet.y).toBe(9); // 14 - 5
    expect(aligner(def, [a], 'left')).toBe(def); // un seul objet : inchangé
  });

  it('distribue régulièrement (au moins 3 objets)', () => {
    const { def, a, b, c } = modele();
    const r = distribuer(def, [a, b, c], 'h');
    const [oa, ob, oc] = [a, b, c].map((id) => trouverObjet(r, id)!.objet);
    const e1 = ob.x - (oa.x + oa.w), e2 = oc.x - (ob.x + ob.w);
    expect(e1).toBeCloseTo(e2, 1);
    expect(distribuer(def, [a, b], 'h')).toBe(def);
  });

  it('même largeur / hauteur que le premier', () => {
    const { def, a, b, c } = modele();
    const r = memeTaille(def, [a, b, c], 'w');
    expect([b, c].every((id) => trouverObjet(r, id)!.objet.w === 20)).toBe(true);
  });

  it('ordre z', () => {
    const { def, a, b, c, bande } = modele();
    const ids = (d: ReportDef) => d.bands.find((x) => x.id === bande)!.objects.map((o) => o.id);
    expect(ids(ordreZ(def, [a], 'front'))).toEqual([b, c, a]);
    expect(ids(ordreZ(def, [c], 'back'))).toEqual([c, a, b]);
    expect(ids(ordreZ(def, [a], 'forward'))).toEqual([b, a, c]);
    expect(ids(ordreZ(def, [c], 'backward'))).toEqual([a, c, b]);
  });

  it('copier / coller / dupliquer créent de nouveaux identifiants', () => {
    const { def, a, bande } = modele();
    const p = copier(def, [a])!;
    const r = coller(def, p, bande);
    expect(r.ids).toHaveLength(1);
    expect(r.ids[0]).not.toBe(a);
    expect(trouverObjet(r.def, r.ids[0])!.objet.x).toBe(13);
    const d = dupliquer(def, [a]);
    expect(d.def.bands[0].objects).toHaveLength(4);
  });

  it('changer de bande conserve les objets, avec bornage vertical', () => {
    const { def, a, bande2 } = modele();
    const r = changerDeBande(def, [a], bande2, 50);
    expect(trouverObjet(r, a)!.bande.id).toBe(bande2);
    expect(trouverObjet(r, a)!.objet.y).toBeLessThanOrEqual(10);
    expect(r.bands[0].objects).toHaveLength(2);
  });

  it('redimensionne dans les limites', () => {
    const { def, a } = modele();
    const o = trouverObjet(redimensionner(def, a, -5, 1, 500, 0, 190), a)!.objet;
    expect(o.x).toBe(0);
    expect(o.w).toBeLessThanOrEqual(190);
    expect(o.h).toBeGreaterThan(0);
  });

  it('supprime des objets', () => {
    const { def, a, b } = modele();
    expect(supprimerObjets(def, [a, b]).bands[0].objects).toHaveLength(1);
  });

  it('bandes : ajout, déplacement, duplication, suppression avec détails', () => {
    const { def, bande } = modele();
    const { def: d2, id } = ajouterBande(def, 'groupHeader', bande);
    expect(d2.bands.map((b) => b.id)).toEqual([bande, id, def.bands[1].id]);
    const monte = deplacerBande(d2, id, -1);
    expect(monte.bands[0].id).toBe(id);
    expect(deplacerBande(d2, bande, -1)).toBe(d2); // déjà en haut : inchangé
    const dup = dupliquerBande(def, bande);
    expect(dup.def.bands).toHaveLength(3);
    expect(dup.def.bands[1].objects[0].id).not.toBe(def.bands[0].objects[0].id);
    const avecDetail = ajouterBande(def, 'data', bande, { parent: bande });
    const sans = supprimerBande(avecDetail.def, bande);
    expect(sans.bands.map((b) => b.id)).toEqual([def.bands[1].id]);
  });

  it('ajouterObjet', () => {
    const { def, bande } = modele();
    const o = creerObjet('barcode', 0, 0);
    expect(ajouterObjet(def, bande, o).bands[0].objects).toHaveLength(4);
  });
});
