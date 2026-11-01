import { describe, expect, it } from 'vitest';
import { lireCodeAppairage } from '../lib/appairage';
import { DelaiDepasseError, messageEchecCreation, messageTransport, resultatIncertain, traduireErreurTransport } from '../api/erreurs';
import { useSession } from '../store/session';
import { useComptoir } from '../screens/comptoir/comptoirStore';

describe('code d’appairage tolérant', () => {
  const attendu = { u: 'pharma', k: 'cle-123', a: 'AG-01' };
  it('JSON propre', () => {
    expect(lireCodeAppairage('{"u":"pharma","k":"cle-123","a":"AG-01"}')).toEqual(attendu);
  });
  it('abîmé par une messagerie : guillemets typographiques, insécables, texte autour, retours ligne', () => {
    expect(lireCodeAppairage('Voici le code : {“u”:“pharma”,\n “k”:“cle-123”, «a»:«AG-01»}​ merci')).toEqual(attendu);
  });
  it('clés sans guillemets ou guillemets simples', () => {
    expect(lireCodeAppairage("{u:'pharma', k:'cle-123', a:'AG-01'}")).toEqual(attendu);
  });
  it('JSON encodé en base64', () => {
    expect(lireCodeAppairage(btoa(JSON.stringify(attendu)))).toEqual(attendu);
  });
  it('u facultatif ; k et a obligatoires', () => {
    expect(lireCodeAppairage('{"k":"x","a":"y"}')).toEqual({ k: 'x', a: 'y' });
    expect(lireCodeAppairage('{"u":"x","k":"","a":"y"}')).toBeNull();
    expect(lireCodeAppairage('n’importe quoi')).toBeNull();
    expect(lireCodeAppairage('')).toBeNull();
  });
});

describe('messages de transport lisibles', () => {
  const http = (statusCode: number, result?: unknown) => Object.assign(new Error(`Response not successful: Received status code ${statusCode}`), { name: 'ServerError', statusCode, result });
  it('réseau, passerelle, serveur, refus', () => {
    expect(messageTransport(new TypeError('Failed to fetch'), true)).toMatch(/injoignable/);
    expect(messageTransport(new TypeError('Failed to fetch'), false)).toMatch(/Pas de connexion Internet/);
    expect(messageTransport(http(503))).toMatch(/momentanément indisponible \(HTTP 503\)/);
    expect(messageTransport(http(500))).toMatch(/Erreur du serveur/);
    expect(messageTransport(http(400, { errors: [{ message: 'Champ « date » invalide' }] }))).toBe('Champ « date » invalide');
    expect(messageTransport(http(429))).toMatch(/Trop de requêtes/);
    expect(messageTransport(Object.assign(new Error('Unexpected token <'), { name: 'ServerParseError' }))).toMatch(/inattendue/);
  });
  it('erreurs non réseau intactes', () => {
    expect(messageTransport(new Error('bug interne'))).toBeNull();
    expect(messageTransport(new DelaiDepasseError(35_000))).toBeNull();
  });
  it('traduction en place : propriétés conservées, original gardé, idempotente', () => {
    const e = http(503);
    const t = traduireErreurTransport(e);
    expect(t).toBe(e);
    expect(e.message).toMatch(/HTTP 503/);
    expect((e as { messageOriginal?: string }).messageOriginal).toMatch(/Received status code 503/);
    expect(e.statusCode).toBe(503);
    traduireErreurTransport(e);
    expect((e as { messageOriginal?: string }).messageOriginal).toMatch(/Received status code 503/);
  });
  it('création sans réponse : avertir du doublon possible', () => {
    const perdue = { networkError: new TypeError('Failed to fetch'), graphQLErrors: [] };
    expect(resultatIncertain(perdue)).toBe(true);
    expect(messageEchecCreation(perdue, 'la liste des ventes')).toMatch(/peut-être été enregistrée.*liste des ventes/);
    expect(messageEchecCreation({ message: 'Stock insuffisant', networkError: null, graphQLErrors: [{ message: 'Stock insuffisant' }] }, 'x')).toBe('Stock insuffisant');
  });
});

describe('session expirée', () => {
  it('déconnecte avec une explication, rien si déjà déconnecté', () => {
    // logout() touche window.gc (absent sous Node)
    (globalThis as { window?: unknown }).window ??= {};
    useSession.setState({ token: 't', motifDeconnexion: null });
    useSession.getState().expirerSession();
    expect(useSession.getState().token).toBeNull();
    expect(useSession.getState().motifDeconnexion).toMatch(/expiré/);
    useSession.getState().effacerMotifDeconnexion();
    useSession.getState().expirerSession();
    expect(useSession.getState().motifDeconnexion).toBeNull();
  });
});

describe('comptoir : tentative incertaine conservée avec le ticket', () => {
  it('modifie le ticket désigné même si un autre est actif', () => {
    const c = useComptoir.getState();
    c.charger('TEST');
    c.setActif(2);
    useComptoir.getState().majTicketA(0, (t) => ({ ...t, incertain: { net: 10, connus: [], utilisateur: 'a', moment: 1 } }));
    const { tickets } = useComptoir.getState();
    expect(tickets[0].incertain?.net).toBe(10);
    expect(tickets[2].incertain).toBeUndefined();
    useComptoir.getState().setActif(0);
    useComptoir.getState().viderTicket();
    expect(useComptoir.getState().tickets[0].incertain).toBeUndefined();
  });
});
