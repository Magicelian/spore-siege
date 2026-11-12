// Le sentier vu comme un graphe de cases : plages d'arrivée, carrefours, plus court chemin vers la souche.
import type { Case, Ile } from './contrat';

/** Une plage de débarquement : les monstres apparaissent sur le sable, puis prennent le sentier à son entrée. */
export interface Plage {
  /** Case de sable où apparaissent les monstres. */
  depart: Case;
  /** Première case de sentier. */
  entree: Case;
}

export interface Sentier {
  /** Dans l'ordre de lecture de la carte (de haut en bas, puis de gauche à droite). */
  plages: Plage[];
  /** Cases de sentier où il se divise (trois voisins ou plus). */
  carrefours: Case[];
}

const VOISINS = [[0, -1], [1, 0], [0, 1], [-1, 0]] as const;

const cle = (c: Case) => `${c.x},${c.y}`;

function terrain(ile: Ile, x: number, y: number) {
  if (x < 0 || y < 0 || x >= ile.largeur || y >= ile.profondeur) return 'vide';
  return ile.terrain[y * ile.largeur + x] ?? 'vide';
}

function voisinsSentier(ile: Ile, c: Case): Case[] {
  return VOISINS.map(([dx, dy]) => ({ x: c.x + dx, y: c.y + dy })).filter((v) => terrain(ile, v.x, v.y) === 'sentier');
}

/** La case touche-t-elle l'emprise de la souche ? */
export function bordeSouche(ile: Ile, c: Case): boolean {
  const { souche, tailleSouche: t } = ile;
  const dedansX = c.x >= souche.x && c.x < souche.x + t;
  const dedansY = c.y >= souche.y && c.y < souche.y + t;
  return (dedansX && (c.y === souche.y - 1 || c.y === souche.y + t)) || (dedansY && (c.x === souche.x - 1 || c.x === souche.x + t));
}

export function lireSentier(ile: Ile): Sentier {
  const plages: Plage[] = [];
  const carrefours: Case[] = [];
  for (let y = 0; y < ile.profondeur; y++) {
    for (let x = 0; x < ile.largeur; x++) {
      if (terrain(ile, x, y) !== 'sentier') continue;
      const entree = { x, y };
      const suite = voisinsSentier(ile, entree);
      if (suite.length >= 3) carrefours.push(entree);
      const sables = VOISINS.map(([dx, dy]) => ({ x: x + dx, y: y + dy })).filter((v) => terrain(ile, v.x, v.y) === 'sable');
      if (sables.length === 0) continue;
      // On débarque à l'opposé de la direction que prend le sentier, sinon sur le premier sable venu.
      const prochaine = suite[0];
      const face = prochaine && sables.find((s) => s.x === 2 * x - prochaine.x && s.y === 2 * y - prochaine.y);
      plages.push({ depart: face ?? sables[0]!, entree });
    }
  }
  return { plages, carrefours };
}

/**
 * Plus court chemin sur le sentier, de `depart` jusqu'à une case qui borde la souche, sans passer par les cases
 * `bloquees`. Renvoie les cases traversées, `depart` compris ; `null` si la souche est inaccessible.
 */
export function route(ile: Ile, depart: Case, bloquees: ReadonlySet<string> = new Set()): Case[] | null {
  const precedente = new Map<string, Case | null>([[cle(depart), null]]);
  const file: Case[] = [depart];
  for (const c of file) {
    if (bordeSouche(ile, c)) {
      const chemin: Case[] = [];
      for (let p: Case | null = c; p; p = precedente.get(cle(p)) ?? null) chemin.unshift(p);
      return chemin;
    }
    for (const v of voisinsSentier(ile, c)) {
      if (precedente.has(cle(v)) || bloquees.has(cle(v))) continue;
      precedente.set(cle(v), c);
      file.push(v);
    }
  }
  return null;
}
