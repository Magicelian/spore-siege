import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import type { Case, Ile } from './contrat';

/** Cases de sentier atteignables depuis `depart` en marchant sur le sentier (4 voisins). */
function sentierAtteint(ile: Ile, depart: Case): Set<string> {
  const vues = new Set<string>([`${depart.x},${depart.y}`]);
  const file = [depart];
  for (const c of file) {
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const x = c.x + dx;
      const y = c.y + dy;
      if (x < 0 || y < 0 || x >= ile.largeur || y >= ile.profondeur) continue;
      if (ile.terrain[y * ile.largeur + x] !== 'sentier' || vues.has(`${x},${y}`)) continue;
      vues.add(`${x},${y}`);
      file.push({ x, y });
    }
  }
  return vues;
}

describe('île-forêt', () => {
  const ile = ileForet();

  it('fait 20 × 20 avec une souche 2 × 2 au centre', () => {
    expect([ile.largeur, ile.profondeur, ile.terrain.length]).toEqual([20, 20, 400]);
    expect(ile.souche).toEqual({ x: 9, y: 9 });
    expect(ile.tailleSouche).toBe(2);
  });

  it('relie chaque plage à la souche par le sentier', () => {
    for (const plage of [{ x: 2, y: 10 }, { x: 16, y: 1 }]) {
      const atteint = sentierAtteint(ile, plage);
      // Cases de sentier qui touchent la souche par le nord et par le sud.
      expect(atteint.has('9,8')).toBe(true);
      expect(atteint.has('9,11')).toBe(true);
    }
  });
});
