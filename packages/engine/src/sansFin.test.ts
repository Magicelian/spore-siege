import { describe, expect, it } from 'vitest';
import { MONSTRES } from './contenu';
import { jouer, type Bilan, type Style } from './joueur';
import { ileDe, NIVEAU_SANS_FIN } from './niveaux';
import { Partie } from './partie';
import { BOSS_SANS_FIN, vagueSansFin } from './sansFin';

declare const process: { stderr: { write(texte: string): void } };

describe('vagues sans fin', () => {
  it('un boss toutes les 10 vagues, dans l’ordre des îles, et des vagues qui grossissent', () => {
    for (let n = 1; n <= 60; n++) {
      const v = vagueSansFin(n);
      const boss = v.filter((g) => MONSTRES[g.type].boss);
      expect(boss.map((g) => g.type)).toEqual(n % 10 === 0 ? [BOSS_SANS_FIN[(n / 10 - 1) % 5]] : []);
      for (const g of v) expect(g.nombre).toBeLessThanOrEqual(40);
    }
    expect(vagueSansFin(1).every((g) => ['limace', 'moucheron'].includes(g.type))).toBe(true);
    expect(vagueSansFin(7)).toEqual(vagueSansFin(7));
  });

  it('pas de victoire : la vague suivante arrive, ses monstres plus solides', () => {
    const p = new Partie(ileDe(NIVEAU_SANS_FIN), NIVEAU_SANS_FIN.vagues.slice(0, 1), 1, NIVEAU_SANS_FIN.regles);
    p.executer({ type: 'lancerVague' });
    const interne = p as unknown as { monstres: { pv: number }[]; lachers: unknown[] };
    for (let n = 0; n < 2000 && p.instantane().phase === 'vague'; n++) {
      for (const m of interne.monstres) m.pv = 0;
      p.avancer();
    }
    const i = p.instantane();
    expect(i.phase).toBe('pause');
    expect(i.vague).toBe(2);
    expect(i.regles.sansFin).toBe(true);
  });

  it('le naïf tombe tôt, le simple tient une vingtaine de vagues, le bon va loin', () => {
    const [naif, simple, bon] = (['naif', 'simple', 'bon'] as Style[]).map((st) => {
      const b = jouer(st, ileDe(NIVEAU_SANS_FIN), NIVEAU_SANS_FIN.vagues, NIVEAU_SANS_FIN.regles);
      process.stderr.write(`sans-fin ${st.padEnd(7)} ${b.phase} vague ${b.vague} ${b.minutes} min tours ${b.tours.length}\n`);
      return b;
    }) as [Bilan, Bilan, Bilan];
    expect(naif.vague).toBeLessThanOrEqual(15);
    expect(simple.vague).toBeGreaterThanOrEqual(15);
    expect(simple.vague).toBeLessThanOrEqual(40);
    expect(bon.vague).toBeGreaterThanOrEqual(20);
  }, 120_000);
});
