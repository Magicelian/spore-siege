import { describe, expect, it } from 'vitest';
import { PLATEFORME, prixPour, TOURS, type Vague } from './contenu';
import { ileDe, NIVEAUX_FUTAIE } from './niveaux';
import { constructible, Partie, surPlateforme } from './partie';

const niveau = NIVEAUX_FUTAIE[0]!;
const ile = ileDe(niveau);
const vagues: Vague[] = [[{ type: 'limace', nombre: 1, intervalle: 1 }]];
/** Une plateforme et une case d'herbe de l'Allée des géants. */
const haut = { x: 12, y: 9 };
const sol = { x: 9, y: 8 };

describe('plateformes de la futaie', () => {
  it('la carte en a, et toute tour de terre s’y pose (pas le héron)', () => {
    expect(surPlateforme(ile, haut)).toBe(true);
    expect(surPlateforme(ile, sol)).toBe(false);
    expect(constructible(ile, haut, 'canon')).toBe(true);
    expect(constructible(ile, haut, 'heron')).toBe(false);
  });

  it('une tour en hauteur voit 1 case plus loin et coûte 30 % plus cher, améliorations comprises', () => {
    const p = new Partie(ile, vagues, 1, { spores: 1000 });
    expect(p.executer({ type: 'poserTour', tour: 'ruche', case: haut })).toBe(true);
    expect(p.executer({ type: 'poserTour', tour: 'ruche', case: sol })).toBe(true);
    const [h, s] = p.instantane().tours;
    expect(1000 - p.instantane().spores).toBe(TOURS.ruche.stades[0].prix + prixPour(TOURS.ruche.stades[0].prix, true));
    expect(h!.haute).toBe(true);
    expect(s!.haute).toBe(false);
    expect(h!.portee).toBe(s!.portee + PLATEFORME.portee);
    expect(h!.prixAmelioration).toBe(Math.round(s!.prixAmelioration! * PLATEFORME.surcout));
    expect(h!.revente).toBeGreaterThan(s!.revente);
  });

  it('ni fleur ni lanterne sur une plateforme', () => {
    const p = new Partie(ile, vagues, 1, { fleurs: true, noir: true });
    expect(p.fleurLibre(haut)).toBe(false);
    expect(p.lanterneLibre(haut)).toBe(false);
    expect(p.fleurLibre(sol)).toBe(true);
  });
});
