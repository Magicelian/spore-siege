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
export type TypeMonstre = 'limace' | 'moucheron' | 'scarabee' | 'amas' | 'petitAmas' | 'volant' | 'soigneur' | 'limaceMere';

export interface MonstreVu {
  id: number;
  type: TypeMonstre;
  /** Position continue, en cases (centre d'une case : x + 0,5). */
  position: Position;
  pv: number;
  pvMax: number;
  /** Touché par le mortier, il avance moins vite. */
  ralenti: boolean;
  /** Piqué par le Dard : il perd de la vie un moment. */
  empoisonne: boolean;
}

export type TypeTour = 'ruche' | 'cristal' | 'mortier' | 'canon';

/** Capacité spéciale choisie au stade 4 ; deux par tour (`CAPACITES_DE`). */
export type Capacite = 'essaim' | 'dard' | 'tempete' | 'prisme' | 'salve' | 'glu' | 'mitraille' | 'grosCalibre';

export interface TourVue {
  id: number;
  type: TypeTour;
  /** 1 à 4 : chaque amélioration fait pousser la tour d'un stade ; le 4e porte une capacité. */
  stade: number;
  /** Capacité choisie au stade 4. */
  capacite: Capacite | null;
  case: Case;
  portee: number;
  /** Monstre visé, s'il y en a un à portée. */
  cible: number | null;
  /** Pas du dernier tir (-1 : jamais tiré). */
  dernierTir: number;
  /** Cristal : points touchés par le dernier éclair, de la tour au dernier rebond. */
  chaine: Position[];
  /** Prix de l'amélioration suivante (null au stade 3 et 4) et spores rendues à la revente. */
  prixAmelioration: number | null;
  /** Au stade 3 seulement : prix de chacune des deux capacités (`CAPACITES_DE`), dans le même ordre. */
  prixCapacites: [number, number] | null;
  revente: number;
}

export interface ProjectileVu {
  id: number;
  type: TypeTour;
  capacite: Capacite | null;
  position: Position;
  depart: Position;
  but: Position;
}

/** Explosion d'un projectile de zone, gardée quelques pas pour l'afficher. */
export interface ImpactVu {
  type: TypeTour;
  capacite: Capacite | null;
  position: Position;
  rayon: number;
  pas: number;
}

/**
 * Ce qui vient de se passer, gardé un court moment (comme les impacts) : l'affichage et les sons réagissent
 * une fois à chacun, même quand plusieurs pas passent entre deux images.
 */
export type EvenementVu =
  | { type: 'mort'; id: number; monstre: TypeMonstre; position: Position; butin: number; pas: number }
  | { type: 'morsure'; id: number; monstre: TypeMonstre; degats: number; pas: number }
  /** Le soigneur `id` vient de rendre de la vie aux monstres `soignes`. */
  | { type: 'soin'; id: number; monstre: TypeMonstre; position: Position; soignes: number[]; pas: number }
  /** Le boss `id` a franchi un palier de vie et pondu les monstres `petits`. */
  | { type: 'ponte'; id: number; monstre: TypeMonstre; position: Position; petits: number[]; pas: number };

/** Flaque collante laissée par le mortier Glu : les monstres dedans sont ralentis. */
export interface FlaqueVu {
  id: number;
  position: Position;
  rayon: number;
  /** Part de vie restante, de 1 (posée) à 0 (sèche). */
  reste: number;
}

/** `pause` : on construit avant la vague `numero` ; `vague` : la vague `numero` est en cours. */
export type Phase = 'pause' | 'vague' | 'victoire' | 'defaite';

/** Contraintes d'un niveau. */
export interface Regles {
  /** Spores au départ. */
  spores: number;
  /** Tours qu'on peut poser, dans l'ordre de la bulle. */
  tours: TypeTour[];
  /** Peut-on faire pousser des ronces ? */
  ronces: boolean;
  /** Capacités du stade 4 ouvertes dans l'Atelier (avec les étoiles) ; les autres sont refusées. */
  capacites: Capacite[];
}

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
  /** Morts et morsures des dernières secondes. */
  evenements: EvenementVu[];
  /** Flaques de glu au sol (mortier Glu). */
  flaques: FlaqueVu[];
  /** Cases de sentier fermées par une ronce. */
  ronces: Case[];
  /** Spores gagnées en lançant la vague maintenant (0 hors pause). */
  bonusLancer: number;
  /** Étoiles gagnées, une fois la partie gagnée (1 à 3) ; 0 sinon. */
  etoiles: number;
  /** Sortes de monstres de la vague en cours ou à venir (pour annoncer les nouveaux). */
  monstresVague: TypeMonstre[];
  /** Plages d'où partira (ou part) la vague en cours ou à venir, avec les sortes qui en viennent. */
  arrivees: Arrivee[];
  /** Contraintes du niveau joué. */
  regles: Regles;
  /** Dégâts infligés depuis le début de la partie, par sorte de tour (pour le bilan de fin). */
  degats: Record<TypeTour, number>;
}

/** Une plage de débarquement de la vague : sa case de sable et les sortes de monstres qui en partent. */
export interface Arrivee {
  plage: number;
  depart: Case;
  types: TypeMonstre[];
}

/** Ce que le frontend peut demander ; le moteur refuse ce qui n'a pas de sens. */
export type Commande =
  | { type: 'lancerVague' }
  | { type: 'poserTour'; tour: TypeTour; case: Case }
  | { type: 'ameliorerTour'; id: number }
  | { type: 'choisirCapacite'; id: number; capacite: Capacite }
  | { type: 'vendreTour'; id: number }
  | { type: 'poserRonce'; case: Case }
  | { type: 'enleverRonce'; case: Case };
