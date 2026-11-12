import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { MONSTRES, PAS_PAR_SECONDE, PAUSE_SECONDES, PV_SOUCHE, VAGUES_FORET, type Vague } from './contenu';
import { etoiles, Partie } from './partie';
import { lireSentier, route } from './sentier';

const ile = ileForet();

/** Avance jusqu'à ce que `condition` soit vraie (au plus `max` pas) ; renvoie le nombre de pas joués. */
function jouerJusqua(partie: Partie, condition: () => boolean, max = 100_000): number {
  let n = 0;
  while (!condition() && n < max) {
    partie.avancer();
    n++;
  }
  return n;
}

describe('sentier de l’île-forêt', () => {
  const sentier = lireSentier(ile);

  it('trouve les deux plages et leur case de départ sur le sable', () => {
    expect(sentier.plages).toEqual([
      { depart: { x: 16, y: 0 }, entree: { x: 16, y: 1 } },
      { depart: { x: 1, y: 10 }, entree: { x: 2, y: 10 } },
    ]);
  });

  it('repère les carrefours', () => {
    expect(sentier.carrefours).toEqual([{ x: 9, y: 7 }, { x: 4, y: 10 }]);
  });

  it('prend la branche nord, plus courte, depuis l’ouest', () => {
    const chemin = route(ile, { x: 1, y: 10 })!;
    expect(chemin.at(-1)).toEqual({ x: 9, y: 8 });
    expect(chemin).toContainEqual({ x: 4, y: 7 });
  });

  it('se rabat sur la branche sud si la nord est fermée', () => {
    const chemin = route(ile, { x: 1, y: 10 }, new Set(['4,9']))!;
    expect(chemin.at(-1)).toEqual({ x: 9, y: 11 });
  });

  it('renvoie null si tout est fermé', () => {
    expect(route(ile, { x: 1, y: 10 }, new Set(['4,9', '4,11']))).toBeNull();
  });
});

describe('partie', () => {
  it('attend la fin de la pause, puis lance la vague 1', () => {
    const partie = new Partie(ile, VAGUES_FORET, 1);
    expect(partie.instantane()).toMatchObject({ phase: 'pause', vague: 1, pauseRestante: PAUSE_SECONDES });
    for (let i = 0; i < PAUSE_SECONDES * PAS_PAR_SECONDE; i++) partie.avancer();
    expect(partie.instantane().phase).toBe('vague');
  });

  it('lance la vague plus tôt sur commande, seulement en pause', () => {
    const partie = new Partie(ile, VAGUES_FORET, 1);
    expect(partie.executer({ type: 'lancerVague' })).toBe(true);
    expect(partie.executer({ type: 'lancerVague' })).toBe(false);
  });

  it('fait marcher un monstre jusqu’à la souche, qui perd un point de vie', () => {
    const vagues: Vague[] = [[{ type: 'limace', nombre: 1, intervalle: 1, plage: 1 }]];
    const partie = new Partie(ile, vagues, 1);
    partie.executer({ type: 'lancerVague' });
    partie.avancer();
    expect(partie.instantane().monstres[0]!.position).toEqual({ x: 1.5 + MONSTRES.limace.vitesse / PAS_PAR_SECONDE, y: 10.5 });
    const pas = jouerJusqua(partie, () => partie.instantane().monstres.length === 0);
    // Route : 12 cases de centre à centre (3 vers l'est, 3 au nord, 5 à l'est, 1 au sud), puis un demi-pas.
    expect(pas).toBeCloseTo((12.5 / MONSTRES.limace.vitesse) * PAS_PAR_SECONDE, -1);
    expect(partie.instantane()).toMatchObject({ phase: 'victoire', souche: { pv: PV_SOUCHE - 1 }, etoiles: 2 });
  });

  it('perd quand la souche tombe à 0', () => {
    const partie = new Partie(ile, VAGUES_FORET, 1);
    jouerJusqua(partie, () => {
      const { phase } = partie.instantane();
      if (phase === 'pause') partie.executer({ type: 'lancerVague' });
      return phase === 'defaite';
    });
    expect(partie.instantane()).toMatchObject({ phase: 'defaite', souche: { pv: 0 }, etoiles: 0 });
    expect(partie.instantane().vague).toBeLessThanOrEqual(VAGUES_FORET.length);
  });

  it('est déterministe', () => {
    const jouer = () => {
      const partie = new Partie(ile, VAGUES_FORET, 42);
      partie.executer({ type: 'lancerVague' });
      for (let i = 0; i < 1500; i++) partie.avancer();
      return partie.instantane();
    };
    expect(jouer()).toEqual(jouer());
  });

  it('donne les étoiles selon la vie de la souche', () => {
    expect([20, 19, 10, 9, 1].map(etoiles)).toEqual([3, 2, 2, 1, 1]);
  });
});
