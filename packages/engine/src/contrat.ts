// Ce que le moteur échange avec le frontend : types simples, sérialisables.

/** Case de la grille, x vers l'est, y vers le sud. */
export interface Case {
  x: number;
  y: number;
}

/** Position continue sur la grille, en unités de case (pour ce qui se déplace). */
export interface Position {
  x: number;
  y: number;
}

/** `sentier` : là où marchent les monstres ; `sable` : plage de débarquement. */
export type Terrain = 'vide' | 'herbe' | 'foret' | 'fleurs' | 'buisson' | 'rocher' | 'eau' | 'sable' | 'sentier';

/** Une île par niveau, un biome par île (seule la forêt est prévue en V1). */
export type Biome = 'foret' | 'marais' | 'prairie' | 'grotte' | 'futaie';

export interface Ile {
  biome: Biome;
  largeur: number;
  profondeur: number;
  /** Terrain case par case, indexé par `y * largeur + x`. */
  terrain: Terrain[];
  /** Coin nord-ouest de l'emprise de la souche à défendre. */
  souche: Case;
  /** Côté de l'emprise carrée de la souche, en cases. */
  tailleSouche: number;
}

// ─── Partie ──────────────────────────────────────────────────────────────────

/** `petitAmas` : ce que laisse un amas de Rouille en mourant. */
export type TypeMonstre = 'limace' | 'moucheron' | 'scarabee' | 'amas' | 'petitAmas';

export interface MonstreVu {
  id: number;
  type: TypeMonstre;
  /** Position continue, en cases (centre d'une case : x + 0,5). */
  position: Position;
  pv: number;
  pvMax: number;
  /** Touché par le mortier, il avance moins vite. */
  ralenti: boolean;
}

export type TypeTour = 'ruche' | 'cristal' | 'mortier' | 'canon';

export interface TourVue {
  id: number;
  type: TypeTour;
  /** 1 à 3 : chaque amélioration fait pousser la tour d'un stade. */
  stade: number;
  case: Case;
  portee: number;
  /** Monstre visé, s'il y en a un à portée. */
  cible: number | null;
  /** Pas du dernier tir (-1 : jamais tiré). */
  dernierTir: number;
  /** Cristal : points touchés par le dernier éclair, de la tour au dernier rebond. */
  chaine: Position[];
  /** Prix de l'amélioration suivante (null au stade 3) et spores rendues à la revente. */
  prixAmelioration: number | null;
  revente: number;
}

export interface ProjectileVu {
  id: number;
  type: TypeTour;
  position: Position;
}

/** Explosion d'un projectile de zone, gardée quelques pas pour l'afficher. */
export interface ImpactVu {
  type: TypeTour;
  position: Position;
  rayon: number;
  pas: number;
}

/** `pause` : on construit avant la vague `numero` ; `vague` : la vague `numero` est en cours. */
export type Phase = 'pause' | 'vague' | 'victoire' | 'defaite';

export interface Instantane {
  /** Pas de simulation écoulés depuis le début. */
  pas: number;
  phase: Phase;
  /** Vague en cours ou à venir, à partir de 1. */
  vague: number;
  vagues: number;
  /** En pause : secondes avant que la vague parte d'elle-même. */
  pauseRestante: number;
  souche: { pv: number; pvMax: number };
  monstres: MonstreVu[];
  spores: number;
  tours: TourVue[];
  projectiles: ProjectileVu[];
  impacts: ImpactVu[];
  /** Cases de sentier fermées par une ronce. */
  ronces: Case[];
  /** Spores gagnées en lançant la vague maintenant (0 hors pause). */
  bonusLancer: number;
  /** Étoiles gagnées, une fois la partie gagnée (1 à 3) ; 0 sinon. */
  etoiles: number;
}

/** Ce que le frontend peut demander ; le moteur refuse ce qui n'a pas de sens. */
export type Commande =
  | { type: 'lancerVague' }
  | { type: 'poserTour'; tour: TypeTour; case: Case }
  | { type: 'ameliorerTour'; id: number }
  | { type: 'vendreTour'; id: number }
  | { type: 'poserRonce'; case: Case }
  | { type: 'enleverRonce'; case: Case };
