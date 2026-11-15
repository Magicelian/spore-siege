// Les niveaux : une carte, des vagues et des contraintes. Une île = 5 niveaux (4 + un boss), cahier §3.
import type { Biome, Capacite, Ile, Regles } from './contrat';
import {
  CARTE_BRAS_MORTS,
  CARTE_COEUR,
  CARTE_COEUR_MARAIS,
  CARTE_GALERIE,
  CARTE_FORET,
  CARTE_FOURRE,
  CARTE_GUES,
  CARTE_CHAMPS_MOULIN,
  CARTE_COEUR_PRAIRIE,
  CARTE_HAUTES_HERBES,
  CARTE_LISIERE,
  CARTE_PRES_FLEURIS,
  CARTE_ROSELIERE,
  CARTE_SOUS_BOIS,
  CARTE_TOURBIERE,
  CARTE_TROIS_SENTIERS,
  lireCarte,
} from './carte';
import { MONSTRES, TOURS_DE_BASE, VAGUES_FORET } from './contenu';
import type { Vague } from './contenu';
import { Partie } from './partie';

export interface Niveau {
  /** Clé de sauvegarde des étoiles, stable d'une version à l'autre. */
  id: string;
  nom: string;
  biome: Biome;
  /** Carte en lettres (voir `carte.ts`). */
  carte: readonly string[];
  vagues: Vague[];
  /** Contraintes ; ce qui manque prend la valeur normale (120 spores, 4 tours, ronces permises). */
  regles: Partial<Regles>;
  /** Niveau de boss : s'ouvre avec assez d'étoiles sur les niveaux de l'île. */
  boss?: boolean;
}

/**
 * Vagues renforcées (ou allégées) : la première vague a `debut` fois plus de monstres par groupe, la dernière `fin`
 * fois plus, entre les deux le facteur monte en ligne droite ; les monstres sont lâchés √facteur fois plus vite.
 * Le boss reste seul.
 */
export function renforcer(vagues: readonly Vague[], debut: number, fin = debut): Vague[] {
  return vagues.map((v, i) => {
    const facteur = debut + ((fin - debut) * i) / Math.max(1, vagues.length - 1);
    return v.map((g) => ({
      ...g,
      nombre: MONSTRES[g.type].boss ? 1 : Math.max(1, Math.round(g.nombre * facteur)),
      intervalle: Math.round((g.intervalle / Math.sqrt(facteur)) * 100) / 100,
    }));
  });
}

/**
 * Clairière (forêt, niveau 1) : on apprend. Huit vagues qui présentent les monstres un par un, moins nombreux que
 * sur l'ancienne forêt unique. Plage 0 au nord-est, plage 1 à l'ouest.
 */
export const VAGUES_CLAIRIERE: Vague[] = [
  [{ type: 'limace', nombre: 6, intervalle: 3.5, plage: 1 }],
  [{ type: 'limace', nombre: 10, intervalle: 2.5 }],
  [
    { type: 'limace', nombre: 6, intervalle: 2.5, plage: 1 },
    { type: 'moucheron', nombre: 10, intervalle: 1.4, debut: 8, plage: 0 },
  ],
  [
    { type: 'moucheron', nombre: 18, intervalle: 1 },
    { type: 'limace', nombre: 8, intervalle: 3, debut: 5 },
  ],
  [
    { type: 'scarabee', nombre: 2, intervalle: 8, plage: 1 },
    { type: 'limace', nombre: 10, intervalle: 2, debut: 3, plage: 0 },
  ],
  [
    { type: 'amas', nombre: 4, intervalle: 5 },
    { type: 'moucheron', nombre: 12, intervalle: 1, debut: 10 },
  ],
  [
    { type: 'scarabee', nombre: 6, intervalle: 4 },
    { type: 'limace', nombre: 14, intervalle: 1.8, debut: 6 },
  ],
  [
    { type: 'amas', nombre: 4, intervalle: 4.5, plage: 0 },
    { type: 'scarabee', nombre: 4, intervalle: 4.5, plage: 1 },
    { type: 'moucheron', nombre: 14, intervalle: 1, debut: 15 },
  ],
];

