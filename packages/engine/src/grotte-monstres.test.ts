import { describe, expect, it } from 'vitest';
import type { Case, Position } from './contrat';
import { MONSTRES, PAS_PAR_SECONDE, type Vague } from './contenu';
import { ileDe, NIVEAUX_GROTTE, NIVEAUX_PRAIRIE } from './niveaux';
import { Partie } from './partie';
import { route } from './sentier';

const galerie = NIVEAUX_GROTTE[0]!;
const ileGrotte = ileDe(galerie);
const dist = (a: Position, b: Position) => Math.hypot(a.x - b.x, a.y - b.y);

describe('chauve-souris', () => {
  // Deux vagues : après la première, la partie revient en pause (le temps continue, la lanterne peut se rallumer).
  const vague = (p: Partie): Vague[] => {
    const v: Vague = [{ type: 'chauveSouris', nombre: 1, intervalle: 1, plage: p.sentier.plages.findIndex((pl) => pl.depart.x > 10) }];
    return [v, v];
  };

  it('vole et éteint un moment les lanternes qu’elle survole', () => {
    // Un premier vol pour connaître sa trajectoire, puis une lanterne posée dessous.
    const essai = new Partie(ileGrotte, [], 1, galerie.regles);
    const repere = new Partie(ileGrotte, vague(essai), 1, galerie.regles);
    repere.executer({ type: 'lancerVague' });
    const vol: Position[] = [];
    for (let n = 0; n < 2000 && repere.instantane().phase === 'vague'; n++) {
      repere.avancer();
      const m = repere.instantane().monstres[0];
      if (m) vol.push(m.position);
    }
    let dessous: Case | null = null;
    for (let y = 0; y < ileGrotte.profondeur && !dessous; y++)
      for (let x = 0; x < ileGrotte.largeur && !dessous; x++)
        if (repere.lanterneLibre({ x, y }) && vol.some((p) => dist(p, { x: x + 0.5, y: y + 0.5 }) < 0.6)) dessous = { x, y };
    expect(dessous).not.toBeNull();

    const p = new Partie(ileGrotte, vague(essai), 1, galerie.regles);
    expect(p.executer({ type: 'poserLanterne', case: dessous! })).toBe(true);
    p.executer({ type: 'lancerVague' });
    let eteinteA = -1;
    for (let n = 0; n < 2000 && eteinteA < 0; n++) {
      p.avancer();
      const i = p.instantane();
      if (i.evenements.some((e) => e.type === 'extinction')) eteinteA = i.pas;
    }
    expect(eteinteA).toBeGreaterThan(0);
    expect(p.instantane().lanternes[0]!.allumee).toBe(false);
    const duree = MONSTRES.chauveSouris.souffle!.duree * PAS_PAR_SECONDE;
    // Elle reste au-dessus un moment : la lanterne se rallume `duree` après son passage.
    for (let n = 0; n < duree + 80; n++) p.avancer();
    expect(p.instantane().lanternes[0]!.allumee).toBe(true);
  });
});

