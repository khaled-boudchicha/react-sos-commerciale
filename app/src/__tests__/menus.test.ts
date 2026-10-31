import { describe, expect, it } from 'vitest';
import { nextByLetter, placeMenu } from '../components/ui/ContextMenu';
import { placeTooltip, touchesRaccourci } from '../components/ui/Tooltip';
import { versContextMenu } from '../navigation/MenuFlottant';

const ecran = { width: 1000, height: 800 };
const rect = (left: number, top: number, w: number, h: number) => ({ left, top, right: left + w, bottom: top + h });

describe('ContextMenu — position', () => {
  it('au point du clic quand il y a la place', () => {
    expect(placeMenu({ x: 100, y: 120 }, { width: 260, height: 200 }, ecran)).toEqual({ left: 100, top: 120 });
  });

  it('ramené dans la fenêtre à droite, retourné au-dessus du point en bas', () => {
    expect(placeMenu({ x: 900, y: 700 }, { width: 260, height: 200 }, ecran)).toEqual({ left: 1000 - 260 - 8, top: 500 });
  });

  it('sous un bouton : aligné à gauche (start) ou à droite (end), au-dessus si la place manque', () => {
    const b = rect(300, 40, 80, 30);
    expect(placeMenu(b, { width: 200, height: 100 }, ecran, 'start')).toEqual({ left: 300, top: 74 });
    expect(placeMenu(b, { width: 200, height: 100 }, ecran, 'end')).toEqual({ left: 180, top: 74 });
    const bas = rect(300, 740, 80, 30);
    expect(placeMenu(bas, { width: 200, height: 100 }, ecran)).toEqual({ left: 300, top: 740 - 4 - 100 });
  });

  it('jamais hors de la fenêtre, même pour un menu plus haut que l’écran', () => {
    const p = placeMenu({ x: -50, y: 10 }, { width: 260, height: 2000 }, ecran);
    expect(p.left).toBe(8);
    expect(p.top).toBe(8);
  });
});

describe('ContextMenu — saut par lettre', () => {
  const libelles = ['Ouvrir', 'Dupliquer', 'Imprimer', 'Détails', 'Supprimer', 'Élément'];
  it('va au libellé suivant qui commence par la lettre, en boucle', () => {
    expect(nextByLetter(libelles, 0, 'd')).toBe(1);
    expect(nextByLetter(libelles, 1, 'D')).toBe(3);
    expect(nextByLetter(libelles, 3, 'd')).toBe(1);
    expect(nextByLetter(libelles, -1, 's')).toBe(4);
  });
  it('ignore les accents et rend -1 sans correspondance', () => {
    expect(nextByLetter(libelles, 0, 'e')).toBe(5);
    expect(nextByLetter(libelles, 0, 'é')).toBe(5);
    expect(nextByLetter(libelles, 0, 'z')).toBe(-1);
    expect(nextByLetter([], 0, 'a')).toBe(-1);
  });
});

describe('Tooltip — position', () => {
  const taille = { width: 120, height: 30 };
  it('au-dessus, centrée sur l’élément', () => {
    expect(placeTooltip(rect(400, 300, 40, 30), taille, ecran)).toEqual({ left: 360, top: 264, side: 'top' });
  });
  it('retournée en dessous quand la place manque en haut (et inversement)', () => {
    expect(placeTooltip(rect(400, 10, 40, 30), taille, ecran, 'top')).toMatchObject({ top: 46, side: 'bottom' });
    expect(placeTooltip(rect(400, 760, 40, 30), taille, ecran, 'bottom')).toMatchObject({ top: 724, side: 'top' });
  });
  it('alignée à gauche (info-bulles du ruban) et maintenue dans la fenêtre', () => {
    expect(placeTooltip(rect(950, 50, 30, 30), { width: 280, height: 80 }, ecran, 'bottom', 'start')).toEqual({ left: 1000 - 280 - 8, top: 86, side: 'bottom' });
    expect(placeTooltip(rect(0, 300, 20, 20), taille, ecran)).toMatchObject({ left: 8 });
  });
  it('raccourci découpé en touches', () => {
    expect(touchesRaccourci('Ctrl+Maj+S')).toEqual(['Ctrl', 'Maj', 'S']);
    expect(touchesRaccourci('Ctrl++')).toEqual(['Ctrl', '+']);
    expect(touchesRaccourci('F10')).toEqual(['F10']);
  });
});

describe('MenuFlottant (adaptateur du ruban)', () => {
  it('traduit les éléments français vers ContextMenuItem', () => {
    const f = () => undefined;
    expect(versContextMenu('separateur')).toBe('separator');
    expect(versContextMenu({ titre: 'T' })).toEqual({ heading: 'T' });
    expect(versContextMenu({ libelle: 'A', icone: 'plus', kbd: 'Ctrl+F1', ton: 'danger', desactive: true, coche: false, radio: true, garderOuvert: true, onSelect: f }))
      .toEqual({ label: 'A', icon: 'plus', kbd: 'Ctrl+F1', tone: 'danger', disabled: true, checked: false, radio: true, keepOpen: true, onSelect: f });
  });
});
