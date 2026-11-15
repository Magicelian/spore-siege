import { describe, expect, it } from 'vitest';
import { CARTE_ROSELIERE, lireCarte } from './carte';
import type { Vague } from './contenu';
import { constructible, Partie } from './partie';

const roseliere = lireCarte(CARTE_ROSELIERE, 'marais');
/** Couloir : les monstres arrivent de l'ouest sur la ligne 2 ; le héron, sur l'eau derrière la souche, les voit en file. */
const couloir = lireCarte(['.............', 'hhhhhhhhhhhhh', 's========SSe.', 'hhhhhhhhhSSe.', '.............'], 'marais');

function riche(ile = couloir, vague: Vague = [{ type: 'limace', nombre: 8, intervalle: 0.3 }]): Partie {
  const p = new Partie(ile, [vague], 1);
  (p as unknown as { spores: number }).spores = 9999;
  return p;
}

describe('nid de héron', () => {
  it('se pose sur l’eau et les nénuphars, jamais sur la terre ; les autres tours, l’inverse (nénuphar compris)', () => {
    expect(constructible(roseliere, { x: 11, y: 4 }, 'heron')).toBe(true); // eau
    expect(constructible(roseliere, { x: 10, y: 4 }, 'heron')).toBe(true); // nénuphar
    expect(constructible(roseliere, { x: 5, y: 5 }, 'heron')).toBe(false); // herbe
    expect(constructible(roseliere, { x: 7, y: 14 }, 'heron')).toBe(false); // gué
    expect(constructible(roseliere, { x: 11, y: 4 }, 'ruche')).toBe(false);
    expect(constructible(roseliere, { x: 10, y: 4 }, 'ruche')).toBe(true);
    expect(constructible(roseliere, { x: 11, y: 4 })).toBe(true); // au moins une tour
    const p = riche(roseliere);
    expect(p.executer({ type: 'poserTour', tour: 'heron', case: { x: 5, y: 5 } })).toBe(false);
    expect(p.executer({ type: 'poserTour', tour: 'heron', case: { x: 11, y: 4 } })).toBe(true);
  });

  it('un seul harpon blesse plusieurs monstres alignés', () => {
    const p = riche();
    p.executer({ type: 'poserTour', tour: 'heron', case: { x: 11, y: 2 } });
    p.executer({ type: 'lancerVague' });
    let tire = false;
    for (let n = 0; n < 2000; n++) {
      p.avancer();
      const i = p.instantane();
      if (i.projectiles.length > 0) tire = true;
      if (tire && i.projectiles.length === 0) break;
    }
    expect(tire).toBe(true);
    const blesses = p.instantane().monstres.filter((m) => m.pv < m.pvMax).length;
    expect(blesses).toBeGreaterThanOrEqual(3);
  });

  it('ne vise pas les volants', () => {
    const p = riche(couloir, [{ type: 'volant', nombre: 4, intervalle: 1 }]);
    p.executer({ type: 'poserTour', tour: 'heron', case: { x: 11, y: 2 } });
    p.executer({ type: 'lancerVague' });
    for (let n = 0; n < 4000 && p.instantane().phase === 'vague'; n++) p.avancer();
    expect(p.instantane().degats.heron).toBe(0);
  });
});
