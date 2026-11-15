import { describe, expect, it } from 'vitest';
import { MONSTRES, type Vague } from './contenu';
import type { Instantane } from './contrat';
import { ileDe, NIVEAUX_PRAIRIE } from './niveaux';
import { Partie } from './partie';

const pres = NIVEAUX_PRAIRIE[0]!;
const ile = ileDe(pres);
const regles = { ...pres.regles, spores: 1000 };
/** Une chenille, de la plage ouest (plage 1 : le nord-est vient avant dans l'ordre de lecture). */
const uneChenille: Vague[] = [[{ type: 'chenille', nombre: 1, intervalle: 1, plage: 1 }]];
/** Herbe à côté du sentier de la plage ouest (ligne 4) ; herbe loin de tout sentier. */
const presDuSentier = { x: 4, y: 5 };
const loin = { x: 2, y: 13 };

function jusqua(p: Partie, fin: (i: Instantane) => boolean, max = 20_000): Instantane {
  for (let n = 0; n < max; n++) {
    const i = p.instantane();
    if (fin(i)) return i;
    p.avancer();
  }
  return p.instantane();
}

describe('chenille rouillée', () => {
  it('quitte le sentier pour une fleur proche, la dévore, puis va mordre la souche', () => {
    const p = new Partie(ile, uneChenille, 1, regles);
    p.executer({ type: 'planterFleur', case: presDuSentier });
    p.executer({ type: 'lancerVague' });
    const repas = jusqua(p, (i) => i.monstres.some((m) => m.mange));
    const m = repas.monstres[0]!;
    expect(Math.floor(m.position.x)).toBe(presDuSentier.x);
    expect(Math.floor(m.position.y)).toBe(presDuSentier.y);
    // Elle reste sur place le temps du repas.
    for (let n = 0; n < 10; n++) p.avancer();
    expect(p.instantane().monstres[0]!.position).toEqual(m.position);
    const devore = jusqua(p, (i) => i.evenements.some((e) => e.type === 'devore'));
    expect(devore.fleurs).toEqual([]);
    expect(devore.evenements.find((e) => e.type === 'devore')).toMatchObject({ case: presDuSentier, monstre: 'chenille' });
    const fin = jusqua(p, (i) => i.phase !== 'vague');
    expect(fin.souche.pv).toBe(20 - MONSTRES.chenille.morsure);
  });

  it('ignore une fleur loin du sentier', () => {
    const p = new Partie(ile, uneChenille, 1, regles);
    p.executer({ type: 'planterFleur', case: loin });
    p.executer({ type: 'lancerVague' });
    const fin = jusqua(p, (i) => i.phase !== 'vague' || i.monstres.some((m) => m.mange));
    expect(fin.phase).not.toBe('vague');
    expect(fin.fleurs).toHaveLength(1);
  });

  it('fleur arrachée en route : elle rejoint le sentier', () => {
    const p = new Partie(ile, uneChenille, 1, regles);
    p.executer({ type: 'planterFleur', case: presDuSentier });
    const id = p.instantane().fleurs[0]!.id;
    p.executer({ type: 'lancerVague' });
    // Dès qu'elle a quitté le sentier (ligne 4), on arrache.
    jusqua(p, (i) => (i.monstres[0]?.position.y ?? 0) > 4.6);
    p.executer({ type: 'arracherFleur', id });
    const fin = jusqua(p, (i) => i.phase !== 'vague');
    expect(fin.souche.pv).toBe(20 - MONSTRES.chenille.morsure);
  });

  it('une ronce posée pendant son détour ne la bloque pas', () => {
    const p = new Partie(ile, uneChenille, 1, regles);
    p.executer({ type: 'planterFleur', case: presDuSentier });
    p.executer({ type: 'lancerVague' });
    jusqua(p, (i) => i.monstres.some((m) => m.mange));
    expect(p.executer({ type: 'poserRonce', case: { x: 7, y: 7 } })).toBe(true);
    const fin = jusqua(p, (i) => i.phase !== 'vague');
    expect(fin.souche.pv).toBe(20 - MONSTRES.chenille.morsure);
  });
});

describe('sauterelles', () => {
  it('rapides et fragiles : un essaim arrive bien avant une limace', () => {
    const temps = (type: 'sauterelle' | 'limace') => {
      const p = new Partie(ile, [[{ type, nombre: 1, intervalle: 1, plage: 0 }]], 1, regles);
      p.executer({ type: 'lancerVague' });
      let n = 0;
      jusqua(p, (i) => (n++, i.souche.pv < 20));
      return n;
    };
    expect(temps('sauterelle') * 2.5).toBeLessThan(temps('limace'));
    expect(MONSTRES.sauterelle.pv).toBeLessThan(MONSTRES.limace.pv / 2);
  });
});