/** Sous-bois (niveau 2), avant `renforcer` : plage 0 au nord-ouest, 1 au nord-est. Arrivée de la phalène. */
export const VAGUES_SOUS_BOIS: Vague[] = [
  [{ type: 'limace', nombre: 6, intervalle: 3.5, plage: 0 }],
  [
    { type: 'limace', nombre: 8, intervalle: 3, plage: 1 },
    { type: 'volant', nombre: 2, intervalle: 5, debut: 12, plage: 0 },
  ],
  [
    { type: 'moucheron', nombre: 14, intervalle: 1.1 },
    { type: 'limace', nombre: 8, intervalle: 2.5, debut: 6 },
  ],
  [
    { type: 'volant', nombre: 8, intervalle: 2.5 },
    { type: 'limace', nombre: 10, intervalle: 2, debut: 4 },
  ],
  [
    { type: 'scarabee', nombre: 4, intervalle: 5 },
    { type: 'moucheron', nombre: 16, intervalle: 0.9, debut: 8 },
  ],
  [
    { type: 'amas', nombre: 6, intervalle: 4 },
    { type: 'volant', nombre: 8, intervalle: 2, debut: 10 },
  ],
  [
    { type: 'scarabee', nombre: 8, intervalle: 3.5 },
    { type: 'limace', nombre: 16, intervalle: 1.5, debut: 5 },
  ],
  [
    { type: 'amas', nombre: 8, intervalle: 3 },
    { type: 'volant', nombre: 12, intervalle: 1.5, debut: 8 },
    { type: 'moucheron', nombre: 16, intervalle: 0.8, debut: 15 },
  ],
  [
    { type: 'moucheron', nombre: 30, intervalle: 0.6 },
    { type: 'scarabee', nombre: 10, intervalle: 2.8, debut: 8 },
    { type: 'volant', nombre: 10, intervalle: 1.6, debut: 12 },
  ],
  [
    { type: 'amas', nombre: 12, intervalle: 2.4 },
    { type: 'scarabee', nombre: 12, intervalle: 2.4 },
    { type: 'volant', nombre: 14, intervalle: 1.2, debut: 15 },
  ],
];

/** Fourré (niveau 4), avant `renforcer` : plage 0 au sud-est, 1 au sud. Arrivée du prêtre champignon. */
export const VAGUES_FOURRE: Vague[] = [
  [{ type: 'limace', nombre: 10, intervalle: 2.5 }],
  [
    { type: 'limace', nombre: 8, intervalle: 2.5 },
    { type: 'soigneur', nombre: 1, intervalle: 1, debut: 12, plage: 1 },
  ],
  [
    { type: 'moucheron', nombre: 18, intervalle: 1 },
    { type: 'limace', nombre: 8, intervalle: 2.5 },
  ],
  [
    { type: 'soigneur', nombre: 3, intervalle: 5 },
    { type: 'limace', nombre: 16, intervalle: 1.4, debut: 2 },
  ],
  [
    { type: 'scarabee', nombre: 6, intervalle: 4 },
    { type: 'soigneur', nombre: 2, intervalle: 6, debut: 4 },
  ],
  [
    { type: 'amas', nombre: 8, intervalle: 3.5 },
    { type: 'moucheron', nombre: 20, intervalle: 0.8, debut: 10 },
  ],
  [
    { type: 'soigneur', nombre: 4, intervalle: 4 },
    { type: 'scarabee', nombre: 8, intervalle: 3.5, debut: 2 },
  ],
  [
    { type: 'amas', nombre: 10, intervalle: 2.8 },
    { type: 'soigneur', nombre: 4, intervalle: 5, debut: 5 },
    { type: 'limace', nombre: 16, intervalle: 1.2, debut: 8 },
  ],
  [
    { type: 'moucheron', nombre: 30, intervalle: 0.6 },
    { type: 'scarabee', nombre: 12, intervalle: 2.6, debut: 8 },
    { type: 'soigneur', nombre: 5, intervalle: 4, debut: 10 },
  ],
  [
    { type: 'amas', nombre: 14, intervalle: 2.2 },
    { type: 'scarabee', nombre: 14, intervalle: 2.2 },
    { type: 'soigneur', nombre: 6, intervalle: 3.5, debut: 6 },
  ],
];

