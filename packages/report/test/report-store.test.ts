import { beforeEach, describe, expect, it } from 'vitest';
import { configurerReport } from '../src/config';
import {
  chargerModele, definirModeleParDefaut, dupliquerModele, enregistrerModele, importerModeles,
  definirVersionPersonnelle, listerModeles, modeleParDefaut, modelesRemplaces, nomFichier, oublierVersionsDe, resoudreVersion,
  supprimerModele, versionPersonnelle,
} from '../src/store';
import { creerEtat } from '../src/model';
import { installerExemples } from '../src/exemples';

/** localStorage minimal : le store est testé en mode « navigateur » (sans API Electron). */
function installerStockage() {
  const m = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
  };
}

beforeEach(() => { installerStockage(); delete (globalThis as any).window; configurerReport({ stockage: undefined }); installerExemples(); });

describe('store des modèles (.gcr)', () => {
  it('nomFichier assainit les caractères interdits et borne la longueur', () => {
    expect(nomFichier('a/b\\c:d*e?"f<g>h|i')).toBe('a b c d e f g h i.gcr');
    expect(nomFichier('   ')).toBe('Modèle.gcr');
    expect(nomFichier('..caché')).toBe('caché.gcr');
    expect(nomFichier('x'.repeat(300)).length).toBeLessThanOrEqual(84);
  });

  it('enregistre, relit, liste et supprime', async () => {
    const e = creerEtat('vente', 'Ma facture');
    const f = await enregistrerModele(e);
    expect(f).toBe('Ma facture.gcr');
    expect((await chargerModele(`fichier:${f}`)).name).toBe('Ma facture');
    expect((await listerModeles('vente')).some((m) => m.ref === `fichier:${f}`)).toBe(true);
    await supprimerModele(f);
    expect((await listerModeles()).some((m) => m.ref === `fichier:${f}`)).toBe(false);
    await expect(chargerModele(`fichier:${f}`)).rejects.toThrow();
  });

  it("un nouveau modèle de même titre n'écrase jamais un fichier existant", async () => {
    const a = await enregistrerModele(creerEtat('vente', 'Doublon'));
    const b = await enregistrerModele(creerEtat('vente', 'Doublon'));
    expect(a).toBe('Doublon.gcr');
    expect(b).toBe('Doublon (2).gcr');
  });

  it('duplique un modèle intégré en fichier personnel', async () => {
    const f = await dupliquerModele('integre:exemple-facture-a4');
    expect(f.endsWith('.gcr')).toBe(true);
    const copie = await chargerModele(`fichier:${f}`);
    expect(copie.name).toMatch(/copie$/);
    expect(copie.bands.length).toBeGreaterThan(0);
  });

  it('un fichier corrompu ou non-gcr est refusé proprement', async () => {
    localStorage.setItem('gc.modeles.fichiers', JSON.stringify({ 'x.gcr': '{pas du json', 'y.gcr': '{"format":"autre"}' }));
    await expect(chargerModele('fichier:x.gcr')).rejects.toThrow();
    await expect(chargerModele('fichier:y.gcr')).rejects.toThrow();
    // la liste ignore le fichier illisible sans planter
    const noms = (await listerModeles()).filter((m) => m.source === 'fichier').map((m) => m.file);
    expect(noms).not.toContain('x.gcr');
  });

  it('modèle par défaut : défini, lu, retiré', () => {
    expect(modeleParDefaut('vente')).toBeNull();
    definirModeleParDefaut('vente', 'fichier:A.gcr');
    expect(modeleParDefaut('vente')).toBe('fichier:A.gcr');
    definirModeleParDefaut('vente', null);
    expect(modeleParDefaut('vente')).toBeNull();
  });

  it('import via un stockage injecté : valide les fichiers, attribue de nouveaux ids, rapporte les erreurs', async () => {
    const bon = creerEtat('achat', 'Importé');
    const contenu = JSON.stringify(bon);
    const ecrits: string[] = [];
    configurerReport({
      stockage: {
        importer: async () => [{ nom: 'bon.gcr', contenu }, { nom: 'mauvais.gcr', contenu: '{"x":1}' }],
        liste: async () => [], lire: async () => null,
        ecrire: async (f) => { ecrits.push(f); return { ok: true }; },
        supprimer: async () => undefined,
      },
    });
    const r = await importerModeles();
    expect(r.importes).toEqual(['Importé.gcr']);
    expect(r.erreurs).toHaveLength(1);
    expect(r.erreurs[0]).toContain('mauvais.gcr');
    expect(ecrits).toEqual(['Importé.gcr']);
  });
});

describe('espace de noms du stockage navigateur', () => {
  it('les clés localStorage suivent configurerReport({ espaceNoms })', async () => {
    configurerReport({ espaceNoms: 'monapp.etats' });
    await enregistrerModele(creerEtat('facture', 'Namespace'));
    definirModeleParDefaut('facture', 'fichier:Namespace.gcr');
    expect(localStorage.getItem('monapp.etats.fichiers')).toContain('Namespace.gcr');
    expect(localStorage.getItem('monapp.etats.defaut')).toContain('Namespace.gcr');
    expect(localStorage.getItem('gcr.modeles.fichiers')).toBeNull();
    configurerReport({ espaceNoms: 'gcr.modeles' });
  });

  it('version personnelle d’un modèle livré : remplace l’original tant que le fichier existe', async () => {
    const livre = 'integre:exemple-facture-a4';
    expect(resoudreVersion(livre, await listerModeles())).toBe(livre);
    const f = await dupliquerModele(livre, 'Ma facture');
    definirVersionPersonnelle(livre, `fichier:${f}`, 1000);
    expect(versionPersonnelle(livre)).toEqual({ ref: `fichier:${f}`, date: 1000 });
    expect(resoudreVersion(livre, await listerModeles())).toBe(`fichier:${f}`);
    expect(resoudreVersion('integre:autre', await listerModeles())).toBe('integre:autre');  // les autres modèles ne bougent pas
    expect(modelesRemplaces()).toEqual({ [`fichier:${f}`]: [livre] });
    // fichier supprimé : l'original revient, et la version est oubliée
    await supprimerModele(f);
    expect(resoudreVersion(livre, await listerModeles())).toBe(livre);
    oublierVersionsDe(`fichier:${f}`);
    expect(versionPersonnelle(livre)).toBeNull();
  });
});
