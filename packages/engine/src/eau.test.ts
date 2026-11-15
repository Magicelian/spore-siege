import { describe, expect, it } from 'vitest';
import { CARTE_ROSELIERE, lireCarte } from './carte';
import type { Vague } from './contenu';
import { constructible, Partie } from './partie';
import { route } from './sentier';

const roseliere = lireCarte(CARTE_ROSELIERE, 'marais');
const sansGues = lireCarte(CARTE_ROSELIERE.map((l) => l.replaceAll('g', '=')), 'marais');
const uneLimace: Vague[] = [[{ type: 'limace', nombre: 1, intervalle: 1 }]];

/** Pas écoulés entre le lancement de la vague et la première morsure. */
function tempsJusquaSouche(partie: Partie): number {
  partie.executer({ type: 'lancerVague' });
  for (let n = 1; n < 20_000; n++) {
    partie.avancer();
    if (partie.instantane().souche.pv < 20) return n;
  }
  return Infinity;
}

describe('eau du marais', () => {
  it('les gués font partie du sentier : une seule plage, un carrefour', () => {
    const p = new Partie(roseliere, uneLimace, 1);
    expect(p.sentier.plages).toHaveLength(1);
    expect(p.sentier.carrefours).toEqual([{ x: 16, y: 5 }]);
  });

  it('les gués ralentissent les monstres', () => {
    const avec = tempsJusquaSouche(new Partie(roseliere, uneLimace, 1));
    const sans = tempsJusquaSouche(new Partie(sansGues, uneLimace, 1));
    expect(avec).toBeGreaterThan(sans * 1.1);
  });

  it('les tours de terre vont sur l’herbe et les nénuphars, pas sur l’eau ni les gués', () => {
    expect(constructible(roseliere, { x: 10, y: 4 }, 'ruche')).toBe(true); // nénuphar
    expect(constructible(roseliere, { x: 11, y: 4 }, 'ruche')).toBe(false); // eau
    expect(constructible(roseliere, { x: 13, y: 5 })).toBe(false); // gué, pour aucune tour
  });

  it('pas de ronce dans un gué ; celle de (15, 5) ferme le raccourci', () => {
    const p = new Partie(roseliere, uneLimace, 1);
    expect(p.emplacementsRonces.map((c) => `${c.x},${c.y}`).sort()).toEqual(['15,5', '16,4', '16,6']);
    const depart = p.sentier.plages[0]!.depart;
    const court = route(roseliere, depart)!.length;
    const long = route(roseliere, depart, new Set(['15,5']))!.length;
    expect(long).toBeGreaterThan(court * 2);
  });
});
