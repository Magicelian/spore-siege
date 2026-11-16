// Île en coupe : herbe, terre et roche empilées par colonne, décor posé sur les cases.
import * as THREE from 'three';
import { estSentier, type Ile, type Terrain } from '@spore-siege/engine';
import { COULEURS, SURFACES_PAR_BIOME, materiau } from './palette';
import { modelesDecor, type Decor } from './modeles';
import { bruit, centreCase } from './repere';
import { sansNuance } from './voxels';

const CUBE = sansNuance(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
/** `cube` prend la couleur de la pièce ; les autres formes sont des modèles en voxels. */
type Forme = 'cube' | Decor;

interface Piece {
  forme: Forme;
  couleur: number;
  matrice: THREE.Matrix4;
  ombre: 'porte' | 'recoit';
  /** Plateforme de la futaie : clé `x,y` de sa case, pour pouvoir l'abattre. */
  case?: string;
}

/** Arbre à plateforme posé dans un maillage instancié : on le cache quand le Colosse l'abat. */
export interface PlateformeVue {
  maillage: THREE.InstancedMesh;
  index: number;
  matrice: THREE.Matrix4;
}

/** Ce qui pousse sur les cases `foret` selon le biome. */
const ARBRE_PAR_BIOME: Record<Ile['biome'], Decor> = { foret: 'arbre', marais: 'roseau', prairie: 'arbre', grotte: 'luisant', futaie: 'chene' };

const HAUT_TERRE = -0.25;
const HAUT_ROCHE = -1;

export function construireIle(ile: Ile): THREE.Group {
  const pieces: Piece[] = [];
  const centre = new THREE.Vector3();
  const echelle = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const axeY = new THREE.Vector3(0, 1, 0);

  const poser = (forme: Forme, couleur: number, ombre: Piece['ombre'], position: THREE.Vector3, taille: THREE.Vector3, angle = 0, cle?: string) => {
    rotation.setFromAxisAngle(axeY, angle);
    pieces.push({ forme, couleur, ombre, matrice: new THREE.Matrix4().compose(position, rotation, taille), case: cle });
  };

  const bords = distancesAuBord(ile);
  const surfaces = SURFACES_PAR_BIOME[ile.biome];
  for (let y = 0; y < ile.profondeur; y++) {
    for (let x = 0; x < ile.largeur; x++) {
      const terrain = terrainVu(ile, x, y);
      if (terrain === 'vide') continue;
      centreCase(x, y, ile, centre);
      const b = bruit(x, y);

      // Colonne : surface, terre, puis roche plus profonde vers le centre.
      const hautSurface = terrain === 'eau' || terrain === 'nenuphar' ? -0.12 : terrain === 'gue' ? -0.08 : 0;
      poser('cube', surfaces[terrain], 'recoit', centre.clone().setY(HAUT_TERRE), echelle.set(1, hautSurface - HAUT_TERRE, 1));
      poser('cube', COULEURS.terre, 'recoit', centre.clone().setY(HAUT_ROCHE), echelle.set(1, HAUT_TERRE - HAUT_ROCHE, 1));
      const profondeurRoche = Math.min(4, 0.5 + (bords[y * ile.largeur + x] ?? 0) * 0.8 + b * 0.5);
      poser('cube', COULEURS.roche, 'recoit', centre.clone().setY(HAUT_ROCHE - profondeurRoche), echelle.set(1, profondeurRoche, 1));

      // Décor, légèrement décalé pour casser la grille.
      const decalage = centre.clone().add(new THREE.Vector3((bruit(x, y, 1) - 0.5) * 0.3, 0, (bruit(x, y, 2) - 0.5) * 0.3));
      if (terrain === 'foret') {
        const t = 0.8 + b * 0.4;
        poser(ARBRE_PAR_BIOME[ile.biome], 0, 'porte', decalage, echelle.set(t, t * (0.9 + bruit(x, y, 4) * 0.2), t), quart(b));
      } else if (terrain === 'fleurs') {
        poser('fleur', 0, 'porte', decalage, echelle.setScalar(0.85 + b * 0.3), quart(b));
      } else if (terrain === 'buisson') {
        poser('buisson', 0, 'porte', decalage, echelle.setScalar(0.85 + b * 0.25), quart(b));
      } else if (terrain === 'luisant') {
        // Grosse touffe de luisants (grotte) : elle éclaire autour d'elle.
        poser('luisant', 0, 'porte', decalage, echelle.setScalar(1.25 + b * 0.2), quart(b));
      } else if (terrain === 'plateforme') {
        // Grand arbre à plateforme (futaie) : centré et à taille fixe, pour que la tour tombe pile sur le plancher.
        poser('plateforme', 0, 'porte', centre.clone(), echelle.setScalar(1), quart(b), `${x},${y}`);
      } else if (terrain === 'rocher') {
        poser('caillou', 0, 'porte', decalage, echelle.set(0.85, 0.75 + b * 0.3, 0.85), quart(b));
      } else if (terrain === 'nenuphar') {
        // Une grande feuille qui couvre la case : on y pose une tour. Pas de petits nénuphars de décor, pour ne
        // pas les confondre avec ceux-là.
        poser('nenuphar', 0, 'recoit', centre.clone().setY(hautSurface + 0.01), echelle.setScalar(1.7), quart(b));
      } else if (terrain === 'gue') {
        // Deux pierres plates de part et d'autre : le sentier continue sous l'eau.
        for (const [i, cote] of [[0, -1], [1, 1]] as const) {
          const pierre = centre.clone().add(new THREE.Vector3(cote * 0.28 + (bruit(x, y, 6 + i) - 0.5) * 0.15, hautSurface, (bruit(x, y, 8 + i) - 0.5) * 0.5));
          poser('cube', COULEURS.roche, 'recoit', pierre, echelle.set(0.26, 0.05, 0.22), quart(b));
        }
      }
    }
  }
  return regrouper(pieces);
}

/**
 * Terrain dessiné d'une case. Sous la souche, une case touchée par le sentier est dessinée en sentier : la terre
 * battue va jusqu'au tronc au lieu de s'arrêter sur une bande d'herbe.
 */
function terrainVu(ile: Ile, x: number, y: number): Terrain {
  const terrain = ile.terrain[y * ile.largeur + x] ?? 'vide';
  const { souche, tailleSouche: t } = ile;
  const dansSouche = (cx: number, cy: number) => cx >= souche.x && cx < souche.x + t && cy >= souche.y && cy < souche.y + t;
  if (!dansSouche(x, y)) return terrain;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nx = x + dx;
    const ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= ile.largeur || ny >= ile.profondeur || dansSouche(nx, ny)) continue;
    if (estSentier(ile.terrain[ny * ile.largeur + nx])) return 'sentier';
  }
  return terrain;
}

