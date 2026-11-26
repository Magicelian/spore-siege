// Ce qui reste d'une séance à l'autre, dans le stockage local de la fenêtre. Trois emplacements de partie, chacun
// avec sa difficulté et toute sa progression (étoiles, Atelier, monstres et tours découverts) ; seuls les réglages
// (son, musique) sont communs.
import { TOURS_DE_BASE, TOUTES_CAPACITES, type Capacite, type Difficulte, type Reprise, type TypeMonstre, type TypeTour } from '@tiny-siege/engine';

export const NB_EMPLACEMENTS = 3;

/** Une partie sauvegardée (un emplacement occupé). */
export interface Sauvegarde {
  difficulte: Difficulte;
}

/** Meilleures étoiles, par id de niveau (`foret-1`…). */
export type Etoiles = Record<string, number>;

// Clés gardées en « spore-siege » malgré le renommage en Tiny Siege : les changer effacerait les parties des joueurs.
const CLE_PARTIES = 'spore-siege:parties';
/** Avant les parties multiples : une seule progression, effacée (choix de Celian, on repart de zéro). */
const ANCIENNES_CLES = ['spore-siege:etoiles', 'spore-siege:decouverts', 'spore-siege:tours', 'spore-siege:atelier'];
const NOMS = ['etoiles', 'decouverts', 'tours', 'atelier', 'record', 'encours'] as const;
/** Dernier emplacement joué : l'accueil propose d'y continuer la partie laissée en cours. */
const CLE_DERNIERE = 'spore-siege:derniere';
const cle = (n: number, nom: (typeof NOMS)[number]) => `spore-siege:partie-${n + 1}:${nom}`;

function lire<T>(cleStockage: string, defaut: T): T {
  try {
    const brut = localStorage.getItem(cleStockage);
    return brut === null ? defaut : (JSON.parse(brut) as T);
  } catch {
    return defaut;
  }
}

function ecrire(cleStockage: string, valeur: unknown): void {
  try {
    localStorage.setItem(cleStockage, JSON.stringify(valeur));
  } catch {
    // Stockage indisponible : rien ne sera retenu, le jeu continue.
  }
}

/** Les 3 emplacements (null = vide). */
export function lireParties(): (Sauvegarde | null)[] {
  const brut = lire<unknown>(CLE_PARTIES, null);
  if (!Array.isArray(brut)) {
    try {
      for (const c of ANCIENNES_CLES) localStorage.removeItem(c);
    } catch {
      // Stockage indisponible.
    }
  }
  const liste = Array.isArray(brut) ? brut : [];
  return Array.from({ length: NB_EMPLACEMENTS }, (_, n) => {
    const s = liste[n] as Sauvegarde | null | undefined;
    return s && ['facile', 'normal', 'difficile'].includes(s.difficulte) ? { difficulte: s.difficulte } : null;
  });
}

export function ecrireParties(parties: readonly (Sauvegarde | null)[]): void {
  ecrire(CLE_PARTIES, parties);
}

/** Vide l'emplacement `n` : toute sa progression disparaît. */
export function effacerPartie(n: number): void {
  try {
    for (const nom of NOMS) localStorage.removeItem(cle(n, nom));
  } catch {
    // Stockage indisponible.
  }
}

export function lireEtoiles(n: number): Etoiles {
  const brut = lire<unknown>(cle(n, 'etoiles'), {});
  return brut && typeof brut === 'object' && !Array.isArray(brut) ? { ...(brut as Etoiles) } : {};
}

export function ecrireEtoiles(n: number, etoiles: Etoiles): void {
  ecrire(cle(n, 'etoiles'), etoiles);
}

export function lireDecouverts(n: number): Set<TypeMonstre> {
  const brut = lire<unknown>(cle(n, 'decouverts'), []);
  return new Set(Array.isArray(brut) ? (brut as TypeMonstre[]) : []);
}

export function ecrireDecouverts(n: number, decouverts: ReadonlySet<TypeMonstre>): void {
  ecrire(cle(n, 'decouverts'), [...decouverts]);
}

/** Capacités du stade 4 ouvertes dans l'Atelier (aucune au départ). */
export function lireAtelier(n: number): Capacite[] {
  const brut = lire<unknown>(cle(n, 'atelier'), []);
  return Array.isArray(brut) ? TOUTES_CAPACITES.filter((c) => brut.includes(c)) : [];
}

export function ecrireAtelier(n: number, ouvertes: readonly Capacite[]): void {
  ecrire(cle(n, 'atelier'), ouvertes);
}

/** Tours découvertes : celles de base, plus celles qu'on a déjà pu construire (le héron au marais). */
export function lireToursVues(n: number): Set<TypeTour> {
  const brut = lire<unknown>(cle(n, 'tours'), []);
  return new Set([...TOURS_DE_BASE, ...(Array.isArray(brut) ? (brut as TypeTour[]) : [])]);
}

export function ecrireToursVues(n: number, vues: ReadonlySet<TypeTour>): void {
  ecrire(cle(n, 'tours'), [...vues]);
}

// ─── Réglages, communs à toutes les parties ─────────────────────────────────────────────────

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

/** Mode vagues sans fin : meilleure vague atteinte dans cette partie (0 = jamais joué). */
export function lireRecord(n: number): number {
  const brut = lire<unknown>(cle(n, 'record'), 0);
  return typeof brut === 'number' && brut > 0 ? Math.floor(brut) : 0;
}

export function ecrireRecord(n: number, vague: number): void {
  ecrire(cle(n, 'record'), vague);
}

/** Partie laissée en cours dans l'emplacement `n` (application fermée en pleine partie), ou null. */
export function lireEnCours(n: number): Reprise | null {
  const r = lire<Reprise | null>(cle(n, 'encours'), null);
  return r && typeof r.niveau === 'string' && Array.isArray(r.commandes) && typeof r.pas === 'number' ? r : null;
}

export function ecrireEnCours(n: number, reprise: Reprise | null): void {
  if (reprise) ecrire(cle(n, 'encours'), reprise);
  else
    try {
      localStorage.removeItem(cle(n, 'encours'));
    } catch {
      // Stockage indisponible.
    }
}

export function lireDerniere(): number | null {
  const n = lire<unknown>(CLE_DERNIERE, null);
  return typeof n === 'number' && n >= 0 && n < NB_EMPLACEMENTS ? n : null;
}

export function ecrireDerniere(n: number): void {
  ecrire(CLE_DERNIERE, n);
}
