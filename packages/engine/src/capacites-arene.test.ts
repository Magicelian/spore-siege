// Arène des capacités : une seule tour (stade 3, puis chacune de ses deux capacités) face à un groupe de petits
// monstres, puis à une file de scarabées. Les monstres ont 4 fois leur vie pour qu'une tour ne vienne pas à bout de
// tout (le total ne dirait plus rien), sans rendre gratuits les gros coups sur les petits. On mesure les dégâts faits.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ileForet } from './carte';
import { CAPACITES_DE, MONSTRES, type Vague } from './contenu';
import type { Capacite, TypeTour } from './contrat';
import { Partie } from './partie';

declare const process: { stderr: { write(t: string): void } };

const PRES = { x: 6, y: 6 };
const GROUPE: Vague = [
  { type: 'moucheron', nombre: 30, intervalle: 0.5, plage: 1 },
  { type: 'limace', nombre: 15, intervalle: 1, plage: 1 },
];
const GROS: Vague = [{ type: 'scarabee', nombre: 10, intervalle: 2, plage: 1 }];

function degatsFaits(type: TypeTour, capacite: Capacite | null, vague: Vague): number {
  const p = new Partie(ileForet(), [vague], 1);
  (p as unknown as { spores: number }).spores = 9999;
  p.executer({ type: 'poserTour', tour: type, case: PRES });
  const id = p.instantane().tours[0]!.id;
  p.executer({ type: 'ameliorerTour', id });
  p.executer({ type: 'ameliorerTour', id });
  if (capacite) p.executer({ type: 'choisirCapacite', id, capacite });
  p.executer({ type: 'lancerVague' });
  let avant = new Map<number, number>();
  let degats = 0;
  for (let n = 0; n < 20_000; n++) {
    const i = p.instantane();
    const ici = new Map(i.monstres.map((m) => [m.id, m.pv]));
    for (const [m, pv] of avant) {
      const maintenant = ici.get(m);
      if (maintenant !== undefined) degats += Math.max(0, pv - maintenant);
      else if (i.evenements.some((e) => e.type === 'mort' && e.id === m)) degats += Math.max(0, pv);
    }
    avant = ici;
    if (i.phase !== 'vague') break;
    p.avancer();
  }
  return Math.round(degats);
}

const PV = Object.fromEntries(Object.entries(MONSTRES).map(([t, m]) => [t, m.pv]));
type Mesure = { groupe: number; gros: number };
const mesures = new Map<string, Mesure>();

describe('arène des capacités', () => {
  beforeAll(() => {
    for (const m of Object.values(MONSTRES)) m.pv *= 4;
    for (const type of Object.keys(CAPACITES_DE) as TypeTour[])
      for (const c of [null, ...CAPACITES_DE[type]])
        mesures.set(`${type}:${c ?? 'stade3'}`, { groupe: degatsFaits(type, c, GROUPE), gros: degatsFaits(type, c, GROS) });
  });
  afterAll(() => {
    for (const [t, m] of Object.entries(MONSTRES)) m.pv = PV[t]!;
  });

  it('rapport (affiché dans la sortie des tests)', () => {
    for (const [nom, m] of mesures) process.stderr.write(`${nom.padEnd(20)} groupe ${m.groupe}  gros ${m.gros}\n`);
  });

  it('la première capacité gagne contre les groupes, la seconde contre les gros', () => {
    for (const [type, [groupe, gros]] of Object.entries(CAPACITES_DE)) {
      const a = mesures.get(`${type}:${groupe}`)!;
      const b = mesures.get(`${type}:${gros}`)!;
      expect(a.groupe, `${groupe} contre les groupes`).toBeGreaterThan(b.groupe);
      expect(b.gros, `${gros} contre les gros`).toBeGreaterThan(a.gros);
    }
  });

  it('dans son rôle, le stade 4 fait au moins 1,5 fois mieux que le stade 3', () => {
    for (const [type, [groupe, gros]] of Object.entries(CAPACITES_DE)) {
      const base = mesures.get(`${type}:stade3`)!;
      expect(mesures.get(`${type}:${groupe}`)!.groupe, groupe).toBeGreaterThan(base.groupe * 1.5);
      expect(mesures.get(`${type}:${gros}`)!.gros, gros).toBeGreaterThan(base.gros * 1.5);
    }
  });
});
