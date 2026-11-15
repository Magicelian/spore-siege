import { describe, expect, it } from 'vitest';
import { lireCarte } from './carte';
import { MONSTRES, PAS_PAR_SECONDE, type Vague } from './contenu';
import type { TypeMonstre, TypeTour } from './contrat';
import { Partie } from './partie';

/** Couloir : un long gué entre deux cases de sentier ; de l'eau libre au sud pour le héron. */
const couloir = lireCarte(
  ['..............', 'hhhhhhhhhhhhhh', 's=ggggggggg=SS', 'hhhhhhhhhhhhSS', 'hhhhhheehhhhhh'],
  'marais',
);
/** Même couloir, sans gué. */
const sec = lireCarte(
  ['..............', 'hhhhhhhhhhhhhh', 's============SS'.slice(0, 12) + 'SS', 'hhhhhhhhhhhhSS', 'hhhhhhhhhhhhhh'],
  'marais',
);

function partie(type: TypeMonstre, ile = couloir, tour?: { type: TypeTour; x: number; y: number }): Partie {
  const vague: Vague = [{ type, nombre: 1, intervalle: 1 }];
  const p = new Partie(ile, [vague], 1);
  (p as unknown as { spores: number }).spores = 9999;
  if (tour) p.executer({ type: 'poserTour', tour: tour.type, case: { x: tour.x, y: tour.y } });
  p.executer({ type: 'lancerVague' });
  return p;
}

/** Joue la vague jusqu'au bout ; renvoie les pas écoulés et ce qu'on a vu passer. */
function jouer(p: Partie) {
  let pas = 0;
  let immerge = false;
  let saute = false;
  while (p.instantane().phase === 'vague' && pas < 20_000) {
    p.avancer();
    pas++;
    const m = p.instantane().monstres[0];
    if (m?.immerge) immerge = true;
    if (m?.saut !== null && m?.saut !== undefined) saute = true;
  }
  return { pas, immerge, saute, i: p.instantane() };
}

describe('Sangsue', () => {
  it('plonge dans les gués, où seul le héron la touche', () => {
    const ruche = jouer(partie('sangsue', couloir, { type: 'ruche', x: 6, y: 1 }));
    expect(ruche.immerge).toBe(true);
    expect(ruche.i.degats.ruche).toBe(0);
    // Témoin : la même ruche blesse une limace dans le gué.
    expect(jouer(partie('limace', couloir, { type: 'ruche', x: 6, y: 1 })).i.degats.ruche).toBeGreaterThan(0);
    expect(jouer(partie('sangsue', couloir, { type: 'heron', x: 6, y: 4 })).i.degats.heron).toBeGreaterThan(0);
  });

  it('n’est pas ralentie par les gués', () => {
    const mouillee = jouer(partie('sangsue')).pas;
    const seche = jouer(partie('sangsue', sec)).pas;
    expect(Math.abs(mouillee - seche)).toBeLessThan(seche * 0.05);
  });
});

describe('Crapaud', () => {
  it('bondit et arrive bien plus vite que sa vitesse de marche', () => {
    const r = jouer(partie('crapaud', sec));
    expect(r.saute).toBe(true);
    const aPied = (10.5 / MONSTRES.crapaud.vitesse) * PAS_PAR_SECONDE;
    expect(r.pas).toBeLessThan(aPied * 0.75);
  });
});

describe('Crapaud-roi', () => {
  it('plonge à chaque palier, hors d’atteinte, puis ressort plus loin avec son escorte', () => {
    const longue = lireCarte(['....................', 'hhhhhhhhhhhhhhhhhhhh', 's=================SS', 'hhhhhhhhhhhhhhhhhhSS'], 'marais');
    const p = partie('crapaudRoi', longue, { type: 'canon', x: 6, y: 1 });
    const interne = p as unknown as { monstres: { pv: number; avancement: number }[] };
    while (p.instantane().monstres.length === 0) p.avancer();
    // Juste sous 75 % : le palier tombe au pas suivant.
    interne.monstres[0]!.pv = MONSTRES.crapaudRoi.pv * 0.74;
    p.avancer();
    const i = p.instantane();
    expect(i.evenements.some((e) => e.type === 'plongee')).toBe(true);
    expect(i.monstres[0]!.immerge).toBe(true);
    const pv = i.monstres[0]!.pv;
    const avant = interne.monstres[0]!.avancement;
    const duree = MONSTRES.crapaudRoi.boss!.plongee!.duree * PAS_PAR_SECONDE;
    for (let n = 0; n < duree - 1; n++) p.avancer();
    // Sous l'eau : intouchable, et il a filé de l'avance prévue.
    expect(p.instantane().monstres[0]!.pv).toBe(pv);
    expect(interne.monstres[0]!.avancement - avant).toBeGreaterThan(MONSTRES.crapaudRoi.boss!.plongee!.avance * 0.9);
    expect(p.instantane().monstres).toHaveLength(1);
    p.avancer();
    p.avancer();
    const apres = p.instantane();
    expect(apres.evenements.some((e) => e.type === 'ponte')).toBe(true);
    expect(apres.monstres.filter((m) => m.type === 'crapaud')).toHaveLength(4);
    expect(apres.monstres[0]!.immerge).toBe(false);
  });

  it('qui touche la souche fait perdre la partie', () => {
    const p = partie('crapaudRoi', sec);
    while (p.instantane().phase === 'vague') p.avancer();
    expect(p.instantane().phase).toBe('defaite');
  });
});
