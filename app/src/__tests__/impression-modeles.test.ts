import { describe, expect, it } from 'vitest';
import {
  Scope, creerEtatStandard, evaluerExpression, expressionsDuTexte, kindDe, listerModelesIntegres, listerTypes, normaliserEtat, rendreEtat, validerExpression, verifierModele,
} from '@softly/report/core';
import { initialiserImpression } from '../impression';
import { donneesRecouvrementBureau, donneesVente } from '../impression/types';
import { MODELES_INTEGRES } from '../impression/modelesIntegres';

initialiserImpression();

const mesureur = { largeur: (t: string) => t.length * 5.5 };

describe('branchement métier sur @softly/report', () => {
  it('déclare les 17 types de documents et tous les modèles livrés', () => {
    expect(listerTypes().map((k) => k.id)).toEqual([
      'vente', 'achat', 'articles', 'etatClient', 'etatFournisseur', 'impayes', 'creances', 'recouvrement', 'tresorerie', 'arreteCaisse', 'bonStock',
      'bordereau', 'journal', 'inventaire', 'etat104', 'ticketVentes', 'recuTransfert',
    ]);
    // chaque type de document a au moins un modèle livré
    for (const k of listerTypes()) expect(MODELES_INTEGRES.some((m) => m.build().kind === k.id), k.id).toBe(true);
    expect(new Set(MODELES_INTEGRES.map((m) => m.id)).size).toBe(MODELES_INTEGRES.length);
    expect(listerModelesIntegres().map((m) => m.id)).toEqual(MODELES_INTEGRES.map((m) => m.id));
  });
  it('la fonction métier ARRETE est disponible dans les expressions', () => {
    expect(evaluerExpression('ARRETE(1250)', new Scope()).valeur).toBe('Mille Deux Cent Cinquante Dinars Algerien et zéro Centimes');
  });
  it('nouveau modèle « standard » : valide et imprimable pour chacun des 17 types de documents', () => {
    for (const k of listerTypes()) {
      const def = creerEtatStandard(k, `Nouveau ${k.label}`);
      expect(verifierModele(def).filter((x) => x.niveau === 'erreur'), k.id).toEqual([]);
      const r = rendreEtat(def, k.sample, { mesureur });
      expect(r.pages.length, k.id).toBeGreaterThan(0);
      expect(r.pages.join(''), k.id).toContain('Page 1 /');
    }
  });
  it('les modèles livrés n’ont aucune erreur de vérification', () => {
    for (const m of MODELES_INTEGRES) expect(verifierModele(m.build()).filter((x) => x.niveau === 'erreur'), m.id).toEqual([]);
  });
});

describe('modèles intégrés', () => {
  for (const m of MODELES_INTEGRES) {
    it(`${m.id} : s'imprime avec son jeu d'exemple, sans avertissement`, () => {
      const e = m.build();
      const r = rendreEtat(e, kindDe(e.kind).sample, { mesureur });
      expect(r.warnings).toEqual([]);
      expect(r.pageCount).toBeGreaterThanOrEqual(1);
      expect(r.html.length).toBeGreaterThan(500);
    });
    it(`${m.id} : toutes les expressions sont valides et le fichier survit à un aller-retour`, () => {
      const e = m.build();
      for (const b of e.bands) {
        for (const x of [b.filter, b.visible, b.groupBy, ...(b.sort ?? []).map((s) => s.expr)]) if (x) expect(validerExpression(x)).toBeNull();
        for (const o of b.objects) {
          const textes = o.type === 'text' ? [o.text] : o.type === 'barcode' ? [o.value] : [];
          for (const t of textes) for (const ex of expressionsDuTexte(t)) expect(validerExpression(ex), `${o.name}: ${ex}`).toBeNull();
        }
      }
      expect(normaliserEtat(JSON.parse(JSON.stringify(e))).bands.length).toBe(e.bands.length);
    });
  }

  it('la facture d’exemple contient les totaux, le montant en lettres et le net à payer', () => {
    const e = MODELES_INTEGRES.find((x) => x.id === 'integre-facture-a4')!.build();
    const r = rendreEtat(e, kindDe('vente').sample, { mesureur });
    const t = r.html.replace(/<[^>]+>/g, ' ');
    expect(t).toContain('FACTURE');
    expect(t).toContain('N° 0012/2026');
    expect(t).toContain('Net à payer');
    expect(t.toLowerCase()).toContain('soixante');
  });

  it('étiquettes : 24 articles sur 3 colonnes = 8 lignes de bande', () => {
    const e = MODELES_INTEGRES.find((x) => x.id === 'integre-etiquettes-prix')!.build();
    const r = rendreEtat(e, kindDe('articles').sample, { mesureur });
    expect((r.html.match(/class="rpt-b"/g) ?? []).length).toBe(8);
    expect(r.html).toContain('<svg'); // codes-barres
  });

  it('les lignes de totaux n’existent que si elles s’appliquent (pas de remise / timbre / réglé vides)', () => {
    const sans = donneesVente({ type_doc: 'FA', numero: '1', total_ht: 100, total_taxe: 19, net_a_payer: 119, regler: 0, remise: 0, timbre: 0 } as never, null);
    expect((sans.Totaux as { libelle: string }[]).map((l) => l.libelle)).toEqual(['Total HT', 'TVA', 'Net à payer']);
    const avec = donneesVente({ type_doc: 'FA', numero: '1', total_ht: 100, total_taxe: 19, net_a_payer: 121, regler: 50, reste_a_payer: 71, remise: 5, timbre: 2 } as never, null);
    expect((avec.Totaux as { libelle: string }[]).map((l) => l.libelle)).toEqual(['Total HT', 'Remise', 'TVA', 'Droit de timbre', 'Net à payer', 'Réglé', 'Reste à payer']);
    expect((avec.Totaux as { final?: boolean }[]).filter((l) => l.final)).toHaveLength(1);
  });

  it('ticket : espèces reçues et rendu s’ajoutent aux données du comptoir', () => {
    const d = donneesVente({ type_doc: 'BCT', numero: '9', net_a_payer: 100 } as never, null, { caissier: 'Sara', recu: 150, rendu: 50 });
    expect((d.Vente as Record<string, unknown>).caissier).toBe('Sara');
    expect((d.Vente as Record<string, unknown>).rendu).toBe(50);
  });
});

