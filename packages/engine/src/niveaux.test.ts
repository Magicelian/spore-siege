import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { SPORES_DEPART, TOUTES_CAPACITES, TYPES_TOURS, type Vague } from './contenu';
import { NIVEAUX_FORET, niveauOuvert, partieDe } from './niveaux';
import { Partie } from './partie';

const ile = ileForet();
const vagues: Vague[] = [[{ type: 'limace', nombre: 1, intervalle: 1 }]];
/** Une case d'herbe libre de la forêt. */
const herbe = { x: 2, y: 5 };

describe('règles des niveaux', () => {
  it('sans contrainte : 120 spores, toutes les tours, ronces permises, ni fleurs ni noir', () => {
    const p = new Partie(ile, vagues, 1);
    expect(p.instantane().regles).toEqual({ spores: SPORES_DEPART, tours: TYPES_TOURS, ronces: true, fleurs: false, noir: false, capacites: TOUTES_CAPACITES, vieMonstres: 1 });
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

describe('ouverture des niveaux', () => {
  const ids = NIVEAUX_FORET.map((n) => n.id);
  it('le premier est ouvert, les suivants avec une étoile au précédent', () => {
    expect(niveauOuvert(NIVEAUX_FORET, 0, {})).toBe(true);
    expect(niveauOuvert(NIVEAUX_FORET, 1, {})).toBe(false);
    expect(niveauOuvert(NIVEAUX_FORET, 1, { [ids[0]!]: 1 })).toBe(true);
  });
  it('le boss demande 8 étoiles sur les 4 niveaux d’avant', () => {
    const sept = { [ids[0]!]: 3, [ids[1]!]: 2, [ids[2]!]: 1, [ids[3]!]: 1 };
    expect(NIVEAUX_FORET[4]!.boss).toBe(true);
    expect(niveauOuvert(NIVEAUX_FORET, 4, sept)).toBe(false);
    expect(niveauOuvert(NIVEAUX_FORET, 4, { ...sept, [ids[3]!]: 2 })).toBe(true);
  });
});

describe('difficulté', () => {
  it('la vie des monstres suit la difficulté : 80 % / 100 % / 120 %', () => {
    const vie = (d: 'facile' | 'normal' | 'difficile') => {
      const p = partieDe(NIVEAUX_FORET[0]!, 1, undefined, d);
      p.executer({ type: 'lancerVague' });
      for (let i = 0; i < 400 && p.instantane().monstres.length === 0; i++) p.avancer();
      const m = p.instantane().monstres[0]!;
      expect(m.pv).toBe(m.pvMax);
      return m.pvMax;
    };
    const normal = vie('normal');
    expect(vie('facile')).toBe(Math.round(normal * 0.8));
    expect(vie('difficile')).toBe(Math.round(normal * 1.2));
  });
});
