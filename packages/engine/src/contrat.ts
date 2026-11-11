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
