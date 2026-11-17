import { describe, expect, it } from 'vitest';
import type { Commande } from './contrat';
import { NIVEAUX_FORET, partieDe } from './niveaux';
import { reprendre, type Reprise } from './reprise';

describe('reprise', () => {
  it('rejoue une partie enregistrée en pleine vague, à l’identique', () => {
    const niveau = NIVEAUX_FORET[1]!;
    const r: Reprise = { niveau: niveau.id, graine: 42, capacites: [], difficulte: 'difficile', commandes: [], pas: 0 };
    const p = partieDe(niveau, r.graine, r.capacites, r.difficulte);
    const jouer = (commande: Commande) => {
      if (p.executer(commande)) r.commandes.push({ pas: p.pasJoues, commande });
    };
    const cases = p.ile.terrain.flatMap((_, i) => {
      const c = { x: i % p.ile.largeur, y: Math.floor(i / p.ile.largeur) };
      return p.libre(c, 'ruche') ? [c] : [];
    });
    jouer({ type: 'poserTour', tour: 'ruche', case: cases[40]! });
    for (let n = 0; n < 300; n++) p.avancer();
    jouer({ type: 'lancerVague' });
    for (let n = 0; n < 200; n++) p.avancer();
    jouer({ type: 'poserTour', tour: 'cristal', case: cases[80]! });
    jouer({ type: 'ameliorerTour', id: p.instantane().tours[0]!.id });
    for (let n = 0; n < 200; n++) p.avancer();
    r.pas = p.pasJoues;
    expect(p.instantane().phase).toBe('vague');
    expect(p.instantane().monstres.length).toBeGreaterThan(0);

    const repris = reprendre(JSON.parse(JSON.stringify(r)) as Reprise)!;
    expect(repris.niveau.id).toBe(niveau.id);
    expect(repris.partie.pasJoues).toBe(p.pasJoues);
    expect(repris.partie.instantane()).toEqual(p.instantane());
  });

  it('ne reprend pas un niveau inconnu', () => {
    expect(reprendre({ niveau: 'nulle-part', graine: 1, capacites: [], difficulte: 'normal', commandes: [], pas: 0 })).toBeNull();
  });
});
