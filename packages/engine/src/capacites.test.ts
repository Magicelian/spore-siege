import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { CAPACITES, CAPACITES_DE, MONSTRES, PART_REVENTE_CAPACITE, TOURS, type Vague } from './contenu';
import type { Capacite, TypeMonstre, TypeTour } from './contrat';
import { Partie } from './partie';

const ile = ileForet();
/** Herbe juste au nord du sentier de l'ouest (ligne 7), que les monstres longent vers la souche. */
const PRES = { x: 6, y: 6 };

function jouerJusqua(partie: Partie, condition: () => boolean, max = 20_000): void {
  for (let n = 0; n < max && !condition(); n++) partie.avancer();
}

/** Partie de test riche en spores : les tests portent sur les effets, pas sur l'économie. */
function partieRiche(vagues: Vague[]): Partie {
  const partie = new Partie(ile, vagues, 1);
  (partie as unknown as { spores: number }).spores = 5000;
  return partie;
}

function seule(type: TypeMonstre, nombre = 1, intervalle = 1): Vague[] {
  return [[{ type, nombre, intervalle, plage: 1 }]];
}

/** Pose une tour et la monte au stade 3 ; renvoie son id. */
function tourStade3(partie: Partie, type: TypeTour): number {
  partie.executer({ type: 'poserTour', tour: type, case: PRES });
  const id = partie.instantane().tours.at(-1)!.id;
  partie.executer({ type: 'ameliorerTour', id });
  partie.executer({ type: 'ameliorerTour', id });
  return id;
}

function avecCapacite(vagues: Vague[], capacite: Capacite): Partie {
  const partie = partieRiche(vagues);
  const id = tourStade3(partie, CAPACITES[capacite].tour);
  expect(partie.executer({ type: 'choisirCapacite', id, capacite })).toBe(true);
  return partie;
}

