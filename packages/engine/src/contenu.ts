// Chiffres de la partie. Provisoires : la courbe des 10 vagues s'équilibre à l'étape 5 (joueur scripté).
import type { Capacite, Difficulte, ModeCible, TypeMonstre, TypeTour } from './contrat';

/** Durée d'un pas de simulation : 20 pas par seconde. */
export const PAS_MS = 50;
export const PAS_PAR_SECONDE = 1000 / PAS_MS;

export const PV_SOUCHE = 20;
/** Pause avant chaque vague, pour construire ; un bouton l'écourte. */
export const PAUSE_SECONDES = 25;
/** Dans un gué, les monstres qui marchent vont à cette fraction de leur vitesse. */
export const FACTEUR_GUE = 0.6;

export interface FicheMonstre {
  /** Vole en ligne droite vers la souche : ignore sentier et ronces, seules les tours `aerien` l'atteignent. */
  volant?: boolean;
  /** Toutes les `cadence` secondes, rend `pv` aux autres monstres à moins de `rayon` cases. */
  soin?: { rayon: number; pv: number; cadence: number };
  /**
   * Boss : grande barre de vie en haut de l'écran ; s'il touche la souche, la partie est perdue. Sous chaque palier
   * (part de sa vie), il pond une escorte derrière lui.
   */
  boss?: {
    paliers: { part: number; escorte: { type: TypeMonstre; nombre: number }[] }[];
    /**
     * Crapaud-roi : à chaque palier il plonge, hors d'atteinte pendant `duree` secondes, file `avance` cases sous
     * l'eau, puis ressort et pond son escorte là.
     */
    plongee?: { duree: number; avance: number };
    /** Ver des profondeurs : à chaque palier, toutes les lanternes s'éteignent pendant `noir` secondes. */
    noir?: number;
    /**
     * Colosse d'écorce : à chaque palier il frappe le sol et la plateforme occupée la plus proche de lui tombe ; sa
     * tour est détruite et `rembourse` (part de ce qu'elle a coûté) rendu.
     */
    abat?: { rembourse: number };
  };
  pv: number;
  /** Cases par seconde. */
  vitesse: number;
  /** Points de vie retirés à la souche en l'atteignant. */
  morsure: number;
  /** Spores lâchées en mourant. */
  butin: number;
  /** Retiré à chaque coup (au moins 1 dégât passe) ; l'éclair du cristal l'ignore. */
  armure: number;
  /** Nage sous l'eau des gués : n'y est pas ralentie, et seules les tours `sousEau` l'y atteignent. */
  nage?: boolean;
  /** Toutes les `cadence` secondes, bondit de `distance` cases le long du chemin en `duree` secondes. */
  saut?: { cadence: number; distance: number; duree: number };
  /**
   * Chenille : quitte le sentier pour une fleur à spores à moins de `flair` cases, la dévore en `duree` secondes,
   * puis rejoint le sentier le plus proche. Une seule fleur par chenille.
   */
  gourmande?: { flair: number; duree: number };
  /**
   * Grand Corbeau : tourne à `rayon` cases autour de la souche (à `vitesse`), et toutes les `attente` secondes pique
   * à `pique` cases/s sur la fleur à spores la plus proche ; il l'arrache et reste `auSol` secondes posé (toutes les
   * tours l'atteignent alors). Après `plongees` fleurs, ou s'il n'y en a plus, il fond sur la souche à `assaut` cases/s.
   */
  rapace?: { rayon: number; attente: number; pique: number; auSol: number; plongees: number; assaut: number };
  /** Chauve-souris : éteint pendant `duree` secondes chaque champignon-lanterne qu'elle survole (à moins de `rayon`). */
  souffle?: { rayon: number; duree: number };
  /**
   * Cloporte : touché, il se roule en boule `duree` secondes (armure `armure`, immobile), puis repart `elan` fois
   * plus vite pendant `elanDuree` secondes ; il ne peut pas se rouler à nouveau avant `recharge` secondes.
   */
  boule?: { duree: number; armure: number; recharge: number; elan: number; elanDuree: number };
  /**
   * Araignée : ne part pas d'une plage, elle descend d'un arbre au bout d'un fil (hors d'atteinte pendant `duree`
   * secondes) et se pose sur la route de sa plage, entre `de` et `a` de sa longueur, d'où elle file vers la souche.
   */
  fil?: { duree: number; de: number; a: number };
  /**
   * Écureuil : passant à moins de `flair` cases d'une tour en hauteur (plateforme) libre, il quitte le sentier, y
   * grimpe et la bloque (elle ne tire plus) `duree` secondes, puis rejoint le sentier. Une seule tour par écureuil.
   */
  grimpeur?: { flair: number; duree: number };
}

