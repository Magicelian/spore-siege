import { describe, expect, it } from 'vitest';
import { MONSTRES, PAS_PAR_SECONDE, type Vague } from './contenu';
import { ileDe, NIVEAUX_FUTAIE } from './niveaux';
import { Partie } from './partie';
import { lireSentier, route } from './sentier';

const ile = ileDe(NIVEAUX_FUTAIE[0]!);
/** Plage 0 de l'Allée des géants = nord-est ; la plateforme (15, 5) borde son sentier. */
const plateforme = { x: 15, y: 5 };
const une = (type: 'araignee' | 'ecureuil', plage = 0): Vague[] => [
  [{ type, nombre: 1, intervalle: 1, plage }],
  [{ type: 'limace', nombre: 1, intervalle: 1 }],
];
const avancer = (p: Partie, secondes: number) => {
  for (let i = 0; i < secondes * PAS_PAR_SECONDE; i++) p.avancer();
};

describe('Araignée', () => {
  it('tombe au milieu de la route de sa plage, pas sur la plage, et n’est pas annoncée sur la plage', () => {
    const p = new Partie(ile, une('araignee'), 1);
    expect(p.instantane().arrivees).toEqual([]);
    p.executer({ type: 'lancerVague' });
    avancer(p, 0.1);
    const m = p.instantane().monstres[0]!;
    expect(m.type).toBe('araignee');
    expect(m.descente).toBeGreaterThan(0.8);
    const depart = lireSentier(ile).plages[0]!.depart;
    const chemin = route(ile, depart, new Set())!;
    const rang = chemin.findIndex((c) => c.x === Math.floor(m.position.x) && c.y === Math.floor(m.position.y));
    expect(rang).toBeGreaterThanOrEqual(Math.floor(chemin.length * 0.25));
    expect(rang).toBeLessThanOrEqual(Math.ceil(chemin.length * 0.7));
  });

  it('pendue à son fil, elle ne bouge pas et aucune tour ne la vise ; posée, elle file vers la souche', () => {
    const p = new Partie(ile, une('araignee'), 1, { spores: 1000 });
    p.executer({ type: 'lancerVague' });
    avancer(p, 0.1);
    const { position } = p.instantane().monstres[0]!;
    p.executer({ type: 'poserTour', tour: 'cristal', case: { x: Math.floor(position.x) + 1, y: Math.floor(position.y) + 1 } }) ||
      p.executer({ type: 'poserTour', tour: 'cristal', case: { x: Math.floor(position.x) - 1, y: Math.floor(position.y) - 1 } });
    avancer(p, MONSTRES.araignee.fil!.duree - 0.3);
    const pendue = p.instantane().monstres[0]!;
    expect(pendue.position).toEqual(position);
    expect(pendue.pv).toBe(pendue.pvMax);
    expect(p.instantane().tours.every((t) => t.cible === null)).toBe(true);
    avancer(p, 1);
    const posee = p.instantane().monstres[0];
    expect(posee?.descente ?? null).toBeNull();
  });
});

describe('Écureuil rouillé', () => {
  it('grimpe sur une tour en hauteur proche, la bloque quelques secondes, puis repart', () => {
    // Monstre très solide : la tour qu'il vise ne doit pas le tuer en route.
    const p = new Partie(ile, une('ecureuil'), 1, { spores: 1000, vieMonstres: 50 });
    expect(p.executer({ type: 'poserTour', tour: 'ruche', case: plateforme })).toBe(true);
    p.executer({ type: 'lancerVague' });
    let perche = -1;
    let bloquee = 0;
    let tirsBloquee = 0;
    let dernierTir = -1;
    for (let i = 0; i < 40 * PAS_PAR_SECONDE; i++) {
      p.avancer();
      const i2 = p.instantane();
      const m = i2.monstres[0];
      const t = i2.tours[0]!;
      if (m?.perche && perche < 0) perche = i2.pas;
      if (t.bloquee) {
        bloquee++;
        if (t.dernierTir !== dernierTir) tirsBloquee++;
      }
      dernierTir = t.dernierTir;
    }
    expect(perche).toBeGreaterThan(0);
    expect(bloquee / PAS_PAR_SECONDE).toBeCloseTo(MONSTRES.ecureuil.grimpeur!.duree, 0);
    expect(tirsBloquee).toBe(0);
  });

  it('ne s’occupe pas des tours au sol', () => {
    const p = new Partie(ile, une('ecureuil'), 1, { spores: 1000, vieMonstres: 50 });
    expect(p.executer({ type: 'poserTour', tour: 'ruche', case: { x: 15, y: 6 } })).toBe(true);
    p.executer({ type: 'lancerVague' });
    for (let i = 0; i < 20 * PAS_PAR_SECONDE; i++) {
      p.avancer();
      expect(p.instantane().monstres[0]?.perche ?? false).toBe(false);
      expect(p.instantane().tours[0]!.bloquee).toBe(false);
    }
  });
});
