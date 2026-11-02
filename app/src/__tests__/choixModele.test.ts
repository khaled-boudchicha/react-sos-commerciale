import { beforeEach, describe, expect, it } from 'vitest';
import { definirModeleParDefaut, definirVersionPersonnelle } from '@softly/report/core';
import { initialiserImpression } from '../impression';
import { choisirModele } from '../impression/choixModele';

initialiserImpression();

beforeEach(() => {
  const m = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (m.has(k) ? m.get(k)! : null),
    setItem: (k: string, v: string) => { m.set(k, String(v)); },
    removeItem: (k: string) => { m.delete(k); },
  };
});

const LISTE = [{ ref: 'fichier:Ticket (personnalisé).gcr' }, { ref: 'integre:integre-facture-a4' }, { ref: 'integre:integre-ticket-80' }];

describe('choix du modèle d’impression', () => {
  it('modèle imposé par l’écran, sinon défaut de l’utilisateur, sinon premier modèle', () => {
    expect(choisirModele({ kind: 'vente', modele: 'integre-ticket-80' }, LISTE)).toBe('integre:integre-ticket-80');
    expect(choisirModele({ kind: 'vente' }, LISTE)).toBe('fichier:Ticket (personnalisé).gcr');
    definirModeleParDefaut('vente', 'integre:integre-facture-a4');
    expect(choisirModele({ kind: 'vente' }, LISTE)).toBe('integre:integre-facture-a4');
  });

  it('un ticket personnalisé remplace le ticket livré, jamais la facture', () => {
    definirModeleParDefaut('vente', 'integre:integre-facture-a4');
    definirVersionPersonnelle('integre:integre-ticket-80', 'fichier:Ticket (personnalisé).gcr');
    expect(choisirModele({ kind: 'vente', modele: 'integre:integre-ticket-80' }, LISTE)).toBe('fichier:Ticket (personnalisé).gcr');
    expect(choisirModele({ kind: 'vente' }, LISTE)).toBe('integre:integre-facture-a4');
    // fichier supprimé : retour au ticket livré
    expect(choisirModele({ kind: 'vente', modele: 'integre-ticket-80' }, LISTE.slice(1))).toBe('integre:integre-ticket-80');
  });
});
