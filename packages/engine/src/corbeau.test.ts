import { describe, expect, it } from 'vitest';
import { MONSTRES, type Vague } from './contenu';
import type { Instantane } from './contrat';
import { ileDe, NIVEAUX_PRAIRIE } from './niveaux';
import { Partie } from './partie';

const pres = NIVEAUX_PRAIRIE[0]!;
const ile = ileDe(pres);
const regles = { ...pres.regles, spores: 5000 };
const unCorbeau: Vague[] = [[{ type: 'corbeau', nombre: 1, intervalle: 1, plage: 0 }]];
const fleurs = [{ x: 4, y: 2 }, { x: 3, y: 12 }, { x: 15, y: 16 }, { x: 16, y: 10 }];

function jusqua(p: Partie, fin: (i: Instantane) => boolean, max = 20_000): Instantane {
  for (let n = 0; n < max; n++) {
    const i = p.instantane();
    if (fin(i)) return i;
    p.avancer();
  }
  throw new Error('jamais atteint');
}
const corbeau = (i: Instantane) => i.monstres.find((m) => m.type === 'corbeau');

describe('Grand Corbeau rouillé', () => {
  it('tourne en l’air, pique sur une fleur, l’arrache et se pose', () => {
    const p = new Partie(ile, unCorbeau, 1, regles);
    for (const c of fleurs) p.executer({ type: 'planterFleur', case: c });
    p.executer({ type: 'lancerVague' });
    const enVol = jusqua(p, (i) => corbeau(i)?.altitude === 1);
    expect(enVol.fleurs).toHaveLength(4);
    const pique = jusqua(p, (i) => i.evenements.some((e) => e.type === 'pique'));
    expect(pique.evenements.find((e) => e.type === 'pique')).toMatchObject({ souche: false });
    const pose = jusqua(p, (i) => corbeau(i)?.altitude === 0);
    expect(pose.fleurs).toHaveLength(3);
    expect(pose.evenements.some((e) => e.type === 'devore' && e.monstre === 'corbeau')).toBe(true);
    // Il repart au bout de quelques secondes.
    jusqua(p, (i) => (corbeau(i)?.altitude ?? 0) > 0);
  });

  it('après trois fleurs, il fond sur la souche : défaite', () => {
    const p = new Partie(ile, unCorbeau, 1, regles);
    for (const c of fleurs) p.executer({ type: 'planterFleur', case: c });
    p.executer({ type: 'lancerVague' });
    const assaut = jusqua(p, (i) => i.evenements.some((e) => e.type === 'pique' && e.souche));
    expect(assaut.fleurs).toHaveLength(1);
    expect(jusqua(p, (i) => i.phase !== 'vague').phase).toBe('defaite');
  });

  it('sans fleur, il fond tout de suite sur la souche', () => {
    const p = new Partie(ile, unCorbeau, 1, regles);
    p.executer({ type: 'lancerVague' });
    const i = jusqua(p, (x) => x.evenements.some((e) => e.type === 'pique'));
    expect(i.evenements.find((e) => e.type === 'pique')).toMatchObject({ souche: true });
    expect(i.pas).toBeLessThan(20 * 20);
  });

  it('en l’air, seuls la ruche et le cristal l’atteignent ; posé, le canon aussi', () => {
    // En l'air : sans fleur, il fond sur la souche ; la tour est à côté d'elle.
    const enVol = (tour: 'canon' | 'cristal') => {
      const p = new Partie(ile, unCorbeau, 1, regles);
      p.executer({ type: 'lancerVague' });
      const i = jusqua(p, (x) => x.evenements.some((e) => e.type === 'pique'));
      const e = i.evenements.find((x) => x.type === 'pique')!;
      if (e.type !== 'pique') throw new Error();
      // La tour au plus près du point de la souche qu'il vise.
      const autour = [...Array(25).keys()].map((k) => ({ x: Math.floor(e.cible.x) + (k % 5) - 2, y: Math.floor(e.cible.y) + Math.floor(k / 5) - 2 }));
      autour.sort((a, b) => Math.hypot(a.x + 0.5 - e.cible.x, a.y + 0.5 - e.cible.y) - Math.hypot(b.x + 0.5 - e.cible.x, b.y + 0.5 - e.cible.y));
      expect(autour.some((c) => p.executer({ type: 'poserTour', tour, case: c }))).toBe(true);
      const avant = corbeau(p.instantane())!.pv;
      let pv = avant;
      // Jusqu'à ce qu'il touche la souche (il disparaît alors) : sa vie la plus basse vue.
      for (let n = 0; n < 400 && corbeau(p.instantane()); n++) {
        pv = Math.min(pv, corbeau(p.instantane())!.pv);
        p.avancer();
      }
      return pv < avant;
    };
    expect(enVol('canon')).toBe(false);
    expect(enVol('cristal')).toBe(true);
    // Posé sur sa fleur, à côté d'un canon.
    const p = new Partie(ile, unCorbeau, 1, regles);
    p.executer({ type: 'planterFleur', case: { x: 4, y: 7 } });
    p.executer({ type: 'poserTour', tour: 'canon', case: { x: 4, y: 8 } });
    p.executer({ type: 'lancerVague' });
    jusqua(p, (i) => corbeau(i)?.altitude === 0);
    const avant = corbeau(p.instantane())!.pv;
    for (let n = 0; n < 40; n++) p.avancer();
    expect(corbeau(p.instantane())!.pv).toBeLessThan(avant);
    expect(MONSTRES.corbeau.boss).toBeDefined();
  });
});
