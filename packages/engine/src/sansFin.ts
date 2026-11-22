// Mode vagues sans fin (ouvert après le Colosse d'écorce) : des vagues tirées de tout l'archipel, de plus en plus
// nombreuses, des monstres de plus en plus solides, un boss toutes les 10 vagues. La partie ne finit qu'à la défaite.
import type { TypeMonstre } from './contrat';
import { MONSTRES, type Groupe, type Vague } from './contenu';

export const SANS_FIN = {
  /** Vie des monstres : +6 % de la vie de base par vague passée (vague 11 = ×1,6). */
  vieParVague: 0.06,
  /** Une vague de boss toutes les `bossTous` vagues. */
  bossTous: 10,
  /** Vagues préparées d'avance : bien au-delà de ce qu'on peut tenir. */
  vagues: 400,
  /** Vie totale (vie de base) lâchée par vague : `base` + `parVague` × n. */
  base: 60,
  parVague: 30,
  /**
   * Les boss gardent cette part de leur vie de l'île (une morsure suffit à finir la partie). Réglé avec les scripts :
   * à 0,5 tous tombaient à la Limace-mère (vague 10) ; à 0,35 avec 550 spores, naïf 10, simple 25, bon > 50.
   */
  vieBoss: 0.25,
};

/** Les boss de l'archipel, dans l'ordre des îles : vague 10 = Limace-mère, 20 = Crapaud-roi… puis on recommence. */
export const BOSS_SANS_FIN: TypeMonstre[] = ['limaceMere', 'crapaudRoi', 'corbeau', 'ver', 'colosse'];

/** Chaque monstre entre dans le tirage à partir de sa vague (les plus étranges arrivent plus tard). */
const ENTREES: [TypeMonstre, number][] = [
  ['limace', 1],
  ['moucheron', 1],
  ['scarabee', 3],
  ['amas', 4],
  ['crapaud', 5],
  ['sangsue', 5],
  ['volant', 6],
  ['sauterelle', 6],
  ['soigneur', 7],
  ['chenille', 8],
  ['cloporte', 9],
  ['chauveSouris', 11],
  ['araignee', 12],
  ['ecureuil', 13],
];

/** Tirage déterministe dans [0, 1) pour la vague `n` et le tirage `k`. */
function alea(n: number, k: number): number {
  let h = Math.imul(n * 374761393 + k * 668265263, 1274126177) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1103515245) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Groupes ordinaires de la vague `n` pour une vie totale `budget`, en `nombre` groupes de sortes différentes. */
function groupes(n: number, budget: number, combien: number, debut = 0): Groupe[] {
  const pool = ENTREES.filter(([, v]) => v <= n).map(([t]) => t);
  const choisis: TypeMonstre[] = [];
  for (let k = 0; choisis.length < Math.min(combien, pool.length); k++) {
    const t = pool[Math.floor(alea(n, k) * pool.length)]!;
    if (!choisis.includes(t)) choisis.push(t);
  }
  return choisis.map((type, j) => {
    const nombre = Math.min(40, Math.max(1, Math.round(budget / choisis.length / MONSTRES[type].pv)));
    const intervalle = Math.round(Math.min(3.5, Math.max(0.25, 26 / nombre)) * 100) / 100;
    const plage = alea(n, 50 + j) < 0.5 ? undefined : Math.floor(alea(n, 60 + j) * 3);
    return { type, nombre, intervalle, debut: debut + 6 * j, ...(plage !== undefined && { plage }) };
  });
}

/** Vague `n` (1 = première) du mode sans fin. */
export function vagueSansFin(n: number): Vague {
  const budget = SANS_FIN.base + SANS_FIN.parVague * n;
  if (n % SANS_FIN.bossTous === 0) {
    const boss = BOSS_SANS_FIN[(n / SANS_FIN.bossTous - 1) % BOSS_SANS_FIN.length]!;
    return [{ type: boss, nombre: 1, intervalle: 1, debut: 4, plage: Math.floor(alea(n, 99) * 3) }, ...groupes(n, budget / 2, 1)];
  }
  return groupes(n, budget, n < 3 ? 1 : n < 8 ? 2 : 3);
}

export function vaguesSansFin(nombre = SANS_FIN.vagues): Vague[] {
  return Array.from({ length: nombre }, (_, i) => vagueSansFin(i + 1));
}

/** Vie des monstres à la vague `n` (multiplie celle de la difficulté) ; `boss` : un boss. */
export function vieSansFin(n: number, boss = false): number {
  return (1 + SANS_FIN.vieParVague * (n - 1)) * (boss ? SANS_FIN.vieBoss : 1);
}