/** Regroupe les pièces par forme et couleur en maillages instanciés. */
function regrouper(pieces: Piece[]): THREE.Group {
  const lots = new Map<string, Piece[]>();
  for (const piece of pieces) {
    const cle = `${piece.forme}:${piece.couleur}:${piece.ombre}`;
    const lot = lots.get(cle);
    if (lot) lot.push(piece);
    else lots.set(cle, [piece]);
  }
  const groupe = new THREE.Group();
  const plateformes = new Map<string, PlateformeVue>();
  groupe.userData.plateformes = plateformes;
  for (const lot of lots.values()) {
    const { forme, couleur, ombre } = lot[0]!;
    const modele = forme === 'cube' ? null : modelesDecor()[forme];
    const maillage = modele
      ? new THREE.InstancedMesh(modele.geometrie, modele.materiaux, lot.length)
      : new THREE.InstancedMesh(CUBE, materiau(couleur), lot.length);
    lot.forEach((piece, i) => {
      maillage.setMatrixAt(i, piece.matrice);
      if (piece.case) plateformes.set(piece.case, { maillage, index: i, matrice: piece.matrice });
    });
    maillage.castShadow = true;
    maillage.receiveShadow = ombre === 'recoit';
    groupe.add(maillage);
  }
  return groupe;
}

/** Quart de tour tiré du bruit : les voxels restent alignés sur la grille. */
function quart(b: number): number {
  return Math.floor(b * 4) * (Math.PI / 2);
}

/** Distance de chaque case au vide le plus proche (hors île compris), en pas de grille. */
function distancesAuBord(ile: Ile): number[] {
  const { largeur, profondeur } = ile;
  const distances = ile.terrain.map(() => Infinity);
  const file: number[] = [];
  ile.terrain.forEach((terrain, i) => {
    const x = i % largeur;
    const y = Math.floor(i / largeur);
    const auBord = x === 0 || y === 0 || x === largeur - 1 || y === profondeur - 1;
    if (terrain === 'vide' || auBord) {
      distances[i] = terrain === 'vide' ? -1 : 0;
      file.push(i);
    }
  });
  for (let tete = 0; tete < file.length; tete++) {
    const i = file[tete]!;
    const x = i % largeur;
    const y = Math.floor(i / largeur);
    const suivante = Math.max(0, distances[i]!) + 1;
    for (const [vx, vy] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (vx < 0 || vy < 0 || vx >= largeur || vy >= profondeur) continue;
      const v = vy * largeur + vx;
      if (distances[v]! > suivante) {
        distances[v] = suivante;
        file.push(v);
      }
    }
  }
  return distances;
}