export const MONSTRES: Record<TypeMonstre, FicheMonstre> = {
  limace: { pv: 12, vitesse: 0.8, morsure: 1, butin: 2, armure: 0 },
  moucheron: { pv: 7, vitesse: 1.8, morsure: 1, butin: 1, armure: 0 },
  scarabee: { pv: 65, vitesse: 0.55, morsure: 2, butin: 6, armure: 3 },
  amas: { pv: 45, vitesse: 0.7, morsure: 2, butin: 4, armure: 0 },
  petitAmas: { pv: 12, vitesse: 1, morsure: 1, butin: 1, armure: 0 },
  // Forêt, niveau 2 : vole tout droit de la plage à la souche ; seules la ruche et le cristal l'atteignent.
  volant: { pv: 14, vitesse: 0.9, morsure: 1, butin: 3, armure: 0, volant: true },
  // Forêt, niveau 4 : rend de la vie aux monstres autour de lui (pas à lui-même).
  soigneur: { pv: 40, vitesse: 0.6, morsure: 2, butin: 6, armure: 1, soin: { rayon: 1.8, pv: 6, cadence: 2 } },
  // Boss de la forêt (niveau 5, dernière vague). Réglé en 8d : à 2 500 PV le joueur simple perd, à 1 800 il gagne.
  limaceMere: {
    pv: 1500,
    vitesse: 0.3,
    morsure: 20,
    butin: 60,
    armure: 5,
    boss: {
      paliers: [
        { part: 0.75, escorte: [{ type: 'limace', nombre: 6 }] },
        { part: 0.5, escorte: [{ type: 'limace', nombre: 4 }, { type: 'amas', nombre: 2 }] },
        { part: 0.25, escorte: [{ type: 'scarabee', nombre: 2 }, { type: 'limace', nombre: 4 }] },
      ],
    },
  },
  // Marais, niveau 2 : sous l'eau des gués, seul le héron la touche ; sur la terre, elle redevient vulnérable.
  sangsue: { pv: 22, vitesse: 0.9, morsure: 1, butin: 3, armure: 0, nage: true },
  // Marais, niveau 3 : bondit de deux cases toutes les 2,5 s et passe vite les zones couvertes.
  crapaud: { pv: 26, vitesse: 0.6, morsure: 1, butin: 3, armure: 0, saut: { cadence: 2.5, distance: 2, duree: 0.4 } },
  // Boss du marais (niveau 5). Chiffres provisoires, à régler en 9e avec les joueurs scriptés.
  crapaudRoi: {
    pv: 500,
    vitesse: 0.2,
    morsure: 20,
    butin: 70,
    armure: 3,
    saut: { cadence: 5, distance: 1.5, duree: 0.7 },
    boss: {
      plongee: { duree: 3, avance: 2 },
      paliers: [
        { part: 0.75, escorte: [{ type: 'crapaud', nombre: 4 }] },
        { part: 0.5, escorte: [{ type: 'sangsue', nombre: 4 }, { type: 'crapaud', nombre: 2 }] },
        { part: 0.25, escorte: [{ type: 'scarabee', nombre: 2 }, { type: 'crapaud', nombre: 4 }] },
      ],
    },
  },  // Prairie, niveau 2 : va dévorer une fleur à spores proche du sentier, puis repart vers la souche.
  chenille: { pv: 30, vitesse: 0.7, morsure: 1, butin: 4, armure: 0, gourmande: { flair: 3.5, duree: 2.5 } },
  // Prairie, niveau 3 : en grands essaims, très rapide et très fragile.
  sauterelle: { pv: 5, vitesse: 2.4, morsure: 1, butin: 1, armure: 0 },
  // Boss de la prairie : vole au-dessus de l'île, arrache les fleurs, puis fond sur la souche. Réglé en 10d : seules
  // la ruche et le cristal le touchent en vol, à 300 PV aucun script ne le battait, à 220 le bon gagnait à 1 PV.
  corbeau: {
    pv: 220,
    vitesse: 1.6,
    morsure: 20,
    butin: 70,
    armure: 1,
    boss: { paliers: [] },
    rapace: { rayon: 6, attente: 5, pique: 3, auSol: 4, plongees: 3, assaut: 0.35 },
  },
  // Grotte, niveau 2 : vole tout droit comme la phalène et éteint les lanternes qu'elle survole.
  chauveSouris: { pv: 8, vitesse: 0.9, morsure: 1, butin: 3, armure: 0, volant: true, souffle: { rayon: 1.2, duree: 6 } },
  // Grotte, niveau 3 : se roule en boule quand on le touche (le cristal, qui perce l'armure, le blesse quand même).
  cloporte: { pv: 40, vitesse: 0.55, morsure: 2, butin: 5, armure: 1, boule: { duree: 2, armure: 12, recharge: 3, elan: 1.8, elanDuree: 2 } },
  // Boss de la grotte : énorme et lent ; à chaque palier il souffle toutes les lanternes (seuls les luisants de la
  // carte restent). Chiffres provisoires, à régler en 11d avec les joueurs scriptés.
  ver: {
    pv: 700,
    vitesse: 0.3,
    morsure: 20,
    butin: 70,
    armure: 3,
    boss: {
      noir: 5,
      paliers: [
        { part: 0.75, escorte: [{ type: 'chauveSouris', nombre: 3 }] },
        { part: 0.5, escorte: [{ type: 'cloporte', nombre: 2 }, { type: 'chauveSouris', nombre: 3 }] },
        { part: 0.25, escorte: [{ type: 'cloporte', nombre: 4 }, { type: 'scarabee', nombre: 2 }] },
      ],
    },
  },
  // Futaie, niveau 2 : tombe d'un arbre au milieu du sentier (les défenses massées à l'entrée ne la voient pas).
  araignee: { pv: 26, vitesse: 0.85, morsure: 1, butin: 4, armure: 0, fil: { duree: 1.5, de: 0.3, a: 0.65 } },
  // Futaie, niveau 3 : grimpe sur une tour en hauteur et la bloque quelques secondes.
  ecureuil: { pv: 20, vitesse: 1.4, morsure: 1, butin: 3, armure: 0, grimpeur: { flair: 1.8, duree: 3 } },
  // Boss de la futaie (dernier boss) : arbre géant, très lent ; à chaque palier il abat une plateforme occupée.
  // Pas d'escorte (cahier) : la menace, c'est de perdre ses meilleures tours. Réglé en 12d : à 2 200 PV personne ne
  // le laissait passer (l'économie de fin de partie fait boule de neige), à 3 500 le simple perd, le bon gagne.
  colosse: {
    pv: 3500,
    vitesse: 0.25,
    morsure: 20,
    butin: 90,
    armure: 4,
    boss: {
      abat: { rembourse: 0.5 },
      paliers: [
        { part: 0.75, escorte: [] },
        { part: 0.5, escorte: [] },
        { part: 0.25, escorte: [] },
      ],
    },
  },
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
/** Fleur à spores (prairie) : prix, spores rapportées à chaque fin de vague, part rendue si on l'arrache. */
export const FLEUR = { prix: 50, rapport: 15, partRendue: 0.5 };

/**
 * Grotte : champignon-lanterne (prix, rayon éclairé en cases, part rendue) ; `luisant` = rayon éclairé par un
 * luisant de la carte.
 */
export const LANTERNE = { prix: 30, rayon: 3, partRendue: 0.5, luisant: 2 };

/** Plateforme de la futaie : une tour posée là-haut voit plus loin, mais tout y coûte plus cher (pose, stades). */
export const PLATEFORME = { portee: 1, surcout: 1.3 };

/** Prix d'un achat pour une tour en hauteur ou au sol. */
export function prixPour(prix: number, haute: boolean): number {
  return haute ? Math.round(prix * PLATEFORME.surcout) : prix;
}

/** Part du prix payé (pose et améliorations) rendue à la revente ; moins pour une tour à capacité (stade 4). */
export const PART_REVENTE = 0.7;
export const PART_REVENTE_CAPACITE = 0.5;

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
  /** Mode de ciblage à la pose (défaut : `premier`). */
  cible?: ModeCible;
  /** Sans projectile, le coup est immédiat (éclair). `guide` : suit sa cible ; sinon vise où elle sera. */
  projectile?: { vitesse: number; guide: boolean; rayon: number };
  /** Cristal : portée d'un rebond et part des dégâts gardée à chaque rebond. */
  eclair?: { distance: number; attenuation: number };
  /** Mortier : ralentit les monstres touchés. */
  ralenti?: { facteur: number; duree: number };
  /** Atteint les monstres volants (ruche et cristal) ; les obus du mortier et du canon passent dessous. */
  aerien?: boolean;
  /** Se pose sur l'eau (eau libre ou nénuphar), nulle part ailleurs. */
  surEau?: boolean;
  /** Atteint les nageurs sous l'eau des gués (la Sangsue). */
  sousEau?: boolean;
  /**
   * Héron : le harpon file en ligne droite vers la cible et continue `allonge` cases au-delà de la portée ; il blesse
   * une fois chaque monstre qu'il frôle à moins de `largeur` case.
   */
  harpon?: { largeur: number; allonge: number };
}