/** Cœur de la forêt (niveau 5, boss) : plage 0 à l'ouest, 1 à l'est. La Limace-mère ferme la marche. */
export const VAGUES_COEUR: Vague[] = [
  [{ type: 'limace', nombre: 12, intervalle: 2 }],
  [{ type: 'moucheron', nombre: 20, intervalle: 0.9 }],
  [
    { type: 'limace', nombre: 14, intervalle: 1.8 },
    { type: 'moucheron', nombre: 12, intervalle: 1, debut: 8 },
  ],
  [
    { type: 'amas', nombre: 6, intervalle: 4 },
    { type: 'volant', nombre: 6, intervalle: 2.5, debut: 6 },
  ],
  [
    { type: 'soigneur', nombre: 3, intervalle: 5 },
    { type: 'scarabee', nombre: 8, intervalle: 3.5, debut: 3 },
  ],
  [
    { type: 'moucheron', nombre: 30, intervalle: 0.6 },
    { type: 'amas', nombre: 8, intervalle: 3, debut: 10 },
  ],
  [
    { type: 'scarabee', nombre: 12, intervalle: 2.8 },
    { type: 'soigneur', nombre: 4, intervalle: 4.5, debut: 5 },
    { type: 'volant', nombre: 8, intervalle: 2, debut: 10 },
  ],
  [
    { type: 'amas', nombre: 14, intervalle: 2.4 },
    { type: 'limace', nombre: 20, intervalle: 1.2, debut: 6 },
    { type: 'soigneur', nombre: 4, intervalle: 5, debut: 10 },
  ],
  [
    { type: 'scarabee', nombre: 16, intervalle: 2.2 },
    { type: 'moucheron', nombre: 30, intervalle: 0.6, debut: 10 },
    { type: 'volant', nombre: 12, intervalle: 1.4, debut: 15 },
  ],
  [
    { type: 'limaceMere', nombre: 1, intervalle: 1, plage: 1 },
    { type: 'limace', nombre: 20, intervalle: 1.5, debut: 5 },
    { type: 'soigneur', nombre: 3, intervalle: 6, debut: 10 },
  ],
];

/**
 * Les cinq niveaux de la forêt. Les facteurs de `renforcer` ont été réglés à l'étape 8d avec les joueurs scriptés
 * (`equilibrage.test.ts`) : relancer ces tests après tout changement de chiffres.
 */
export const NIVEAUX_FORET: Niveau[] = [
  { id: 'foret-1', nom: 'Clairière', biome: 'foret', carte: CARTE_FORET, vagues: VAGUES_CLAIRIERE, regles: { spores: 140, tours: TOURS_DE_BASE } },
  { id: 'foret-2', nom: 'Sous-bois', biome: 'foret', carte: CARTE_SOUS_BOIS, vagues: renforcer(VAGUES_SOUS_BOIS, 0.3), regles: { spores: 80, tours: TOURS_DE_BASE } },
  { id: 'foret-3', nom: 'Trois sentiers', biome: 'foret', carte: CARTE_TROIS_SENTIERS, vagues: renforcer(VAGUES_FORET, 1.2, 2), regles: { ronces: false, tours: TOURS_DE_BASE } },
  {
    id: 'foret-4',
    nom: 'Fourré',
    biome: 'foret',
    carte: CARTE_FOURRE,
    vagues: renforcer(VAGUES_FOURRE, 0.8, 1.8),
    regles: { tours: ['cristal', 'canon'] },
  },
  { id: 'foret-5', nom: 'Cœur de la forêt', biome: 'foret', carte: CARTE_COEUR, vagues: VAGUES_COEUR, regles: { tours: TOURS_DE_BASE }, boss: true },
];
type G = Vague[number];
const g = (type: G['type'], nombre: number, intervalle: number, debut?: number, plage?: number): G => ({
  type,
  nombre,
  intervalle,
  ...(debut !== undefined && { debut }),
  ...(plage !== undefined && { plage }),
});

