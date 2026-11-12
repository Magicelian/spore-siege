// Ce qui reste d'une partie à l'autre, dans le stockage local de la fenêtre : monstres déjà rencontrés.
// (Les étoiles des îles s'y ajouteront en 4c.)
import type { TypeMonstre } from '@spore-siege/engine';

const CLE_DECOUVERTS = 'spore-siege:decouverts';

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
