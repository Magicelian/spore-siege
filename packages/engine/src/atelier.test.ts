import { describe, expect, it } from 'vitest';
import { CAPACITES_DE, etoilesDepensees, etoilesPour, TOUTES_CAPACITES } from './contenu';
import { Partie } from './partie';
import { ileDe, NIVEAUX_FORET } from './niveaux';

describe('Atelier', () => {
  it('coûte 1 étoile pour la 1re capacité d\'une tour, 2 pour la seconde, 12 pour tout', () => {
    expect(etoilesPour('essaim', [])).toBe(1);
    expect(etoilesPour('dard', ['essaim'])).toBe(2);
    expect(etoilesPour('dard', ['tempete'])).toBe(1);
    expect(etoilesPour('essaim', ['essaim'])).toBe(0);
    expect(etoilesDepensees(TOUTES_CAPACITES)).toBe(12);
    expect(etoilesDepensees(['essaim', 'tempete', 'prisme'])).toBe(4);
    expect(TOUTES_CAPACITES).toHaveLength(8);
  });

  it('refuse une capacité fermée et accepte une ouverte', () => {
    const niveau = NIVEAUX_FORET[0]!;
    const partie = new Partie(ileDe(niveau), niveau.vagues, 1, { spores: 5000, capacites: ['dard'] });
    const libre = [...Array(ileDe(niveau).largeur * ileDe(niveau).profondeur).keys()]
      .map((k) => ({ x: k % ileDe(niveau).largeur, y: Math.floor(k / ileDe(niveau).largeur) }))
      .find((c) => partie.libre(c))!;
    expect(partie.executer({ type: 'poserTour', tour: 'ruche', case: libre })).toBe(true);
    const id = partie.instantane().tours[0]!.id;
    partie.executer({ type: 'ameliorerTour', id });
    partie.executer({ type: 'ameliorerTour', id });
    expect(partie.instantane().tours[0]!.stade).toBe(3);
    expect(partie.executer({ type: 'choisirCapacite', id, capacite: CAPACITES_DE.ruche[0] })).toBe(false);
    expect(partie.executer({ type: 'choisirCapacite', id, capacite: 'dard' })).toBe(true);
    expect(partie.instantane().regles.capacites).toEqual(['dard']);
  });
});