describe('cloporte', () => {
  // Sans le noir : la prairie, plage ouest, une ruche au bord du sentier.
  const pres = NIVEAUX_PRAIRIE[0]!;
  const ile = ileDe(pres);

  function partie(tour: 'ruche' | 'cristal'): Partie {
    const essai = new Partie(ile, [], 1, pres.regles);
    const ouest = essai.sentier.plages.findIndex((pl) => pl.depart.x < 5);
    const p = new Partie(ile, [[{ type: 'cloporte', nombre: 1, intervalle: 1, plage: ouest }]], 1, pres.regles);
    const chemin = route(ile, essai.sentier.plages[ouest]!.depart, new Set())!;
    const pres_ = chemin.slice(2, 8);
    let place: Case | null = null;
    for (let y = 0; y < ile.profondeur && !place; y++)
      for (let x = 0; x < ile.largeur && !place; x++) if (p.libre({ x, y }, tour) && pres_.some((c) => Math.hypot(c.x - x, c.y - y) <= 1.5)) place = { x, y };
    expect(p.executer({ type: 'poserTour', tour, case: place! })).toBe(true);
    p.executer({ type: 'lancerVague' });
    return p;
  }

  it('touché, il se roule en boule et s’arrête, puis repart plus vite', () => {
    const p = partie('ruche');
    let n = 0;
    while (n++ < 3000 && !p.instantane().monstres[0]?.enBoule) p.avancer();
    const debut = p.instantane().monstres[0]!;
    expect(debut.enBoule).toBe(true);
    const pvDebut = debut.pv;
    const boule = MONSTRES.cloporte.boule!;
    for (let k = 0; k < boule.duree * PAS_PAR_SECONDE - 2; k++) p.avancer();
    const fin = p.instantane().monstres[0]!;
    expect(fin.position).toEqual(debut.position);
    // En boule, chaque coup d'abeille ne retire qu'un point.
    expect(pvDebut - fin.pv).toBeLessThanOrEqual(3);
    p.avancer();
    p.avancer();
    const avant = p.instantane().monstres[0]!.position;
    for (let k = 0; k < PAS_PAR_SECONDE / 2; k++) p.avancer();
    const apres = p.instantane().monstres[0]?.position;
    if (apres) expect(dist(avant, apres)).toBeGreaterThan(MONSTRES.cloporte.vitesse * 0.5 * 1.3);
  });

  it('le cristal, qui perce l’armure, le blesse même en boule', () => {
    const p = partie('cristal');
    let n = 0;
    while (n++ < 3000 && !p.instantane().monstres[0]?.enBoule) p.avancer();
    const pv = p.instantane().monstres[0]!.pv;
    for (let k = 0; k < MONSTRES.cloporte.boule!.duree * PAS_PAR_SECONDE - 2; k++) p.avancer();
    const reste = p.instantane().monstres[0]?.pv ?? 0;
    expect(pv - reste).toBeGreaterThanOrEqual(5);
  });
});

describe('Ver des profondeurs', () => {
  const vagues: Vague[] = [[{ type: 'ver', nombre: 1, intervalle: 1, plage: 0 }], [{ type: 'limace', nombre: 1, intervalle: 1, plage: 0 }]];
  const interne = (p: Partie) => (p as unknown as { monstres: { type: string; pv: number }[] }).monstres;
  const pv = MONSTRES.ver.pv;
  const noir = MONSTRES.ver.boss!.noir! * PAS_PAR_SECONDE;

  function lancee(): Partie {
    const p = new Partie(ileGrotte, vagues, 1, galerie.regles);
    let poses = 0;
    for (let y = 0; y < ileGrotte.profondeur && poses < 3; y++)
      for (let x = 0; x < ileGrotte.largeur && poses < 3; x++) if (p.executer({ type: 'poserLanterne', case: { x, y } })) poses++;
    expect(poses).toBe(3);
    p.executer({ type: 'lancerVague' });
    for (let n = 0; n < 200 && interne(p).length === 0; n++) p.avancer();
    return p;
  }

  it('à chaque palier, souffle toutes les lanternes un moment et pond son escorte', () => {
    const p = lancee();
    interne(p)[0]!.pv = pv * 0.74;
    p.avancer();
    const i = p.instantane();
    expect(i.evenements.filter((e) => e.type === 'souffle')).toHaveLength(1);
    expect(i.evenements.filter((e) => e.type === 'extinction')).toHaveLength(3);
    expect(i.lanternes.every((l) => !l.allumee)).toBe(true);
    // Seuls les luisants de la carte éclairent encore.
    expect(i.lumieres.filter((l) => l.allumee && l.lanterne !== null)).toHaveLength(0);
    expect(i.lumieres.some((l) => l.allumee && l.lanterne === null)).toBe(true);
    expect(i.monstres.length).toBeGreaterThan(1);
    for (let n = 0; n < noir + 1; n++) p.avancer();
    expect(p.instantane().lanternes.every((l) => l.allumee)).toBe(true);
  });

  it('un seul souffle même si un gros coup franchit plusieurs paliers', () => {
    const p = lancee();
    interne(p)[0]!.pv = pv * 0.2;
    p.avancer();
    expect(p.instantane().evenements.filter((e) => e.type === 'souffle')).toHaveLength(1);
  });
});
