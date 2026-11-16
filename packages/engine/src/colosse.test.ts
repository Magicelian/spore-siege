import { describe, expect, it } from 'vitest';
import { MONSTRES, prixPour, TOURS, type Vague } from './contenu';
import { ileDe, NIVEAUX_FUTAIE } from './niveaux';
import { Partie } from './partie';

const ile = ileDe(NIVEAUX_FUTAIE[0]!);
/** Plage 0 de l'Allée des géants = nord-est : la plateforme (15, 5) est la plus proche de l'arrivée du Colosse. */
const proche = { x: 15, y: 5 };
const loin = [{ x: 12, y: 9 }, { x: 6, y: 12 }];
const vagues: Vague[] = [[{ type: 'colosse', nombre: 1, intervalle: 1, plage: 0 }], [{ type: 'limace', nombre: 1, intervalle: 1, plage: 0 }]];
const interne = (p: Partie) => (p as unknown as { monstres: { type: string; pv: number }[] }).monstres;
const pv = MONSTRES.colosse.pv;

function lancee(cases = [proche, ...loin]): Partie {
  const p = new Partie(ile, vagues, 1, { spores: 5000 });
  for (const c of cases) expect(p.executer({ type: 'poserTour', tour: 'canon', case: c })).toBe(true);
  // Une tour au sol : jamais touchée par la frappe.
  expect(p.executer({ type: 'poserTour', tour: 'ruche', case: { x: 17, y: 4 } })).toBe(true);
  p.executer({ type: 'lancerVague' });
  for (let n = 0; n < 200 && interne(p).length === 0; n++) p.avancer();
  return p;
}

describe("Colosse d'écorce", () => {
  it('à un palier, abat la plateforme occupée la plus proche : tour détruite, moitié remboursée, case perdue', () => {
    const p = lancee();
    const avant = p.instantane();
    interne(p)[0]!.pv = pv * 0.74;
    p.avancer();
    const i = p.instantane();
    expect(i.evenements.filter((e) => e.type === 'frappe')).toHaveLength(1);
    const chutes = i.evenements.filter((e) => e.type === 'chute');
    expect(chutes).toHaveLength(1);
    expect(chutes[0]!.type === 'chute' && chutes[0]!.case).toEqual(proche);
    const rendu = Math.floor(prixPour(TOURS.canon.stades[0]!.prix, true) * 0.5);
    expect(chutes[0]!.type === 'chute' && chutes[0]!.rembourse).toBe(rendu);
    expect(i.tours).toHaveLength(avant.tours.length - 1);
    expect(i.tours.some((t) => t.case.x === proche.x && t.case.y === proche.y)).toBe(false);
    expect(i.plateformesTombees).toEqual([proche]);
    expect(p.libre(proche)).toBe(false);
    expect(p.executer({ type: 'poserTour', tour: 'ruche', case: proche })).toBe(false);
  });

  it('un gros coup qui franchit plusieurs paliers abat une plateforme par palier', () => {
    const p = lancee();
    interne(p)[0]!.pv = pv * 0.2;
    p.avancer();
    const i = p.instantane();
    expect(i.evenements.filter((e) => e.type === 'chute')).toHaveLength(3);
    expect(i.tours).toHaveLength(1);
    expect(i.tours[0]!.type).toBe('ruche');
  });

  it('sans plateforme occupée, il frappe le sol sans rien abattre', () => {
    const p = lancee([]);
    interne(p)[0]!.pv = pv * 0.74;
    p.avancer();
    const i = p.instantane();
    expect(i.evenements.filter((e) => e.type === 'frappe')).toHaveLength(1);
    expect(i.evenements.filter((e) => e.type === 'chute')).toHaveLength(0);
    expect(i.plateformesTombees).toEqual([]);
    expect(i.tours).toHaveLength(1);
  });
});