/** Les Gués (marais, niveau 2) : la Sangsue arrive. Plage 0 au nord-est, 1 à l'ouest (le chemin des gués). */
export const VAGUES_GUES: Vague[] = [
  [g('limace', 12, 2)],
  [g('sangsue', 8, 2.2, 0, 1)],
  [g('limace', 10, 2), g('moucheron', 14, 1, 8)],
  [g('sangsue', 12, 1.6), g('limace', 8, 2, 6)],
  [g('scarabee', 5, 4), g('sangsue', 10, 1.5, 4)],
  [g('amas', 8, 3), g('volant', 6, 2, 10)],
  [g('sangsue', 18, 1), g('scarabee', 6, 3, 6)],
  [g('moucheron', 30, 0.6), g('soigneur', 3, 5, 8)],
  [g('amas', 12, 2.5), g('sangsue', 16, 1.2, 5)],
  [g('scarabee', 14, 2.2), g('sangsue', 20, 1, 6), g('volant', 8, 1.6, 12)],
];

/** Tourbière (marais, niveau 3) : le Crapaud arrive. Une seule plage, au sud. */
export const VAGUES_TOURBIERE: Vague[] = [
  [g('limace', 14, 1.8)],
  [g('crapaud', 8, 2.5)],
  [g('moucheron', 20, 0.9), g('crapaud', 6, 2.5, 8)],
  [g('scarabee', 6, 3.5), g('limace', 12, 1.5, 4)],
  [g('crapaud', 14, 1.6), g('sangsue', 8, 1.8, 6)],
  [g('amas', 10, 2.6), g('soigneur', 3, 5, 8)],
  [g('crapaud', 18, 1.3), g('scarabee', 6, 3, 10)],
  [g('volant', 10, 1.6), g('amas', 10, 2.5, 6)],
  [g('sangsue', 16, 1.1), g('crapaud', 16, 1.2, 6)],
  [g('scarabee', 14, 2.2), g('crapaud', 20, 1, 6), g('soigneur', 4, 4, 12)],
];

/** Bras morts (marais, niveau 4) : héron et mortier seuls, donc pas de phalène (ni l'un ni l'autre ne l'atteint). */
export const VAGUES_BRAS_MORTS: Vague[] = [
  [g('limace', 14, 1.8)],
  [g('sangsue', 12, 1.8)],
  [g('crapaud', 10, 2), g('moucheron', 16, 1, 6)],
  [g('amas', 8, 3), g('limace', 12, 1.5, 5)],
  [g('scarabee', 8, 3), g('sangsue', 12, 1.5, 5)],
  [g('crapaud', 16, 1.4), g('soigneur', 3, 5, 8)],
  [g('moucheron', 36, 0.5), g('amas', 8, 3, 8)],
  [g('scarabee', 12, 2.5), g('crapaud', 14, 1.3, 6)],
  [g('sangsue', 20, 1), g('amas', 12, 2.5, 5), g('soigneur', 4, 4, 10)],
  [g('scarabee', 16, 2.2), g('crapaud', 20, 1, 6), g('sangsue', 16, 1, 12)],
];

