import { describe, expect, it } from 'vitest';
import { FLEUR, type Vague } from './contenu';
import { ileDe, NIVEAUX_PRAIRIE } from './niveaux';
import { Partie } from './partie';
import { route } from './sentier';

const pres = NIVEAUX_PRAIRIE[0]!;
const ile = ileDe(pres);
const uneLimace: Vague[] = [
  [{ type: 'limace', nombre: 1, intervalle: 1 }],
  [{ type: 'limace', nombre: 1, intervalle: 1 }],
];
const herbe = { x: 4, y: 2 };

/** Avance jusqu'à la fin de la vague en cours (retour en pause ou fin de partie). */
function finirVague(p: Partie): void {
  for (let n = 0; n < 20_000 && p.instantane().phase === 'vague'; n++) p.avancer();
}

describe('fleurs à spores', () => {
  it('Prés fleuris : deux plages, ronces qui allongent le chemin', () => {
    const p = new Partie(ile, uneLimace, 1, pres.regles);
    expect(p.sentier.plages).toHaveLength(2);
    const ouest = p.sentier.plages.find((pl) => pl.depart.x < 5)!;
    const court = route(ile, ouest.depart, new Set())!.length;
    const long = route(ile, ouest.depart, new Set(['7,7']))!.length;
    expect(long).toBeGreaterThan(court + 10);
  });

  it('se plante sur l’herbe libre, coûte son prix et occupe la case', () => {
    const p = new Partie(ile, uneLimace, 1, pres.regles);
    const avant = p.instantane().spores;
    expect(p.executer({ type: 'planterFleur', case: herbe })).toBe(true);
    const i = p.instantane();
    expect(i.spores).toBe(avant - FLEUR.prix);
    expect(i.fleurs).toEqual([{ id: expect.any(Number), case: herbe, revente: Math.floor(FLEUR.prix * FLEUR.partRendue) }]);
    expect(p.libre(herbe)).toBe(false);
    expect(p.executer({ type: 'poserTour', tour: 'ruche', case: herbe })).toBe(false);
    expect(p.executer({ type: 'planterFleur', case: herbe })).toBe(false);
  });

  it('refusée sur le sentier, sous une tour, sans assez de spores ou hors de la prairie', () => {
    const p = new Partie(ile, uneLimace, 1, pres.regles);
    expect(p.executer({ type: 'planterFleur', case: { x: 6, y: 5 } })).toBe(false); // sentier
    p.executer({ type: 'poserTour', tour: 'ruche', case: herbe });
    expect(p.fleurLibre(herbe)).toBe(false);
    const pauvre = new Partie(ile, uneLimace, 1, { ...pres.regles, spores: FLEUR.prix - 1 });
    expect(pauvre.executer({ type: 'planterFleur', case: herbe })).toBe(false);
    const ailleurs = new Partie(ile, uneLimace, 1, { spores: 500 });
    expect(ailleurs.executer({ type: 'planterFleur', case: herbe })).toBe(false);
  });

  it('rapporte à chaque fin de vague, avec un événement de récolte', () => {
    const p = new Partie(ile, uneLimace, 1, { ...pres.regles, spores: 500 });
    const sans = new Partie(ile, uneLimace, 1, { ...pres.regles, spores: 500 - FLEUR.prix });
    p.executer({ type: 'planterFleur', case: herbe });
    for (const q of [p, sans]) {
      q.executer({ type: 'poserTour', tour: 'cristal', case: { x: 7, y: 6 } });
      q.executer({ type: 'lancerVague' });
      finirVague(q);
    }
    const i = p.instantane();
    expect(i.phase).toBe('pause');
    expect(i.spores - sans.instantane().spores).toBe(FLEUR.rapport);
    expect(i.evenements.filter((e) => e.type === 'recolte')).toEqual([
      { type: 'recolte', id: i.fleurs[0]!.id, case: herbe, gain: FLEUR.rapport, pas: expect.any(Number) },
    ]);
  });

  it('s’arrache contre la moitié de son prix et libère la case', () => {
    const p = new Partie(ile, uneLimace, 1, pres.regles);
    p.executer({ type: 'planterFleur', case: herbe });
    const { spores, fleurs } = p.instantane();
    expect(p.executer({ type: 'arracherFleur', id: fleurs[0]!.id })).toBe(true);
    expect(p.instantane().spores).toBe(spores + Math.floor(FLEUR.prix * FLEUR.partRendue));
    expect(p.instantane().fleurs).toEqual([]);
    expect(p.libre(herbe)).toBe(true);
  });
});
