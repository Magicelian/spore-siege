import { describe, expect, it } from 'vitest';
import { NIVEAUX_FORET, partieDe } from './niveaux';

describe('arrivées annoncées', () => {
  it('donne, pendant la pause, les plages de la vague à venir et ce qui en vient', () => {
    const niveau = NIVEAUX_FORET[0]!;
    const partie = partieDe(niveau, 1);
    const i = partie.instantane();
    expect(i.phase).toBe('pause');
    const attendu = new Set(niveau.vagues[0]!.map((g) => g.plage));
    expect(new Set(i.arrivees.map((a) => a.plage))).toEqual(attendu);
    for (const a of i.arrivees) expect(a.types.length).toBeGreaterThan(0);
  });

  it('suit la vague suivante après la première', () => {
    const niveau = NIVEAUX_FORET[0]!;
    const partie = partieDe(niveau, 1);
    partie.executer({ type: 'lancerVague' });
    // Avance jusqu'à la pause suivante (ou la fin).
    for (let k = 0; k < 20 * 600 && partie.instantane().phase === 'vague'; k++) partie.avancer();
    const i = partie.instantane();
    if (i.phase !== 'pause') return;
    // Un groupe sans plage tourne sur toutes : les deux plages de la Clairière.
    const groupes = niveau.vagues[1]!;
    const plages = groupes.some((g) => g.plage === undefined) ? new Set([0, 1]) : new Set(groupes.map((g) => g.plage));
    expect(new Set(i.arrivees.map((a) => a.plage))).toEqual(plages);
  });

  it('ne donne rien une fois la partie finie', () => {
    const partie = partieDe(NIVEAUX_FORET[0]!, 1);
    for (let k = 0; k < 20 * 3000 && !['victoire', 'defaite'].includes(partie.instantane().phase); k++) {
      if (partie.instantane().phase === 'pause') partie.executer({ type: 'lancerVague' });
      partie.avancer();
    }
    expect(partie.instantane().arrivees).toEqual([]);
  });
});