describe('capacités du stade 4', () => {
  it('se choisissent au stade 3 seulement, parmi les deux de la tour, et coûtent leur prix', () => {
    const partie = partieRiche(seule('limace'));
    partie.executer({ type: 'poserTour', tour: 'ruche', case: PRES });
    const id = partie.instantane().tours[0]!.id;
    expect(partie.executer({ type: 'choisirCapacite', id, capacite: 'essaim' })).toBe(false);
    partie.executer({ type: 'ameliorerTour', id });
    partie.executer({ type: 'ameliorerTour', id });
    let tour = partie.instantane().tours[0]!;
    expect(tour.prixAmelioration).toBeNull();
    expect(tour.prixCapacites).toEqual([CAPACITES.essaim.prix, CAPACITES.dard.prix]);
    // Une capacité d'une autre tour : refusée.
    expect(partie.executer({ type: 'choisirCapacite', id, capacite: 'prisme' })).toBe(false);
    const avant = partie.instantane().spores;
    expect(partie.executer({ type: 'choisirCapacite', id, capacite: 'dard' })).toBe(true);
    tour = partie.instantane().tours[0]!;
    expect(tour).toMatchObject({ stade: 4, capacite: 'dard', prixAmelioration: null, prixCapacites: null, portee: CAPACITES.dard.portee });
    expect(partie.instantane().spores).toBe(avant - CAPACITES.dard.prix);
    // Définitif.
    expect(partie.executer({ type: 'choisirCapacite', id, capacite: 'essaim' })).toBe(false);
  });

  it('chaque tour a deux capacités qui sont bien les siennes', () => {
    for (const [tour, deux] of Object.entries(CAPACITES_DE)) for (const c of deux) expect(CAPACITES[c].tour).toBe(tour);
  });

  it('une tour à capacité ne se revend qu’à 50 % de ce qu’elle a coûté', () => {
    const partie = avecCapacite(seule('limace'), 'essaim');
    const paye = TOURS.ruche.stades.reduce((n, s) => n + s.prix, 0) + CAPACITES.essaim.prix;
    expect(partie.instantane().tours[0]!.revente).toBe(Math.floor(paye * PART_REVENTE_CAPACITE));
  });

  it('Essaim envoie deux abeilles sur deux monstres différents', () => {
    const partie = avecCapacite(seule('scarabee', 4, 0.6), 'essaim');
    const cibles = () => new Set((partie as unknown as { projectiles: { cible: number }[] }).projectiles.map((p) => p.cible)).size;
    // Tant qu'un seul scarabée est à portée, les deux abeilles partent sur lui ; ensuite elles se séparent.
    jouerJusqua(partie, () => cibles() >= 2 || partie.instantane().phase !== 'vague' && partie.instantane().pas > 2000);
    expect(cibles()).toBe(2);
  });

  it('Dard traverse l’armure et empoisonne', () => {
    const partie = avecCapacite(seule('scarabee'), 'dard');
    const pv = MONSTRES.scarabee.pv;
    jouerJusqua(partie, () => (partie.instantane().monstres[0]?.pv ?? pv) < pv);
    const m = partie.instantane().monstres[0]!;
    expect(m.pv).toBe(pv - CAPACITES.dard.degats);
    expect(m.empoisonne).toBe(true);
    partie.avancer();
    expect(partie.instantane().monstres[0]!.pv).toBeLessThan(m.pv);
  });

  it('Prisme frappe fort, sans rebond ; Tempête rebondit plus loin', () => {
    // Un seul rayon tue un scarabée, armure comprise.
    expect(CAPACITES.prisme.degats).toBeGreaterThanOrEqual(MONSTRES.scarabee.pv);
    const prisme = avecCapacite(seule('scarabee'), 'prisme');
    jouerJusqua(prisme, () => prisme.instantane().tours[0]!.dernierTir >= 0);
    expect(prisme.instantane().monstres).toHaveLength(0);
    expect(prisme.instantane().tours[0]!.chaine).toHaveLength(2);

    const tempete = avecCapacite(seule('limace', 8, 0.4), 'tempete');
    let maxChaine = 0;
    jouerJusqua(tempete, () => {
      maxChaine = Math.max(maxChaine, tempete.instantane().tours[0]!.chaine.length);
      return maxChaine > 1 + 3 || tempete.instantane().phase !== 'vague' && tempete.instantane().pas > 2000;
    });
    // Plus de 3 monstres touchés par un seul éclair : impossible avec 2 rebonds du stade 1.
    expect(maxChaine).toBeGreaterThan(4);
  });

  it('Salve lâche trois obus à la fois', () => {
    const partie = avecCapacite(seule('limace'), 'salve');
    jouerJusqua(partie, () => partie.instantane().projectiles.length > 0);
    expect(partie.instantane().projectiles).toHaveLength(3);
  });

  it('Glu laisse une flaque qui ralentit, puis sèche', () => {
    const partie = avecCapacite(seule('scarabee'), 'glu');
    jouerJusqua(partie, () => partie.instantane().flaques.length > 0);
    expect(partie.instantane().flaques[0]!.reste).toBeCloseTo(1, 1);
    jouerJusqua(partie, () => partie.instantane().flaques.length === 0 || partie.instantane().phase !== 'vague');
    expect(partie.instantane().flaques.every((f) => f.reste <= 1)).toBe(true);
  });

  it('Mitraille tire sur trois monstres, Gros calibre fait un gros trou', () => {
    const mitraille = avecCapacite(seule('limace', 6, 0.5), 'mitraille');
    jouerJusqua(mitraille, () => mitraille.instantane().projectiles.length > 0 && mitraille.instantane().monstres.length >= 3);
    expect(mitraille.instantane().projectiles.length).toBe(3);

    const gros = avecCapacite(seule('scarabee'), 'grosCalibre');
    jouerJusqua(gros, () => gros.instantane().impacts.length > 0);
    expect(gros.instantane().impacts[0]).toMatchObject({ capacite: 'grosCalibre', rayon: CAPACITES.grosCalibre.rayon });
  });
});
