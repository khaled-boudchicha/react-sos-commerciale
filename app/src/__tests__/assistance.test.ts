import { describe, expect, it } from 'vitest';
import { ajouterErreur, type ErreurApp } from '../lib/journalErreurs';
import { rapportDiagnostic } from '../lib/rapportDiagnostic';

describe('journal des erreurs de l’application', () => {
  it('regroupe les répétitions rapprochées et borne la taille', () => {
    let j: ErreurApp[] = [];
    j = ajouterErreur(j, { origine: 'ecran', message: 'x', ecran: '/ventes' }, 1_000);
    j = ajouterErreur(j, { origine: 'ecran', message: 'x', ecran: '/ventes' }, 20_000);
    expect(j).toHaveLength(1);
    expect(j[0]).toMatchObject({ n: 2, debut: 1_000, fin: 20_000 });
    j = ajouterErreur(j, { origine: 'script', message: 'x', ecran: '/' }, 21_000);
    expect(j).toHaveLength(2);
    for (let i = 0; i < 40; i++) j = ajouterErreur(j, { origine: 'promesse', message: `e${i}`, ecran: '/' }, 100_000 + i);
    expect(j).toHaveLength(30);
    expect(j[0].message).toBe('e39');
  });
});

describe('rapport de diagnostic', () => {
  const base = {
    version: '0.4.0', plateforme: 'win32', date: new Date('2026-11-01T10:00:00Z'),
    agent: 'Pharmacie Centrale', dossier: 'GC_2026', utilisateur: 'caisse1', connexion: 'Serveur injoignable',
    protectionSession: 'chiffrée (coffre du système)', derniereReponse: Date.UTC(2026, 10, 1, 9, 58),
    cache: { articles: 120, reponses: 3 },
    controles: [{ libelle: 'Serveur cloud (GraphQL)', etat: 'ko', detail: 'Serveur injoignable', ms: 35000 }],
    incidents: [{ debut: Date.UTC(2026, 10, 1, 9, 59), fin: Date.UTC(2026, 10, 1, 10, 0), operation: 'MyAgents', message: 'Serveur injoignable', n: 4 }],
    erreurs: [{ debut: Date.UTC(2026, 10, 1, 9, 50), fin: Date.UTC(2026, 10, 1, 9, 50), n: 1, origine: 'ecran' as const, message: 'Cannot read properties of undefined', ecran: '/stock', pile: 'TypeError: …\n    at Stock (Stock.tsx:12)\n    at div' }],
  };
  it('contient l’essentiel pour le support', () => {
    const t = rapportDiagnostic(base);
    for (const attendu of ['0.4.0', 'win32', 'Pharmacie Centrale', 'GC_2026', 'caisse1', 'Serveur injoignable', '120 article(s)',
      'MyAgents', '4 fois', '/stock', 'Cannot read properties of undefined', 'at Stock (Stock.tsx:12)', '35000 ms']) {
      expect(t).toContain(attendu);
    }
  });
  it('sans incident ni erreur : le dit explicitement', () => {
    const t = rapportDiagnostic({ ...base, incidents: [], erreurs: [], controles: [] });
    expect(t).toContain('Incidents réseau (0)');
    expect(t).toContain('aucune');
  });
});
