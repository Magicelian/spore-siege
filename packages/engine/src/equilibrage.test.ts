// Équilibrage. Les anciennes vagues de la forêt (cible « exigeante », choisie par Celian le 12/11/2026) servent de
// référence pour le niveau 3 : le joueur naïf perd tôt, le simple perd vers la vague 7 ou 8, le bon gagne ; une partie
// dure environ 15 minutes. La Clairière (niveau 1) est plus douce : on y apprend.
import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { VAGUES_FORET } from './contenu';
import { jouer, type Bilan, type Style } from './joueur';
import { ileDe, NIVEAUX_FORET } from './niveaux';

const bilans = (['naif', 'simple', 'bon'] as Style[]).map((n) => jouer(n, ileForet(), VAGUES_FORET));

/** Node, sans ses types dans ce paquet : la sortie d'erreur passe même quand Vitest tait les console.log. */
declare const process: { stderr: { write(texte: string): void } };

const [naif, simple, bon] = bilans as [Bilan, Bilan, Bilan];
/** Une seule sorte de tour, jamais de ronce : aucune ne doit suffire à gagner. */
const seuls = (['essaim', 'dard', 'tempete', 'prisme', 'salve', 'glu', 'mitraille', 'grosCalibre'] as const).map((c) =>
  jouer(`seul:${c}`, ileForet(), VAGUES_FORET),
);

describe('équilibrage de référence (ancienne forêt, futur niveau 3)', () => {
  it('rapport (affiché dans la sortie des tests)', () => {
    for (const b of [...bilans, ...seuls])
      process.stderr.write(
        `${b.style.padEnd(12)} ${b.phase.padEnd(8)} vague ${b.vague}  PV ${b.pv}  ★${b.etoiles}  ${b.minutes} min  pertes ${b.pertes.join(' ')}  ${b.tours.join(' ')}\n`,
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

  it('aucune tour ne gagne seule', () => {
    for (const b of seuls) expect(b.phase, b.style).toBe('defaite');
  });
});

const clairiere = NIVEAUX_FORET[0]!;
const [naif1, simple1, bon1] = (['naif', 'simple', 'bon'] as Style[]).map((n) =>
  jouer(n, ileDe(clairiere), clairiere.vagues, clairiere.regles),
) as [Bilan, Bilan, Bilan];

describe('équilibrage de la Clairière (forêt, niveau 1 : on apprend)', () => {
  it('rapport', () => {
    for (const b of [naif1, simple1, bon1])
      process.stderr.write(
        `clairière ${b.style.padEnd(8)} ${b.phase.padEnd(8)} vague ${b.vague}  PV ${b.pv}  ★${b.etoiles}  ${b.minutes} min  pertes ${b.pertes.join(' ')}  ${b.tours.join(' ')}\n`,
      );
  });

  it('les ruches seules tiennent longtemps mais sans les 3 étoiles', () => {
    expect(naif1.vague).toBeGreaterThanOrEqual(6);
    expect(naif1.etoiles).toBeLessThanOrEqual(2);
  });

  it('le joueur simple gagne', () => {
    expect(simple1.phase).toBe('victoire');
  });

  it('le bon joueur gagne avec au moins 2 étoiles', () => {
    expect(bon1.etoiles).toBeGreaterThanOrEqual(2);
  });

  it('une partie gagnée dure 7 à 12 minutes', () => {
    expect(simple1.minutes).toBeGreaterThanOrEqual(7);
    expect(simple1.minutes).toBeLessThanOrEqual(12);
  });
});

// Niveaux 2 à 5, réglés à l'étape 8d. Les joueurs scriptés jugent mal certains niveaux (le bon pose ses ronces trop
// tôt quand l'argent manque), d'où des garde-fous sur le meilleur des deux : gagnable, jamais donné, pas trop long.
const autres = NIVEAUX_FORET.slice(1).map((n) => {
  const [naif, simple, bon] = (['naif', 'simple', 'bon'] as Style[]).map((st) => jouer(st, ileDe(n), n.vagues, n.regles)) as [Bilan, Bilan, Bilan];
  const meilleur = [simple, bon].sort((a, b) => b.pv - a.pv || b.vague - a.vague)[0]!;
  return { n, naif, simple, bon, meilleur };
});

describe('équilibrage des niveaux 2 à 5 de la forêt', () => {
  it('rapport', () => {
    for (const { n, naif, simple, bon } of autres)
      for (const b of [naif, simple, bon])
        process.stderr.write(
          `${n.id} ${b.style.padEnd(7)} ${b.phase.padEnd(8)} vague ${b.vague}  PV ${b.pv}  ★${b.etoiles}  ${b.minutes} min  stade 4 : ${b.tours.filter((t) => t.endsWith(':4')).length}  pertes ${b.pertes.join(' ')}\n`,
        );
  });

  for (const { n, naif, meilleur } of autres) {
    it(`${n.nom} : gagnable, sans 3 étoiles pour les ruches seules, en 8 à 18 minutes`, () => {
      expect(meilleur.phase).toBe('victoire');
      expect(naif.etoiles).toBeLessThanOrEqual(2);
      expect(meilleur.minutes).toBeGreaterThanOrEqual(8);
      expect(meilleur.minutes).toBeLessThanOrEqual(18);
    });
  }

  it('le Fourré et le Cœur de la forêt ne donnent pas les 3 étoiles', () => {
    for (const { meilleur } of autres.slice(2)) expect(meilleur.etoiles).toBeLessThanOrEqual(2);
  });

  it('le boss est le niveau le plus dur : le meilleur script y garde le moins de vie', () => {
    const coeur = autres[3]!.meilleur.pv;
    for (const { meilleur } of autres.slice(0, 3)) expect(coeur).toBeLessThanOrEqual(meilleur.pv);
  });
});