/** Cœur du marais (niveau 5, boss) : plage 0 au nord-est, 1 à l'ouest. Le Crapaud-roi ferme la marche. */
export const VAGUES_COEUR_MARAIS: Vague[] = [
  [g('limace', 14, 1.8)],
  [g('sangsue', 12, 1.8)],
  [g('crapaud', 12, 1.8), g('moucheron', 16, 1, 6)],
  [g('amas', 8, 3), g('volant', 4, 3, 6)],
  [g('soigneur', 3, 5), g('scarabee', 8, 3.5, 3)],
  [g('sangsue', 18, 1.1), g('crapaud', 12, 1.6, 6)],
  [g('scarabee', 12, 2.8), g('volant', 5, 2.5, 8), g('soigneur', 4, 4.5, 5)],
  [g('amas', 14, 2.4), g('crapaud', 18, 1.2, 6)],
  [g('scarabee', 16, 2.2), g('sangsue', 20, 1, 8), g('volant', 6, 2, 14)],
  [g('crapaudRoi', 1, 1, 0, 1), g('crapaud', 16, 1.5, 5), g('sangsue', 12, 1.6, 10)],
];

/**
 * Les niveaux du marais (cahier §3) : l'eau, ses gués qui ralentissent et ses nénuphars. Facteurs de `renforcer`
 * réglés en 9e avec les joueurs scriptés (`equilibrage.test.ts`).
 */
export const NIVEAUX_MARAIS: Niveau[] = [
  { id: 'marais-1', nom: 'Roselière', biome: 'marais', carte: CARTE_ROSELIERE, vagues: renforcer(VAGUES_FORET, 1.6, 2.6), regles: { spores: 90 } },
  { id: 'marais-2', nom: 'Les Gués', biome: 'marais', carte: CARTE_GUES, vagues: renforcer(VAGUES_GUES, 1.3, 1.8), regles: { ronces: false } },
  { id: 'marais-3', nom: 'Tourbière', biome: 'marais', carte: CARTE_TOURBIERE, vagues: renforcer(VAGUES_TOURBIERE, 0.5, 0.9), regles: { spores: 100 } },
  {
    id: 'marais-4',
    nom: 'Bras morts',
    biome: 'marais',
    carte: CARTE_BRAS_MORTS,
    vagues: renforcer(VAGUES_BRAS_MORTS, 1, 1.6),
    regles: { tours: ['heron', 'mortier'] },
  },
  { id: 'marais-5', nom: 'Cœur du marais', biome: 'marais', carte: CARTE_COEUR_MARAIS, vagues: renforcer(VAGUES_COEUR_MARAIS, 0.8, 1.2), regles: {}, boss: true },
];

/** Lisière (prairie, niveau 2) : la Chenille arrive. Plage 0 au nord-est, 1 au sud. */
export const VAGUES_LISIERE: Vague[] = [
  [g('limace', 12, 2)],
  [g('chenille', 6, 3, 0, 1)],
  [g('moucheron', 18, 1), g('chenille', 4, 3, 6)],
  [g('scarabee', 5, 4), g('limace', 12, 1.6, 4)],
  [g('chenille', 10, 2), g('volant', 6, 2, 8)],
  [g('amas', 8, 3), g('chenille', 8, 2.2, 6)],
  [g('scarabee', 8, 3), g('moucheron', 24, 0.8, 6)],
  [g('chenille', 14, 1.6), g('soigneur', 3, 5, 8)],
  [g('amas', 10, 2.5), g('scarabee', 8, 3, 5)],
  [g('chenille', 16, 1.4), g('scarabee', 10, 2.5, 4), g('volant', 8, 1.6, 12)],
];

/** Hautes herbes (prairie, niveau 3) : les Sauterelles arrivent, en essaims. Plage 0 au nord-est, 1 à l'ouest. */
export const VAGUES_HAUTES_HERBES: Vague[] = [
  [g('limace', 14, 1.8)],
  [g('sauterelle', 20, 0.35)],
  [g('chenille', 8, 2.5), g('sauterelle', 16, 0.35, 8)],
  [g('scarabee', 6, 3.5), g('limace', 12, 1.5, 4)],
  [g('sauterelle', 30, 0.3), g('amas', 4, 3, 6)],
  [g('chenille', 10, 2), g('soigneur', 3, 5, 6)],
  [g('sauterelle', 40, 0.25), g('scarabee', 6, 3, 8)],
  [g('volant', 10, 1.6), g('amas', 10, 2.5, 6)],
  [g('sauterelle', 50, 0.2), g('chenille', 12, 1.6, 4)],
  [g('scarabee', 14, 2.2), g('sauterelle', 40, 0.25, 8), g('amas', 8, 2.5, 14)],
];

