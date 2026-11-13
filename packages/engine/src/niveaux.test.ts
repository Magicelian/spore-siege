import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { SPORES_DEPART, TYPES_TOURS, type Vague } from './contenu';
import { NIVEAUX_FORET, partieDe } from './niveaux';
import { Partie } from './partie';

const ile = ileForet();
const vagues: Vague[] = [[{ type: 'limace', nombre: 1, intervalle: 1 }]];
/** Une case d'herbe libre de la forêt. */
const herbe = { x: 2, y: 5 };

describe('règles des niveaux', () => {
  it('sans contrainte : 120 spores, 4 tours, ronces permises', () => {
    const p = new Partie(ile, vagues, 1);
    expect(p.instantane().regles).toEqual({ spores: SPORES_DEPART, tours: TYPES_TOURS, ronces: true });
  });

  it('les spores de départ suivent le niveau', () => {
    expect(new Partie(ile, vagues, 1, { spores: 80 }).instantane().spores).toBe(80);
  });

  it('une tour interdite ne se pose pas', () => {
    const p = new Partie(ile, vagues, 1, { tours: ['cristal', 'canon'] });
    expect(p.executer({ type: 'poserTour', tour: 'ruche', case: herbe })).toBe(false);
    expect(p.executer({ type: 'poserTour', tour: 'cristal', case: herbe })).toBe(true);
  });

  it('sans ronces, aucune entrée de branche ne peut être fermée', () => {
    const p = new Partie(ile, vagues, 1, { ronces: false });
    for (const c of p.emplacementsRonces) {
      expect(p.ronceLibre(c)).toBe(false);
      expect(p.executer({ type: 'poserRonce', case: c })).toBe(false);
    }
  });

  it('chaque niveau de la forêt se lance', () => {
    for (const n of NIVEAUX_FORET) expect(partieDe(n, 1).instantane().vagues).toBe(n.vagues.length);
  });
});
