// Chiffres de la partie. Provisoires : la courbe des 10 vagues s'équilibre à l'étape 5 (joueur scripté).
import type { TypeMonstre } from './contrat';

/** Durée d'un pas de simulation : 20 pas par seconde. */
export const PAS_MS = 50;
export const PAS_PAR_SECONDE = 1000 / PAS_MS;

export const PV_SOUCHE = 20;
/** Pause avant chaque vague, pour construire ; un bouton l'écourte. */
export const PAUSE_SECONDES = 20;

export interface FicheMonstre {
  pv: number;
  /** Cases par seconde. */
  vitesse: number;
  /** Points de vie retirés à la souche en l'atteignant. */
  morsure: number;
}

export const MONSTRES: Record<TypeMonstre, FicheMonstre> = {
  limace: { pv: 10, vitesse: 0.8, morsure: 1 },
  moucheron: { pv: 6, vitesse: 2, morsure: 1 },
  scarabee: { pv: 40, vitesse: 0.6, morsure: 2 },
  amas: { pv: 25, vitesse: 0.7, morsure: 2 },
  petitAmas: { pv: 8, vitesse: 1, morsure: 1 },
};

/** Un groupe de monstres identiques, lâchés un par un sur une plage. */
export interface Groupe {
  type: TypeMonstre;
  nombre: number;
  /** Secondes entre deux monstres. */
  intervalle: number;
  /** Secondes après le début de la vague. */
  debut?: number;
  /** Rang de la plage (ordre de lecture de la carte) ; toutes à tour de rôle si absent. */
  plage?: number;
}

export type Vague = Groupe[];

/** Île-forêt : plage 0 au nord-est, plage 1 à l'ouest. */
export const VAGUES_FORET: Vague[] = [
  [{ type: 'limace', nombre: 6, intervalle: 1.5, plage: 1 }],
  [{ type: 'limace', nombre: 8, intervalle: 1.2 }],
  [
    { type: 'limace', nombre: 6, intervalle: 1.5, plage: 1 },
    { type: 'moucheron', nombre: 6, intervalle: 1, debut: 4, plage: 0 },
  ],
  [{ type: 'moucheron', nombre: 12, intervalle: 0.6 }],
  [
    { type: 'scarabee', nombre: 3, intervalle: 3, plage: 1 },
    { type: 'limace', nombre: 8, intervalle: 1, debut: 2, plage: 0 },
  ],
  [
    { type: 'amas', nombre: 4, intervalle: 2.5 },
    { type: 'moucheron', nombre: 8, intervalle: 0.7, debut: 5 },
  ],
  [{ type: 'scarabee', nombre: 6, intervalle: 2 }],
  [
    { type: 'amas', nombre: 6, intervalle: 2, plage: 0 },
    { type: 'scarabee', nombre: 6, intervalle: 2, plage: 1 },
  ],
  [
    { type: 'moucheron', nombre: 15, intervalle: 0.5 },
    { type: 'limace', nombre: 6, intervalle: 1, debut: 3 },
    { type: 'scarabee', nombre: 4, intervalle: 2.5, debut: 6 },
  ],
  [
    { type: 'amas', nombre: 8, intervalle: 1.8, plage: 1 },
    { type: 'scarabee', nombre: 8, intervalle: 1.8, plage: 0 },
    { type: 'moucheron', nombre: 15, intervalle: 0.5, debut: 8 },
  ],
];
