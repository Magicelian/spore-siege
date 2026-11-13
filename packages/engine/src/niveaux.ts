// Les niveaux : une carte, des vagues et des contraintes. Une île = 5 niveaux (4 + un boss), cahier §3.
import type { Biome, Ile, Regles } from './contrat';
import { CARTE_FORET, lireCarte } from './carte';
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

export const NIVEAUX_FORET: Niveau[] = [
  { id: 'foret-1', nom: 'Clairière', biome: 'foret', carte: CARTE_FORET, vagues: VAGUES_CLAIRIERE, regles: { spores: 140 } },
];

export function ileDe(niveau: Niveau): Ile {
  return lireCarte(niveau.carte, niveau.biome);
}

export function partieDe(niveau: Niveau, graine: number): Partie {
  return new Partie(ileDe(niveau), niveau.vagues, graine, niveau.regles);
}