/** Champs du moulin (prairie, niveau 4) : trois plages (0 nord-est, 1 ouest, 2 sud), peu de spores au départ. */
export const VAGUES_CHAMPS_MOULIN: Vague[] = [
  [g('limace', 12, 2, 0, 1)],
  [g('chenille', 8, 2.5), g('sauterelle', 14, 0.4, 6)],
  [g('moucheron', 20, 0.9), g('limace', 10, 1.8, 4)],
  [g('scarabee', 6, 3.5), g('chenille', 8, 2, 6)],
  [g('sauterelle', 30, 0.3), g('volant', 6, 2, 6)],
  [g('amas', 10, 2.6), g('soigneur', 3, 5, 8)],
  [g('chenille', 14, 1.6), g('scarabee', 6, 3, 8)],
  [g('sauterelle', 40, 0.25), g('amas', 8, 2.5, 8)],
  [g('scarabee', 12, 2.4), g('chenille', 12, 1.6, 6), g('volant', 8, 1.6, 12)],
  [g('amas', 12, 2.2), g('sauterelle', 40, 0.25, 6), g('scarabee', 10, 2.5, 12)],
];

/** Cœur de la prairie (boss) : le Grand Corbeau en dernière vague. Plage 0 à l'est, 1 à l'ouest. */
export const VAGUES_COEUR_PRAIRIE: Vague[] = [
  [g('limace', 14, 1.8)],
  [g('chenille', 8, 2.5), g('sauterelle', 16, 0.35, 6)],
  [g('moucheron', 22, 0.8), g('scarabee', 4, 4, 6)],
  [g('sauterelle', 30, 0.3), g('chenille', 8, 2, 6)],
  [g('amas', 10, 2.6), g('volant', 4, 2.5, 8)],
  [g('scarabee', 10, 2.6), g('soigneur', 3, 5, 8)],
  [g('sauterelle', 45, 0.22), g('chenille', 12, 1.6, 6)],
  [g('amas', 12, 2.4), g('scarabee', 10, 2.6, 8)],
  [g('chenille', 16, 1.4), g('sauterelle', 40, 0.25, 6), g('volant', 5, 2.4, 12)],
  [g('corbeau', 1, 1, 4, 0), g('scarabee', 10, 2.5), g('sauterelle', 30, 0.3, 10), g('chenille', 10, 2, 6)],
];

/**
 * Les niveaux de la prairie (cahier §3) : les fleurs à spores, qu'on plante à la place d'une tour et qui rapportent à
 * chaque fin de vague. Facteurs de `renforcer` réglés en 10d avec les joueurs scriptés (`equilibrage.test.ts`).
 */
export const NIVEAUX_PRAIRIE: Niveau[] = [
  { id: 'prairie-1', nom: 'Prés fleuris', biome: 'prairie', carte: CARTE_PRES_FLEURIS, vagues: renforcer(VAGUES_FORET, 0.8, 1.4), regles: { fleurs: true } },
  { id: 'prairie-2', nom: 'Lisière', biome: 'prairie', carte: CARTE_LISIERE, vagues: renforcer(VAGUES_LISIERE, 0.6, 1), regles: { fleurs: true } },
  {
    id: 'prairie-3',
    nom: 'Hautes herbes',
    biome: 'prairie',
    carte: CARTE_HAUTES_HERBES,
    vagues: renforcer(VAGUES_HAUTES_HERBES, 1, 1.5),
    regles: { fleurs: true, ronces: false },
  },
  {
    id: 'prairie-4',
    nom: 'Champs du moulin',
    biome: 'prairie',
    carte: CARTE_CHAMPS_MOULIN,
    vagues: renforcer(VAGUES_CHAMPS_MOULIN, 0.6, 1),
    regles: { fleurs: true, spores: 100 },
  },
  {
    id: 'prairie-5',
    nom: 'Cœur de la prairie',
    biome: 'prairie',
    carte: CARTE_COEUR_PRAIRIE,
    vagues: renforcer(VAGUES_COEUR_PRAIRIE, 0.8, 1.3),
    regles: { fleurs: true },
    boss: true,
  },
];

