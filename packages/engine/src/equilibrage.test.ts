// Équilibrage de l'île-forêt (cible « exigeante », choisie par Celian le 12/11/2026) : le joueur naïf perd tôt,
// le simple perd vers la vague 7 ou 8, le bon gagne ; une partie dure environ 15 minutes.
import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { VAGUES_FORET } from './contenu';
import { jouer, type Bilan, type Niveau } from './joueur';

const bilans = (['naif', 'simple', 'bon'] as Niveau[]).map((n) => jouer(n, ileForet(), VAGUES_FORET));

/** Node, sans ses types dans ce paquet : la sortie d'erreur passe même quand Vitest tait les console.log. */
declare const process: { stderr: { write(texte: string): void } };

const [naif, simple, bon] = bilans as [Bilan, Bilan, Bilan];

describe('équilibrage de l’île-forêt', () => {
  it('rapport (affiché dans la sortie des tests)', () => {
    for (const b of bilans)
      process.stderr.write(
        `${b.niveau.padEnd(6)} ${b.phase.padEnd(8)} vague ${b.vague}  PV ${b.pv}  ★${b.etoiles}  ${b.minutes} min  pertes ${b.pertes.join(' ')}  ${b.tours.join(' ')}\n`,
      );
  });

  it('le joueur naïf (que des ruches) tombe avant la vague 8', () => {
    expect(naif.phase).toBe('defaite');
    expect(naif.vague).toBeLessThanOrEqual(7);
  });

  it('le joueur simple (tours variées, sans ronces) tombe vers la vague 7 ou 8', () => {
    expect(simple.phase).toBe('defaite');
    expect(simple.vague).toBeGreaterThanOrEqual(7);
    expect(simple.vague).toBeLessThanOrEqual(9);
  });

  it('le bon joueur gagne, sans que les 3 étoiles soient données', () => {
    expect(bon.phase).toBe('victoire');
    expect(bon.etoiles).toBeGreaterThanOrEqual(1);
    expect(bon.etoiles).toBeLessThanOrEqual(2);
  });

  it('une partie gagnée dure environ un quart d’heure', () => {
    expect(bon.minutes).toBeGreaterThanOrEqual(12);
    expect(bon.minutes).toBeLessThanOrEqual(17);
  });
});