export const TOURS: Record<TypeTour, FicheTour> = {
  ruche: {
    stades: [
      { prix: 50, degats: 2, portee: 2.5, cadence: 0.5 },
      { prix: 40, degats: 3, portee: 2.8, cadence: 0.4 },
      { prix: 70, degats: 5, portee: 3.1, cadence: 0.35 },
    ],
    projectile: { vitesse: 8, guide: true, rayon: 0 },
    aerien: true,
  },
  cristal: {
    cible: 'blinde',
    aerien: true,
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
  heron: {
    surEau: true,
    sousEau: true,
    stades: [
      { prix: 70, degats: 6, portee: 3, cadence: 1.5 },
      { prix: 55, degats: 9, portee: 3.3, cadence: 1.4 },
      { prix: 90, degats: 13, portee: 3.6, cadence: 1.3 },
    ],
    projectile: { vitesse: 9, guide: false, rayon: 0 },
    harpon: { largeur: 0.45, allonge: 1 },
  },
};

/** Les cinq tours, dans l'ordre de la bulle « Construire » (le héron, qui va sur l'eau, en dernier). */
export const TYPES_TOURS = Object.keys(TOURS) as TypeTour[];
/** Tours connues dès le début ; les autres (le héron du marais) se découvrent sur leur île. */
export const TOURS_DE_BASE: TypeTour[] = ['ruche', 'cristal', 'mortier', 'canon'];

/**
 * Stade 4 : une capacité choisie parmi deux, chiffres complets du stade (prix = celui du stade 4). Les champs
 * optionnels remplacent ceux de la fiche de la tour ou ajoutent un effet.
 */
export interface FicheCapacite extends StadeTour {
  tour: TypeTour;
  /** Projectiles par tir : sur autant de monstres différents (Essaim, Mitraille), ou autour de la cible (Salve). */
  tirs?: number;
  /** Salve : écart entre deux obus le long du chemin, en cases. */
  ecart?: number;
  /** Traverse l'armure. */
  percant?: boolean;
  /** Dard : perte de vie après la piqûre (traverse l'armure ; une nouvelle piqûre relance la durée). */
  poison?: { degatsParSeconde: number; duree: number };
  rayon?: number;
  vitesse?: number;
  eclair?: { distance: number; attenuation: number };
  /** Glu : flaque laissée à l'impact ; les monstres dedans avancent à `facteur` de leur vitesse. */
  flaque?: { rayon: number; duree: number; facteur: number };
  /** Harpon chaîne : au bout de sa course, le harpon repart vers un monstre qu'il n'a pas touché, à moins de `saut` cases. */
  saut?: number;
}

/** Les deux capacités de chaque tour : d'abord celle contre les groupes, puis celle contre les gros monstres. */
export const CAPACITES_DE: Record<TypeTour, readonly [Capacite, Capacite]> = {
  ruche: ['essaim', 'dard'],
  cristal: ['tempete', 'prisme'],
  mortier: ['glu', 'salve'],
  canon: ['mitraille', 'grosCalibre'],
  heron: ['harponChaine', 'grandHarpon'],
};

/** Toutes les capacités, tour par tour, dans l'ordre de `CAPACITES_DE`. */
export const TOUTES_CAPACITES: Capacite[] = Object.values(CAPACITES_DE).flat();

/**
 * Étoiles pour ouvrir une capacité dans l'Atelier : le prix monte avec chaque capacité ouverte (1 ★ la première,
 * 2 ★ la deuxième… 10 ★ la dixième ; 55 ★ pour tout sur 75). Demande de Celian (20/11) : à 1 puis 2 ★ par tour,
 * tout s'ouvrait en 3-4 niveaux.
 */
export function etoilesPour(capacite: Capacite, ouvertes: readonly Capacite[]): number {
  return ouvertes.includes(capacite) ? 0 : ouvertes.length + 1;
}

/** Étoiles dépensées pour ouvrir `ouvertes` (ce que rend « Tout rembourser ») : 1 + 2 + … + n. */
export function etoilesDepensees(ouvertes: readonly Capacite[]): number {
  const n = ouvertes.length;
  return (n * (n + 1)) / 2;
}

export const CAPACITES: Record<Capacite, FicheCapacite> = {
  essaim: { tour: 'ruche', prix: 130, degats: 6, portee: 3.4, cadence: 0.3, tirs: 2 },
  dard: { tour: 'ruche', prix: 130, degats: 9, portee: 3.4, cadence: 0.35, percant: true, poison: { degatsParSeconde: 4, duree: 3 } },
  tempete: { tour: 'cristal', prix: 150, degats: 13, portee: 3.2, cadence: 1.2, rebonds: 5, eclair: { distance: 2.4, attenuation: 0.8 } },
  prisme: { tour: 'cristal', prix: 150, degats: 70, portee: 3.6, cadence: 1.3, rebonds: 0 },
  salve: { tour: 'mortier', prix: 140, degats: 7, portee: 4.4, cadence: 1.8, tirs: 3, ecart: 0.35 },
  glu: { tour: 'mortier', prix: 140, degats: 12, portee: 4.4, cadence: 1.8, rayon: 1.1, flaque: { rayon: 1.2, duree: 4, facteur: 0.35 } },
  mitraille: { tour: 'canon', prix: 170, degats: 16, portee: 3.6, cadence: 0.9, tirs: 3, rayon: 0.7, vitesse: 7 },
  grosCalibre: { tour: 'canon', prix: 170, degats: 85, portee: 4, cadence: 3, rayon: 1.2, vitesse: 4 },
  // Harpon chaîne : `rebonds` = nouveaux départs du harpon.
  harponChaine: { tour: 'heron', prix: 140, degats: 13, portee: 3.8, cadence: 1.2, rebonds: 2, saut: 2.5 },
  grandHarpon: { tour: 'heron', prix: 150, degats: 50, portee: 4.2, cadence: 2.4, percant: true, vitesse: 7 },
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

/** Vie des monstres selon la difficulté ; rien d'autre ne change (Normal = le jeu équilibré). */
export const VIE_DIFFICULTE: Record<Difficulte, number> = { facile: 0.8, normal: 1, difficile: 1.2 };
