import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import type { ModeCible, TypeMonstre, TypeTour } from './contrat';
import { TOURS, type Vague } from './contenu';
import { Partie } from './partie';

const ile = ileForet();
/** Herbe juste au nord du sentier de l'ouest (ligne 7). */
const PRES = { x: 6, y: 6 };

// Une limace devant, un scarabée (armuré, plus de PV), plus lent, part en même temps.
const VAGUE: Vague[] = [
  [
    { type: 'limace', nombre: 1, intervalle: 1, plage: 1 },
    { type: 'scarabee', nombre: 1, intervalle: 1, debut: 0, plage: 1 },
  ],
];

/**
 * Le type visé par la tour, posée en pleine vague tout près des deux monstres (la limace a pris un peu d'avance), au
 * premier pas où elle vise.
 */
function viseEnPremier(tour: TypeTour, mode?: ModeCible): TypeMonstre | null {
  const p = new Partie(ile, VAGUE, 1, { spores: 999 });
  p.executer({ type: 'lancerVague' });
  for (let n = 0; n < 90; n++) p.avancer();
  const [a, b] = p.instantane().monstres;
  const milieu = { x: (a!.position.x + b!.position.x) / 2, y: (a!.position.y + b!.position.y) / 2 };
  let ici: { x: number; y: number } | null = null;
  for (let y = 0; y < ile.profondeur; y++)
    for (let x = 0; x < ile.largeur; x++)
      if (p.libre({ x, y }, tour) && (!ici || Math.hypot(x + 0.5 - milieu.x, y + 0.5 - milieu.y) < Math.hypot(ici.x + 0.5 - milieu.x, ici.y + 0.5 - milieu.y)))
        ici = { x, y };
  expect(p.executer({ type: 'poserTour', tour, case: ici! })).toBe(true);
  const id = p.instantane().tours[0]!.id;
  if (mode) expect(p.executer({ type: 'ciblerTour', id, mode })).toBe(true);
  for (let n = 0; n < 200; n++) {
    p.avancer();
    const i = p.instantane();
    const cible = i.tours[0]!.cible;
    if (cible !== null) return i.monstres.find((m) => m.id === cible)!.type;
  }
  return null;
}

describe('ciblage', () => {
  it('chaque tour a son mode de départ', () => {
    const p = new Partie(ile, VAGUE, 1, { spores: 999 });
    const modes: Partial<Record<TypeTour, ModeCible>> = {};
    for (const [k, tour] of (['ruche', 'cristal', 'mortier', 'canon'] as const).entries()) {
      p.executer({ type: 'poserTour', tour, case: { x: 5 + k, y: 6 } });
      modes[tour] = p.instantane().tours[k]!.mode;
    }
    expect(modes).toEqual({ ruche: 'premier', cristal: 'blinde', mortier: 'premier', canon: 'premier' });
    expect(TOURS.heron.cible ?? 'premier').toBe('premier');
  });

  it('Premier vise la limace de tête, Blindé et Plus forte le scarabée derrière', () => {
    expect(viseEnPremier('ruche')).toBe('limace');
    expect(viseEnPremier('ruche', 'blinde')).toBe('scarabee');
    expect(viseEnPremier('ruche', 'forte')).toBe('scarabee');
    expect(viseEnPremier('cristal')).toBe('scarabee');
    expect(viseEnPremier('cristal', 'premier')).toBe('limace');
  });

  it('refuse une tour inconnue ou un mode inconnu', () => {
    const p = new Partie(ile, VAGUE, 1);
    p.executer({ type: 'poserTour', tour: 'ruche', case: PRES });
    const id = p.instantane().tours[0]!.id;
    expect(p.executer({ type: 'ciblerTour', id: id + 99, mode: 'forte' })).toBe(false);
    expect(p.executer({ type: 'ciblerTour', id, mode: 'nimporte' as ModeCible })).toBe(false);
    expect(p.instantane().tours[0]!.mode).toBe('premier');
  });
});
