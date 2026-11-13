// Chiffres de la partie. Provisoires : la courbe des 10 vagues s'équilibre à l'étape 5 (joueur scripté).
import type { TypeMonstre, TypeTour } from './contrat';

/** Durée d'un pas de simulation : 20 pas par seconde. */
export const PAS_MS = 50;
export const PAS_PAR_SECONDE = 1000 / PAS_MS;

export const PV_SOUCHE = 20;
/** Pause avant chaque vague, pour construire ; un bouton l'écourte. */
export const PAUSE_SECONDES = 25;

export interface FicheMonstre {
  pv: number;
  /** Cases par seconde. */
  vitesse: number;
  /** Points de vie retirés à la souche en l'atteignant. */
  morsure: number;
  /** Spores lâchées en mourant. */
  butin: number;
  /** Retiré à chaque coup (au moins 1 dégât passe) ; l'éclair du cristal l'ignore. */
  armure: number;
}

export const MONSTRES: Record<TypeMonstre, FicheMonstre> = {
  limace: { pv: 12, vitesse: 0.8, morsure: 1, butin: 2, armure: 0 },
  moucheron: { pv: 7, vitesse: 1.8, morsure: 1, butin: 1, armure: 0 },
  scarabee: { pv: 65, vitesse: 0.55, morsure: 2, butin: 6, armure: 3 },
  amas: { pv: 45, vitesse: 0.7, morsure: 2, butin: 4, armure: 0 },
  petitAmas: { pv: 12, vitesse: 1, morsure: 1, butin: 1, armure: 0 },
};

/** Spores au départ : de quoi poser les deux premières tours. */
export const SPORES_DEPART = 120;
/** Bonus à la fin de chaque vague : fixe + par numéro de vague. */
export const BONUS_VAGUE = { fixe: 10, parVague: 3 };
/** Lancer la vague plus tôt rapporte une spore par seconde de pause restante. */
export const BONUS_PAR_SECONDE_GAGNEE = 1;
/** Une ronce ferme une branche à un carrefour ; enlevée, elle rend la moitié de son prix. */
export const PRIX_RONCE = 40;
export const PART_RONCE_RENDUE = 0.5;

/** Part du prix payé (pose et améliorations) rendue à la revente. */
export const PART_REVENTE = 0.7;

/** Un stade de tour ; `prix` : la pose pour le stade 1, l'amélioration pour les suivants. */
export interface StadeTour {
  prix: number;
  degats: number;
  /** En cases, depuis le centre de la tour. */
  portee: number;
  /** Secondes entre deux tirs. */
  cadence: number;
  /** Cristal : monstres touchés en plus du premier. */
  rebonds?: number;
}

export interface FicheTour {
  stades: [StadeTour, StadeTour, StadeTour];
  /** Sans projectile, le coup est immédiat (éclair). `guide` : suit sa cible ; sinon vise où elle sera. */
  projectile?: { vitesse: number; guide: boolean; rayon: number };
  /** Cristal : portée d'un rebond et part des dégâts gardée à chaque rebond. */
  eclair?: { distance: number; attenuation: number };
  /** Mortier : ralentit les monstres touchés. */
  ralenti?: { facteur: number; duree: number };
}

export const TOURS: Record<TypeTour, FicheTour> = {
  ruche: {
    stades: [
      { prix: 50, degats: 2, portee: 2.5, cadence: 0.5 },
      { prix: 40, degats: 3, portee: 2.8, cadence: 0.4 },
      { prix: 70, degats: 5, portee: 3.1, cadence: 0.35 },
    ],
    projectile: { vitesse: 8, guide: true, rayon: 0 },
  },
  cristal: {
    stades: [
      // Rééquilibré le 13/11/2026 : à 70 spores / 6 dégâts / 1,2 s, des cristaux seuls gagnaient à 3 étoiles.
      { prix: 75, degats: 5, portee: 2.5, cadence: 1.6, rebonds: 2 },
      { prix: 60, degats: 8, portee: 2.7, cadence: 1.5, rebonds: 3 },
      { prix: 95, degats: 11, portee: 3, cadence: 1.4, rebonds: 4 },
    ],
    eclair: { distance: 1.8, attenuation: 0.75 },
  },
  mortier: {
    stades: [
      { prix: 60, degats: 4, portee: 3.5, cadence: 2.2 },
      { prix: 50, degats: 6, portee: 3.8, cadence: 2 },
      { prix: 80, degats: 9, portee: 4.2, cadence: 1.8 },
    ],
    projectile: { vitesse: 3, guide: false, rayon: 1 },
    ralenti: { facteur: 0.5, duree: 2.5 },
  },
  canon: {
    stades: [
      { prix: 90, degats: 12, portee: 3, cadence: 2.5 },
      { prix: 70, degats: 18, portee: 3.2, cadence: 2.3 },
      { prix: 110, degats: 26, portee: 3.5, cadence: 2.1 },
    ],
    projectile: { vitesse: 5, guide: false, rayon: 1.2 },
  },
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
  [{ type: 'limace', nombre: 8, intervalle: 3, plage: 1 }],
  [{ type: 'limace', nombre: 14, intervalle: 2 }],
  [
    { type: 'limace', nombre: 10, intervalle: 2.2, plage: 1 },
    { type: 'moucheron', nombre: 12, intervalle: 1.2, debut: 8, plage: 0 },
  ],
  [
    { type: 'moucheron', nombre: 30, intervalle: 0.8 },
    { type: 'limace', nombre: 8, intervalle: 3, debut: 5 },
  ],
  [
    { type: 'scarabee', nombre: 5, intervalle: 5, plage: 1 },
    { type: 'limace', nombre: 16, intervalle: 1.5, debut: 3, plage: 0 },
  ],
  [
    { type: 'amas', nombre: 10, intervalle: 3.5 },
    { type: 'moucheron', nombre: 26, intervalle: 0.7, debut: 10 },
  ],
  [
    { type: 'scarabee', nombre: 12, intervalle: 3 },
    { type: 'limace', nombre: 18, intervalle: 1.5, debut: 6 },
  ],
  [
    { type: 'amas', nombre: 12, intervalle: 2.6, plage: 0 },
    { type: 'scarabee', nombre: 12, intervalle: 2.6, plage: 1 },
    { type: 'moucheron', nombre: 24, intervalle: 0.8, debut: 15 },
  ],
  [
    { type: 'moucheron', nombre: 25, intervalle: 0.6 },
    { type: 'moucheron', nombre: 25, intervalle: 0.6, debut: 20 },
    { type: 'limace', nombre: 16, intervalle: 1.5, debut: 5 },
    { type: 'scarabee', nombre: 14, intervalle: 2.5, debut: 10 },
  ],
  [
    { type: 'amas', nombre: 18, intervalle: 2, plage: 1 },
    { type: 'scarabee', nombre: 18, intervalle: 2, plage: 0 },
    { type: 'moucheron', nombre: 30, intervalle: 0.6, debut: 15 },
    { type: 'limace', nombre: 20, intervalle: 1.2, debut: 25 },
  ],
];
