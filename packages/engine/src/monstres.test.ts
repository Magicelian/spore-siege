// Volant et soigneur (forêt, niveaux 2 et 4).
import { describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { MONSTRES, PAS_PAR_SECONDE, PAUSE_SECONDES, type Vague } from './contenu';
import type { Partie as PartieType } from './partie';
import { Partie } from './partie';

const ile = ileForet();
/** Herbe à une case de la ligne droite plage ouest → souche (y = 10,5). */
const PRES_DU_VOL = { x: 5, y: 9 };

function jouerJusqua(partie: PartieType, condition: () => boolean, max = 20_000): void {
  for (let n = 0; n < max && !condition(); n++) partie.avancer();
}
const volant: Vague[] = [[{ type: 'volant', nombre: 1, intervalle: 1, plage: 1 }]];

describe('volant', () => {
  it('vole tout droit de la plage à la souche', () => {
    const partie = new Partie(ile, volant, 1);
    partie.executer({ type: 'lancerVague' });
    const depart = partie.instantane();
    jouerJusqua(partie, () => partie.instantane().souche.pv < depart.souche.pv);
    const secondes = (partie.instantane().pas - depart.pas) / PAS_PAR_SECONDE;
    // Du centre du sable (1,5 ; 10,5) au bord ouest de la souche (9 ; 10,5) : 7,5 cases.
    expect(secondes).toBeCloseTo(7.5 / MONSTRES.volant.vitesse, 0);
  });

  it('les ronces ne le détournent pas', () => {
    const partie = new Partie(ile, volant, 1);
    partie.executer({ type: 'lancerVague' });
    jouerJusqua(partie, () => partie.instantane().monstres.length > 0);
    partie.avancer();
    const avant = partie.instantane().monstres[0]!.position;
    expect(partie.executer({ type: 'poserRonce', case: { x: 4, y: 9 } })).toBe(true);
    partie.avancer();
    const apres = partie.instantane().monstres[0]!.position;
    expect(apres.y).toBeCloseTo(avant.y, 5);
    expect(apres.x).toBeGreaterThan(avant.x);
  });

  for (const [tour, touche] of [
    ['ruche', true],
    ['cristal', true],
    ['mortier', false],
    ['canon', false],
  ] as const) {
    it(`${touche ? 'la' : 'le'} ${tour} ${touche ? 'le touche' : 'ne le touche pas'}`, () => {
      const partie = new Partie(ile, volant, 1, { spores: 500 });
      partie.executer({ type: 'poserTour', tour, case: PRES_DU_VOL });
      partie.executer({ type: 'lancerVague' });
      let blesse = false;
      jouerJusqua(partie, () => {
        const i = partie.instantane();
        blesse ||= i.monstres.some((m) => m.pv < m.pvMax) || i.evenements.some((e) => e.type === 'mort');
        return i.phase !== 'vague';
      });
      expect(blesse).toBe(touche);
    });
  }
});

describe('soigneur', () => {
  const troupeau: Vague[] = [
    [
      { type: 'soigneur', nombre: 1, intervalle: 1, plage: 1 },
      { type: 'scarabee', nombre: 1, intervalle: 1, debut: 0.5, plage: 1 },
    ],
  ];
  /** Accès aux monstres internes, pour blesser à la main. */
  const monstres = (p: PartieType) => (p as unknown as { monstres: { type: string; pv: number }[] }).monstres;

  it('rend de la vie aux blessés autour de lui, sans dépasser leur maximum ni se soigner lui-même', () => {
    const partie = new Partie(ile, troupeau, 1);
    partie.executer({ type: 'lancerVague' });
    jouerJusqua(partie, () => monstres(partie).length === 2);
    const [pretre, scarabee] = [monstres(partie).find((m) => m.type === 'soigneur')!, monstres(partie).find((m) => m.type === 'scarabee')!];
    pretre.pv = 10;
    scarabee.pv = MONSTRES.scarabee.pv - 3;
    jouerJusqua(partie, () => partie.instantane().evenements.some((e) => e.type === 'soin'), 5 * PAS_PAR_SECONDE);
    const soin = partie.instantane().evenements.find((e) => e.type === 'soin');
    expect(soin).toBeDefined();
    expect(scarabee.pv).toBe(MONSTRES.scarabee.pv);
    expect(pretre.pv).toBe(10);
  });

  it('ne soigne personne quand personne n’est blessé', () => {
    const partie = new Partie(ile, troupeau, 1);
    partie.executer({ type: 'lancerVague' });
    jouerJusqua(partie, () => partie.instantane().phase !== 'vague' || partie.instantane().pas > PAUSE_SECONDES * PAS_PAR_SECONDE);
    expect(partie.instantane().evenements.some((e) => e.type === 'soin')).toBe(false);
  });
});

describe('Limace-mère (boss)', () => {
  const boss: Vague[] = [[{ type: 'limaceMere', nombre: 1, intervalle: 1, plage: 1 }]];
  const interne = (p: PartieType) => (p as unknown as { monstres: { type: string; pv: number }[] }).monstres;
  const lancee = () => {
    const partie = new Partie(ile, boss, 1);
    partie.executer({ type: 'lancerVague' });
    jouerJusqua(partie, () => interne(partie).length === 1);
    return partie;
  };
  const pv = MONSTRES.limaceMere.pv;
  const paliers = MONSTRES.limaceMere.boss!.paliers;
  const taille = (n: number) => paliers[n]!.escorte.reduce((s, g) => s + g.nombre, 0);

  it('pond son escorte en passant sous 75 % de sa vie, une seule fois', () => {
    const partie = lancee();
    interne(partie)[0]!.pv = pv * 0.74;
    partie.avancer();
    const i = partie.instantane();
    expect(i.monstres).toHaveLength(1 + taille(0));
    expect(i.evenements.filter((e) => e.type === 'ponte')).toHaveLength(1);
    partie.avancer();
    expect(partie.instantane().monstres).toHaveLength(1 + taille(0));
  });

  it('un gros coup qui franchit plusieurs paliers les pond tous', () => {
    const partie = lancee();
    interne(partie)[0]!.pv = pv * 0.2;
    partie.avancer();
    expect(partie.instantane().monstres).toHaveLength(1 + taille(0) + taille(1) + taille(2));
  });

  it('si elle touche la souche, la partie est perdue d’un coup', () => {
    const partie = lancee();
    jouerJusqua(partie, () => partie.instantane().phase !== 'vague', 200_000);
    const i = partie.instantane();
    expect(i.phase).toBe('defaite');
    expect(i.vague).toBe(1);
  });
});
