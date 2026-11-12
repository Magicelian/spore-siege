import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { PAUSE_SECONDES, PRIX_RONCE, SPORES_DEPART, type Vague } from './contenu';
import { Partie } from './partie';

const ile = ileForet();
const ouest: Vague[] = [[{ type: 'limace', nombre: 1, intervalle: 1, plage: 1 }]];

function jouerJusqua(partie: Partie, condition: () => boolean, max = 20_000): void {
  for (let n = 0; n < max && !condition(); n++) partie.avancer();
}

/** Toutes les cases (arrondies) par où passe le premier monstre jusqu'à la fin de la partie. */
function parcours(partie: Partie): Set<string> {
  const vues = new Set<string>();
  jouerJusqua(partie, () => {
    const m = partie.instantane().monstres[0];
    if (m) vues.add(`${Math.floor(m.position.x)},${Math.floor(m.position.y)}`);
    return partie.instantane().phase === 'victoire' || partie.instantane().phase === 'defaite';
  });
  return vues;
}

describe('ronces', () => {
  it('poussent à l’entrée de chaque branche des deux carrefours', () => {
    const cases = new Partie(ile, ouest, 1).emplacementsRonces.map((c) => `${c.x},${c.y}`).sort();
    expect(cases).toEqual(['10,7', '3,10', '4,11', '4,9', '8,7', '9,8'].sort());
  });

  it('ferment la branche nord : la limace de l’ouest passe par le sud', () => {
    const libre = parcours(new Partie(ile, ouest, 1));
    expect(libre.has('4,13')).toBe(false);
    const partie = new Partie(ile, ouest, 1);
    expect(partie.executer({ type: 'poserRonce', case: { x: 4, y: 9 } })).toBe(true);
    expect(partie.instantane().spores).toBe(SPORES_DEPART - PRIX_RONCE);
    const fermee = parcours(partie);
    expect(fermee.has('4,13')).toBe(true);
    expect(fermee.has('4,8')).toBe(false);
    expect(partie.instantane().souche.pv).toBe(19);
  });

  it('laissent toujours une branche ouverte', () => {
    const partie = new Partie(ile, ouest, 1);
    // Couperait la plage de l'ouest, ou celle du nord-est.
    expect(partie.executer({ type: 'poserRonce', case: { x: 3, y: 10 } })).toBe(false);
    expect(partie.executer({ type: 'poserRonce', case: { x: 10, y: 7 } })).toBe(false);
    expect(partie.executer({ type: 'poserRonce', case: { x: 4, y: 9 } })).toBe(true);
    // Nord et sud fermés : l'ouest n'aurait plus de chemin.
    expect(partie.executer({ type: 'poserRonce', case: { x: 4, y: 11 } })).toBe(false);
    // Hors d'une entrée de branche.
    expect(partie.executer({ type: 'poserRonce', case: { x: 6, y: 7 } })).toBe(false);
  });

  it('s’enlèvent contre la moitié de leur prix', () => {
    const partie = new Partie(ile, ouest, 1);
    partie.executer({ type: 'poserRonce', case: { x: 4, y: 9 } });
    expect(partie.executer({ type: 'enleverRonce', case: { x: 4, y: 9 } })).toBe(true);
    expect(partie.instantane().spores).toBe(SPORES_DEPART - PRIX_RONCE / 2);
    expect(partie.instantane().ronces).toEqual([]);
    expect(partie.executer({ type: 'enleverRonce', case: { x: 4, y: 9 } })).toBe(false);
  });

  it('font demi-tour aux monstres déjà engagés dans la branche fermée', () => {
    const partie = new Partie(ile, ouest, 1);
    partie.executer({ type: 'lancerVague' });
    // La limace monte la branche nord ; on ferme la sortie de la ligne 7 devant elle.
    jouerJusqua(partie, () => (partie.instantane().monstres[0]?.position.y ?? 99) < 8.5);
    expect(partie.executer({ type: 'poserRonce', case: { x: 8, y: 7 } })).toBe(true);
    const suite = parcours(partie);
    expect(suite.has('4,13')).toBe(true);
    expect(suite.has('8,7')).toBe(false);
    expect(partie.instantane().souche.pv).toBe(19);
  });

  it('ne poussent pas sous un monstre', () => {
    const partie = new Partie(ile, ouest, 1);
    partie.executer({ type: 'lancerVague' });
    jouerJusqua(partie, () => {
      const m = partie.instantane().monstres[0];
      return !!m && Math.floor(m.position.x) === 4 && Math.floor(m.position.y) === 9;
    });
    expect(partie.executer({ type: 'poserRonce', case: { x: 4, y: 9 } })).toBe(false);
  });
});

describe('vague lancée tôt', () => {
  it('annonce le bonus : une spore par seconde de pause restante', () => {
    const partie = new Partie(ile, ouest, 1);
    expect(partie.instantane().bonusLancer).toBe(PAUSE_SECONDES);
    partie.executer({ type: 'lancerVague' });
    expect(partie.instantane().bonusLancer).toBe(0);
  });
});
