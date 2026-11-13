// Les niveaux : une carte, des vagues et des contraintes. Une île = 5 niveaux (4 + un boss), cahier §3.
import type { Biome, Capacite, Ile, Regles } from './contrat';
import { CARTE_COEUR, CARTE_FORET, CARTE_FOURRE, CARTE_SOUS_BOIS, CARTE_TROIS_SENTIERS, lireCarte } from './carte';
import { VAGUES_FORET } from './contenu';
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
      nombre: g.type === 'limaceMere' ? 1 : Math.max(1, Math.round(g.nombre * facteur)),
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
  { id: 'foret-1', nom: 'Clairière', biome: 'foret', carte: CARTE_FORET, vagues: VAGUES_CLAIRIERE, regles: { spores: 140 } },
  { id: 'foret-2', nom: 'Sous-bois', biome: 'foret', carte: CARTE_SOUS_BOIS, vagues: renforcer(VAGUES_SOUS_BOIS, 0.3), regles: { spores: 80 } },
  { id: 'foret-3', nom: 'Trois sentiers', biome: 'foret', carte: CARTE_TROIS_SENTIERS, vagues: renforcer(VAGUES_FORET, 1.2, 2), regles: { ronces: false } },
  {
    id: 'foret-4',
    nom: 'Fourré',
    biome: 'foret',
    carte: CARTE_FOURRE,
    vagues: renforcer(VAGUES_FOURRE, 0.8, 2),
    regles: { tours: ['cristal', 'canon'] },
  },
  { id: 'foret-5', nom: 'Cœur de la forêt', biome: 'foret', carte: CARTE_COEUR, vagues: VAGUES_COEUR, regles: {}, boss: true },
];
/** Niveaux de chaque île, dans l'ordre du parcours ; une île sans niveaux n'est pas encore jouable. */
export const NIVEAUX: Partial<Record<Biome, Niveau[]>> = { foret: NIVEAUX_FORET };

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
