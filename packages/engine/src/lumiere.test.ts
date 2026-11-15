import { describe, expect, it } from 'vitest';
import { LANTERNE, type Vague } from './contenu';
import { ileDe, NIVEAUX_GROTTE, NIVEAUX_PRAIRIE } from './niveaux';
import { Partie } from './partie';

const galerie = NIVEAUX_GROTTE[0]!;
const ile = ileDe(galerie);
// Une ruche en (16, 8) ne voit que du chemin noir : (16, 6-7) et la ligne 7 de 14 à 15.
const tourNoire = { x: 16, y: 8 };
const lanterneProche = { x: 14, y: 6 };

function uneLimaceDuNordEst(p: Partie): Vague[] {
  const nordEst = p.sentier.plages.findIndex((pl) => pl.depart.x > 10);
  return [[{ type: 'limace', nombre: 1, intervalle: 1, plage: nordEst }]];
}

/** Joue la vague 1 jusqu'au bout ; renvoie les dégâts de la ruche. */
function jouer(lanterne: boolean): { degats: number; tirsDansLeNoir: number } {
  const essai = new Partie(ile, [], 1, galerie.regles);
  const p = new Partie(ile, uneLimaceDuNordEst(essai), 1, galerie.regles);
  expect(p.executer({ type: 'poserTour', tour: 'ruche', case: tourNoire })).toBe(true);
  if (lanterne) expect(p.executer({ type: 'poserLanterne', case: lanterneProche })).toBe(true);
  p.executer({ type: 'lancerVague' });
  let tirsDansLeNoir = 0;
  for (let n = 0; n < 20_000 && p.instantane().phase === 'vague'; n++) {
    p.avancer();
    const i = p.instantane();
    for (const t of i.tours) {
      if (t.dernierTir !== i.pas || t.cible === null) continue;
      if (i.monstres.find((m) => m.id === t.cible)?.dansLeNoir) tirsDansLeNoir++;
    }
  }
  return { degats: p.instantane().degats.ruche, tirsDansLeNoir };
}

describe('le noir de la grotte', () => {
  it('les luisants de la carte éclairent ; rien hors de la grotte', () => {
    const p = new Partie(ile, [], 1, galerie.regles);
    const lumieres = p.instantane().lumieres;
    expect(lumieres.length).toBe(6);
    expect(lumieres.every((l) => l.lanterne === null && l.allumee)).toBe(true);
    const prairie = NIVEAUX_PRAIRIE[0]!;
    expect(new Partie(ileDe(prairie), [], 1, prairie.regles).instantane().lumieres).toEqual([]);
  });

  it('une lanterne coûte son prix, occupe la case et se rend à moitié', () => {
    const p = new Partie(ile, [], 1, galerie.regles);
    const avant = p.instantane().spores;
    expect(p.lanterneLibre(lanterneProche)).toBe(true);
    expect(p.executer({ type: 'poserLanterne', case: lanterneProche })).toBe(true);
    const i = p.instantane();
    expect(i.spores).toBe(avant - LANTERNE.prix);
    expect(i.lanternes).toHaveLength(1);
    expect(i.lumieres).toHaveLength(7);
    expect(p.libre(lanterneProche)).toBe(false);
    expect(p.lanterneLibre(lanterneProche)).toBe(false);
    expect(p.executer({ type: 'enleverLanterne', id: i.lanternes[0]!.id })).toBe(true);
    expect(p.instantane().spores).toBe(avant - LANTERNE.prix + Math.floor(LANTERNE.prix * LANTERNE.partRendue));
  });

  it('pas de lanterne sur le sentier, un luisant, ni hors de la grotte', () => {
    const p = new Partie(ile, [], 1, galerie.regles);
    expect(p.lanterneLibre({ x: 6, y: 5 })).toBe(false);
    expect(p.lanterneLibre({ x: 17, y: 3 })).toBe(false);
    expect(p.libre({ x: 17, y: 3 })).toBe(false);
    const prairie = NIVEAUX_PRAIRIE[0]!;
    expect(new Partie(ileDe(prairie), [], 1, prairie.regles).lanterneLibre({ x: 4, y: 2 })).toBe(false);
  });

  it('une tour ne tire pas dans le noir ; une lanterne lui rend la vue', () => {
    const sans = jouer(false);
    expect(sans.degats).toBe(0);
    const avec = jouer(true);
    expect(avec.degats).toBeGreaterThan(0);
    expect(avec.tirsDansLeNoir).toBe(0);
  });
});
