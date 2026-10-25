import { describe, expect, it } from 'vitest';
import { C, MENU_LATERAL, ONGLETS, estActive, ongletDeRoute, ongletsVisibles, type Commande, type Droits } from '../navigation/commandes';

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

describe('commandes de navigation', () => {
  it('chaque commande a un identifiant unique et une destination (route ou action)', () => {
    const toutes = Object.values(C) as Commande[];
    expect(new Set(toutes.map((c) => c.id)).size).toBe(toutes.length);
    for (const c of toutes) expect(!!c.to || !!c.action, c.id).toBe(true);
  });

  it('les touches d’accès des onglets sont uniques et ne prennent pas F (Fichier)', () => {
    const t = ONGLETS.map((o) => o.touche);
    expect(new Set(t).size).toBe(t.length);
    expect(t).not.toContain('F');
  });

  it('dans un onglet, deux commandes n’ont jamais le même libellé ni la même destination', () => {
    for (const o of ONGLETS) {
      const cmds = o.groupes.flatMap((g) => g.elements.map((e) => e.cmd));
      const libelles = cmds.map((c) => c.court ?? c.libelle);
      expect(new Set(libelles).size, `${o.id} : ${libelles.join(', ')}`).toBe(libelles.length);
      const dest = cmds.map((c) => c.to ?? c.action);
      expect(new Set(dest).size, o.id).toBe(dest.length);
    }
  });

  it('l’onglet suit l’écran ouvert', () => {
    expect(ongletDeRoute('/')).toBe('accueil');
    expect(ongletDeRoute('/ventes/12')).toBe('ventes');
    expect(ongletDeRoute('/comptoir')).toBe('ventes');
    expect(ongletDeRoute('/achats/nouvelle')).toBe('achats');
    expect(ongletDeRoute('/stock/inventaires/3')).toBe('stock');
    expect(ongletDeRoute('/tiers/client/C0042')).toBe('tiers');
    expect(ongletDeRoute('/tresorerie')).toBe('finances');
    expect(ongletDeRoute('/statistiques')).toBe('analyse');
    expect(ongletDeRoute('/modeles')).toBe('configuration');
    expect(ongletDeRoute('/inconnu')).toBe('accueil');
  });

  it('commande active : chemin et paramètres de la commande', () => {
    expect(estActive(C.ventesFA, '/ventes', '?type=FA')).toBe(true);
    expect(estActive(C.ventesFA, '/ventes', '?type=BL')).toBe(false);
    expect(estActive(C.ventes, '/ventes', '')).toBe(true);
    expect(estActive(C.ventes, '/ventes', '?type=BL')).toBe(false); // un filtre précis est actif à la place
    expect(estActive(C.tableau, '/', '')).toBe(true);
    expect(estActive(C.tableau, '/ventes', '')).toBe(false);
    expect(estActive(C.mouvements, '/stock/mouvements', '')).toBe(true);
    expect(estActive(C.articles, '/stock/mouvements', '')).toBe(false);
    // barre latérale : « Ventes » reste actif sur les filtres et les fiches
    const ventes = MENU_LATERAL.flatMap((g) => g.commandes).find((c) => c.id === 'ventes')!;
    expect(estActive(ventes, '/ventes', '?type=BL')).toBe(true);
    expect(estActive(ventes, '/ventes/42', '')).toBe(true);
    const stock = MENU_LATERAL.flatMap((g) => g.commandes).find((c) => c.id === 'articles')!;
    expect(estActive(stock, '/stock', '?vue=alerte')).toBe(true);
    expect(estActive(stock, '/stock/mouvements', '')).toBe(false);
  });

  it('les droits masquent commandes, groupes et onglets vides', () => {
    const tout = ongletsVisibles(droits());
    expect(tout.map((o) => o.id)).toEqual(ONGLETS.map((o) => o.id));
    // sans module achat : aucune commande d'achat nulle part (l'onglet Achats ne garde que « Fournisseurs », module Tiers)
    const sansAchat = ongletsVisibles(droits(['achat']));
    expect(sansAchat.find((o) => o.id === 'achats')?.groupes.flatMap((g) => g.elements.map((e) => e.cmd.id))).toEqual(['fournisseurs']);
    const ids = sansAchat.flatMap((o) => o.groupes.flatMap((g) => g.elements.map((e) => e.cmd.id)));
    expect(ids).not.toContain('nouveauBR');
    expect(ids).not.toContain('achatsJournal');
    // une pièce interdite disparaît seule
    const sansFA = ongletsVisibles(droits(['vente:FA'])).flatMap((o) => o.groupes.flatMap((g) => g.elements.map((e) => e.cmd.id)));
    expect(sansFA).not.toContain('nouvelleFA');
    expect(sansFA).toContain('nouveauBL');
    for (const o of ongletsVisibles(droits(['achat', 'vente', 'stock']))) for (const g of o.groupes) expect(g.elements.length).toBeGreaterThan(0);
  });
});