/**
 * Galerie des luisants (grotte 1) : 9 vagues qui montent doucement, monstres des trois autres îles. Plage 0 = nord-est,
 * 1 = ouest.
 */
export const VAGUES_GALERIE: Vague[] = [
  [g('limace', 8, 3, 0, 1)],
  [g('limace', 14, 2)],
  [g('limace', 10, 2.2, 0, 1), g('crapaud', 6, 3, 8, 0)],
  [g('moucheron', 24, 0.8), g('limace', 8, 3, 5)],
  [g('scarabee', 5, 5, 0, 1), g('limace', 16, 1.5, 3, 0)],
  [g('amas', 6, 3.5), g('soigneur', 2, 6, 6), g('limace', 10, 1.5, 4)],
  [g('limace', 14, 1.6, 0, 0), g('crapaud', 10, 2, 4, 1), g('sauterelle', 16, 0.4, 10)],
  [g('scarabee', 10, 3), g('sauterelle', 30, 0.3, 6)],
  [g('amas', 10, 2.6, 0, 0), g('scarabee', 10, 2.6, 0, 1), g('limace', 14, 1.4, 12), g('soigneur', 3, 5, 8)],
];

/**
 * La grotte : le noir (les tours ne visent que les monstres éclairés), les luisants de la carte et les
 * champignons-lanternes. Niveau 1 ≈ niveau 3 de la prairie. Les niveaux 2 à 5 viennent en 11d.
 */
export const NIVEAUX_GROTTE: Niveau[] = [
  { id: 'grotte-1', nom: 'Galerie des luisants', biome: 'grotte', carte: CARTE_GALERIE, vagues: renforcer(VAGUES_GALERIE, 0.8, 1.2), regles: { noir: true, spores: 150 } },
];

/** Niveaux de chaque île, dans l'ordre du parcours ; une île sans niveaux n'est pas encore jouable. */
export const NIVEAUX: Partial<Record<Biome, Niveau[]>> = { foret: NIVEAUX_FORET, marais: NIVEAUX_MARAIS, prairie: NIVEAUX_PRAIRIE, grotte: NIVEAUX_GROTTE };

/** Étoiles à réunir sur les 4 niveaux d'une île pour ouvrir son boss. */
export const SEUIL_BOSS = 8;

/** Un niveau est-il ouvert ? Le premier toujours ; les suivants avec ≥ 1 étoile au précédent ; le boss avec le seuil. */
export function niveauOuvert(niveaux: readonly Niveau[], rang: number, etoiles: Readonly<Record<string, number>>): boolean {
  const niveau = niveaux[rang];
  if (!niveau) return false;
  if (rang > 0 && (etoiles[niveaux[rang - 1]!.id] ?? 0) < 1) return false;
  if (!niveau.boss) return true;
  const avant = niveaux.slice(0, rang).reduce((n, x) => n + (etoiles[x.id] ?? 0), 0);
  return avant >= SEUIL_BOSS;
}

export function ileDe(niveau: Niveau): Ile {
  return lireCarte(niveau.carte, niveau.biome);
}

/** Partie neuve sur `niveau` ; `capacites` = capacités ouvertes dans l'Atelier (toutes si absent). */
export function partieDe(niveau: Niveau, graine: number, capacites?: Capacite[]): Partie {
  return new Partie(ileDe(niveau), niveau.vagues, graine, { ...niveau.regles, ...(capacites && { capacites }) });
}
