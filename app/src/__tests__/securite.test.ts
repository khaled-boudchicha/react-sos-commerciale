import { describe, expect, it } from 'vitest';
import { urlCloudValide } from '../store/session';

describe('URL du serveur cloud', () => {
  it('accepte uniquement HTTPS en production', () => {
    expect(urlCloudValide('https://api.druxamed.com/graphql', false)).toBe(true);
    expect(urlCloudValide('http://api.druxamed.com/graphql', false)).toBe(false);
    expect(urlCloudValide('http://localhost:3001/graphql', false)).toBe(false);
    expect(urlCloudValide('ftp://x/graphql', false)).toBe(false);
    expect(urlCloudValide('javascript:alert(1)', false)).toBe(false);
    expect(urlCloudValide('', false)).toBe(false);
    expect(urlCloudValide(undefined, false)).toBe(false);
    expect(urlCloudValide('pas une url', false)).toBe(false);
  });
  it('tolère http://localhost seulement en développement', () => {
    expect(urlCloudValide('http://localhost:3001/graphql', true)).toBe(true);
    expect(urlCloudValide('http://127.0.0.1:3001/graphql', true)).toBe(true);
    expect(urlCloudValide('http://192.168.1.10:3001/graphql', true)).toBe(false);
    expect(urlCloudValide('http://druxamed.com/graphql', true)).toBe(false);
  });
});
