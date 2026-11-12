import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { BONUS_VAGUE, MONSTRES, PAUSE_SECONDES, PAS_PAR_SECONDE, SPORES_DEPART, TOURS, type Vague } from './contenu';
import { Partie } from './partie';

const ile = ileForet();
/** Herbe juste au nord du sentier de l'ouest (ligne 7), que la limace longe vers la souche. */
const PRES = { x: 6, y: 6 };

function jouerJusqua(partie: Partie, condition: () => boolean, max = 20_000): void {
  for (let n = 0; n < max && !condition(); n++) partie.avancer();
}

function seule(type: 'limace' | 'scarabee' | 'amas', nombre = 1, intervalle = 1): Vague[] {
  return [[{ type, nombre, intervalle, plage: 1 }]];
}

describe('tours', () => {
  it('se posent sur l’herbe libre, si les spores suffisent', () => {
    const partie = new Partie(ile, seule('limace'), 1);
    expect(partie.instantane().spores).toBe(SPORES_DEPART);
    expect(partie.executer({ type: 'poserTour', tour: 'ruche', case: PRES })).toBe(true);
    expect(partie.instantane().spores).toBe(SPORES_DEPART - TOURS.ruche.stades[0].prix);
    // Case prise, sentier, souche : refusé.
    expect(partie.executer({ type: 'poserTour', tour: 'ruche', case: PRES })).toBe(false);
    expect(partie.executer({ type: 'poserTour', tour: 'ruche', case: { x: 6, y: 7 } })).toBe(false);
    expect(partie.executer({ type: 'poserTour', tour: 'ruche', case: { x: 9, y: 9 } })).toBe(false);
    // Plus assez de spores.
    expect(partie.executer({ type: 'poserTour', tour: 'canon', case: { x: 7, y: 6 } })).toBe(false);
    expect(partie.instantane().tours).toHaveLength(1);
  });

  it('une ruche tue une limace avant la souche, qui lâche ses spores', () => {
    const partie = new Partie(ile, seule('limace'), 1);
    partie.executer({ type: 'poserTour', tour: 'ruche', case: PRES });
    jouerJusqua(partie, () => partie.instantane().phase === 'vague');
    const avant = partie.instantane().spores;
    jouerJusqua(partie, () => partie.instantane().phase !== 'vague');
    const fin = partie.instantane();
    expect(fin.phase).toBe('victoire');
    expect(fin.souche.pv).toBe(20);
    expect(fin.spores).toBe(avant + MONSTRES.limace.butin);
    expect(fin.evenements).toMatchObject([{ type: 'mort', monstre: 'limace', butin: MONSTRES.limace.butin }]);
  });

  it('l’armure du scarabée ne laisse passer qu’un dégât par abeille', () => {
    const partie = new Partie(ile, seule('scarabee'), 1);
    partie.executer({ type: 'poserTour', tour: 'ruche', case: PRES });
    const pv = MONSTRES.scarabee.pv;
    jouerJusqua(partie, () => (partie.instantane().monstres[0]?.pv ?? pv) < pv);
    expect(partie.instantane().monstres[0]!.pv).toBe(pv - 1);
  });

  it('l’amas se divise en deux petits en mourant', () => {
    const partie = new Partie(ile, seule('amas'), 1);
    partie.executer({ type: 'poserTour', tour: 'canon', case: PRES });
    jouerJusqua(partie, () => partie.instantane().monstres.some((m) => m.type === 'petitAmas'));
    const types = partie.instantane().monstres.map((m) => m.type);
    expect(types).toEqual(['petitAmas', 'petitAmas']);
  });

  it('le mortier ralentit et laisse une explosion', () => {
    const partie = new Partie(ile, seule('limace'), 1);
    partie.executer({ type: 'poserTour', tour: 'mortier', case: PRES });
    jouerJusqua(partie, () => partie.instantane().impacts.length > 0);
    const vue = partie.instantane();
    expect(vue.impacts[0]!.type).toBe('mortier');
    expect(vue.monstres[0]!.ralenti).toBe(true);
  });

  it('l’éclair du cristal rebondit sur les monstres voisins', () => {
    const partie = new Partie(ile, seule('limace', 4, 0.5), 1);
    partie.executer({ type: 'poserTour', tour: 'cristal', case: PRES });
    jouerJusqua(partie, () => partie.instantane().tours[0]!.dernierTir >= 0 && partie.instantane().monstres.length >= 3);
    // Tour, première cible, puis deux rebonds au stade 1.
    expect(partie.instantane().tours[0]!.chaine).toHaveLength(4);
  });

  it('s’améliorent jusqu’au stade 3 et se revendent à 70 % du prix payé', () => {
    const partie = new Partie(ile, seule('limace'), 1);
    partie.executer({ type: 'poserTour', tour: 'ruche', case: PRES });
    const id = partie.instantane().tours[0]!.id;
    expect(partie.executer({ type: 'ameliorerTour', id })).toBe(true);
    const tour = partie.instantane().tours[0]!;
    expect(tour.stade).toBe(2);
    expect(tour.portee).toBe(TOURS.ruche.stades[1].portee);
    expect(tour.revente).toBe(63);
    expect(partie.executer({ type: 'vendreTour', id })).toBe(true);
    expect(partie.instantane().spores).toBe(SPORES_DEPART - 90 + 63);
    expect(partie.instantane().tours).toHaveLength(0);
  });

  it('refuse une 3e amélioration', () => {
    const partie = new Partie(ile, seule('limace'), 1);
    partie.executer({ type: 'poserTour', tour: 'ruche', case: PRES });
    const id = partie.instantane().tours[0]!.id;
    partie.executer({ type: 'ameliorerTour', id });
    // 120 − 50 − 40 = 30 : pas assez pour le stade 3 (70).
    expect(partie.executer({ type: 'ameliorerTour', id })).toBe(false);
  });
});

describe('spores', () => {
  const deux: Vague[] = [...seule('limace'), ...seule('limace')];

  it('donnent un bonus en fin de vague', () => {
    const partie = new Partie(ile, deux, 1);
    jouerJusqua(partie, () => partie.instantane().vague === 2);
    expect(partie.instantane().spores).toBe(SPORES_DEPART + BONUS_VAGUE.fixe + BONUS_VAGUE.parVague);
  });

  it('récompensent la vague lancée plus tôt', () => {
    const partie = new Partie(ile, deux, 1);
    for (let i = 0; i < 5 * PAS_PAR_SECONDE; i++) partie.avancer();
    partie.executer({ type: 'lancerVague' });
    expect(partie.instantane().spores).toBe(SPORES_DEPART + PAUSE_SECONDES - 5);
  });
});
