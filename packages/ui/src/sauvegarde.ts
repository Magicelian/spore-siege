// Ce qui reste d'une partie à l'autre, dans le stockage local de la fenêtre : monstres déjà rencontrés et
// meilleures étoiles de chaque île.
import type { Biome, TypeMonstre } from '@spore-siege/engine';

const CLE_DECOUVERTS = 'spore-siege:decouverts';
const CLE_ETOILES = 'spore-siege:etoiles';

export type Etoiles = Partial<Record<Biome, number>>;

export function lireEtoiles(): Etoiles {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_ETOILES) ?? '{}') as unknown;
    return brut && typeof brut === 'object' ? (brut as Etoiles) : {};
  } catch {
    return {};
  }
}

export function ecrireEtoiles(etoiles: Etoiles): void {
  try {
    localStorage.setItem(CLE_ETOILES, JSON.stringify(etoiles));
  } catch {
    // Stockage indisponible : les étoiles ne seront pas retenues.
  }
}

export function lireDecouverts(): Set<TypeMonstre> {
  try {
    const brut = JSON.parse(localStorage.getItem(CLE_DECOUVERTS) ?? '[]') as unknown;
    return new Set(Array.isArray(brut) ? (brut as TypeMonstre[]) : []);
  } catch {
    return new Set();
  }
}

export function ecrireDecouverts(decouverts: ReadonlySet<TypeMonstre>): void {
  try {
    localStorage.setItem(CLE_DECOUVERTS, JSON.stringify([...decouverts]));
  } catch {
    // Stockage indisponible : la collection ne sera pas retenue, le jeu continue.
  }
}

const CLE_SONS = 'spore-siege:sons';

/** Son allumé ? Coupé par défaut. */
export function lireSons(): boolean {
  try {
    return localStorage.getItem(CLE_SONS) === '1';
  } catch {
    return false;
  }
}

export function ecrireSons(allume: boolean): void {
  try {
    localStorage.setItem(CLE_SONS, allume ? '1' : '0');
  } catch {
    // Stockage indisponible : le choix ne sera pas retenu.
  }
}

const CLE_MUSIQUE = 'spore-siege:musique';

/** Musique de combat : allumée par défaut (elle ne joue que si le son l'est aussi). */
export function lireMusique(): boolean {
  try {
    return localStorage.getItem(CLE_MUSIQUE) !== '0';
  } catch {
    return true;
  }
}

export function ecrireMusique(active: boolean): void {
  try {
    localStorage.setItem(CLE_MUSIQUE, active ? '1' : '0');
  } catch {
    // Stockage indisponible : le choix ne sera pas retenu.
  }
}