describe('pagination des modèles livrés avec de gros volumes', () => {
  /** Répète chaque liste du jeu d'exemple jusqu'à n lignes (totaux et modes inchangés). */
  const gros = (kind: string, n: number) => {
    const data = JSON.parse(JSON.stringify(kindDe(kind).sample)) as Record<string, unknown>;
    for (const k of Object.keys(data)) {
      const v = data[k];
      if (Array.isArray(v) && v.length && k !== 'Totaux' && k !== 'Modes') data[k] = Array.from({ length: n }, (_, i) => ({ ...(v[i % v.length] as object) }));
    }
    return data;
  };
  for (const m of MODELES_INTEGRES) {
    it(`${m.id} : 90 lignes, aucune perte, aucun avertissement`, () => {
      const e = m.build();
      const r = rendreEtat(e, gros(e.kind, 90), { mesureur });
      expect(r.warnings).toEqual([]);
      if (!e.page.continuous && !/etiquettes/.test(m.id)) {
        expect(r.pageCount).toBeGreaterThan(1);
        // chaque page porte sa pagination (« Page n / N »)
        r.pages.forEach((p, i) => expect(p.replace(/<[^>]+>/g, ' ')).toContain(`Page ${i + 1} / ${r.pageCount}`));
      }
    });
  }
});

describe('recouvrement « comme le logiciel de bureau »', () => {
  const lignes = [
    { code_cli: '102', raison: 'LABO BEN SALEM', nb_pieces: 3, net_a_payer: 500000, regler: 200000, reste_a_payer: 300000, plus_ancienne: '2026-03-02', derniere: '2026-08-30' },
    { code_cli: '049', raison: 'PHARMACIE ZEROUAL', nb_pieces: 1, net_a_payer: 200000, regler: 49999.5, reste_a_payer: 150000.5, plus_ancienne: '2026-07-07', derniere: '2026-07-07' },
  ];
  const pieces = [
    { code: 'BL N° 1261/2026', operation: 'Bon de Livraison', date_piece: '2026-07-07', code_cli: '049', raison: 'PHARMACIE ZEROUAL', net_a_payer: 200000, regler: 49999.5, reste_a_payer: 150000.5 },
    { code: 'FA N° 0042/2026', operation: 'Facture Client', date_piece: '2026-03-02', code_cli: '102', raison: 'LABO BEN SALEM', net_a_payer: 500000, regler: 200000, reste_a_payer: 300000 },
    { code: 'BL N° 1295/2026', operation: 'Bon de Livraison', date_piece: '2026-08-30', code_cli: '102', raison: 'LABO BEN SALEM', net_a_payer: 100000, regler: 0, reste_a_payer: 100000 },
  ];

  it('les totaux sont ceux des lignes, jamais un solde client', () => {
    const r = donneesRecouvrementBureau({ rows: lignes, nbrjour: 30, annee: 2026, detail: false }) as any;
    expect(r.Etat).toMatchObject({ nb_clients: 2, nb_pieces: 4, net_a_payer: 700000, regler: 249999.5, reste_a_payer: 450000.5, total_du: 450000.5 });
    expect(r.Etat.critere).toContain('30 jours');
    expect(r.Clients).toHaveLength(2);
    expect(r.Pieces).toEqual([]);
    const p = donneesRecouvrementBureau({ rows: pieces, nbrjour: 0, annee: 2026, detail: true }) as any;
    expect(p.Etat).toMatchObject({ nb_clients: 2, nb_pieces: 3, reste_a_payer: 550000.5 });
    expect(p.Pieces).toHaveLength(3);
    expect(p.Clients).toEqual([]);
  });

  for (const [id, detail, rows, attendu] of [
    ['integre-recouvrement-bureau', false, lignes, 'LABO BEN SALEM'],
    ['integre-recouvrement-bureau-pieces', true, pieces, 'BL N° 1261/2026'],
  ] as const) {
    it(`${id} : le modèle livré imprime les lignes et le total à recouvrer, sans avertissement`, () => {
      const def = MODELES_INTEGRES.find((m) => m.id === id)!.build();
      expect(def.kind).toBe('recouvrement');
      const data = donneesRecouvrementBureau({ rows: [...rows] as never, nbrjour: 30, annee: 2026, detail });
      const res = rendreEtat(def, data, { mesureur });
      expect(res.warnings).toEqual([]);
      expect(res.html).toContain(attendu);
      expect(res.html).toContain('TOTAL À RECOUVRER');
    });
  }

  it('le modèle par défaut du type reste le recouvrement par solde client', () => {
    expect(MODELES_INTEGRES.filter((m) => m.build().kind === 'recouvrement').map((m) => m.id)[0]).toBe('integre-recouvrement');
  });
});
