// Cartes de parcours : un îlot voxel par étape, qui flotte, relié au suivant par un chemin de pas japonais.
// Même rendu que l'île de jeu (construireIle), en miniature. Deux usages : l'archipel (une étape par île) et la carte
// d'une île (une étape par niveau, îlot = la vraie carte du niveau réduite de moitié).
import * as THREE from 'three';
import { lireCarte, type Biome } from '@spore-siege/engine';
import { construireIle } from './ile';
import { modeleSouche } from './modeles';
import { COULEURS, materiau } from './palette';
import { versMonde } from './repere';

/** Ordre du parcours. */
export const ORDRE_ILES: readonly Biome[] = ['foret', 'marais', 'prairie', 'grotte', 'futaie'];

/** Îlots de 9 × 9 dessinés en lettres (voir `carte.ts`) ; `S` = la souche, `=` le sentier. */
const ILOTS: Record<Biome, string[]> = {
  foret: [
    '...fff...',
    '.fffhff..',
    '.fhhhhhf.',
    'ffhh=hhff',
    'fh==S=hhf',
    'fhhh=hhff',
    '.fhh=hhf.',
    '..ffssf..',
    '....s....',
  ],
  marais: [
    '...hhh...',
    '.hhfeeh..',
    '.hhhheef.',
    'hfhh=heeh',
    'heh=S==hh',
    'heeh=hhfh',
    '.hhh=hhh.',
    '..hhssh..',
    '....s....',
  ],
  prairie: [
    '...hph...',
    '.hpphhb..',
    '.hhhhpph.',
    'hbhh=hhph',
    'hh==S=hhh',
    'hpph=hbhh',
    '.hhh=pph.',
    '..phssh..',
    '....s....',
  ],
  grotte: [
    '...rrr...',
    '.rrfhrr..',
    '.rhhhhfr.',
    'rfhh=hhrr',
    'rh==S=hfr',
    'rrhh=hhrr',
    '.rhf=hrr.',
    '..rrssr..',
    '....s....',
  ],
  futaie: [
    '...fff...',
    '.ffhhff..',
    '.fhhhhff.',
    'fhhh=hhff',
    'fh==S=hhf',
    'ffhh=hhhf',
    '.fhh=hff.',
    '..ffssf..',
    '....s....',
  ],
};

/**
 * Place des îlots, en cases, dans le repère de l'écran (vue de départ de la caméra) : `droite` vers la droite,
 * `haut` vers le haut. Le parcours monte en zigzag de la forêt (en bas à gauche) à la futaie.
 */
const PLACES: readonly { droite: number; haut: number }[] = [
  { droite: -10, haut: -17 },
  { droite: 6, haut: -13 },
  { droite: 11, haut: 1 },
  { droite: -6, haut: 3 },
  { droite: 5, haut: 16 },
];

/** Une étape du parcours : sa clé (biome ou id de niveau) et son îlot en lettres. */
export interface Etape {
  cle: string;
  biome: Biome;
  lettres: readonly string[];
}

/** Les îles de l'archipel, dans l'ordre. */
export const ETAPES_ARCHIPEL: readonly Etape[] = ORDRE_ILES.map((biome) => ({ cle: biome, biome, lettres: ILOTS[biome] }));

/**
 * Carte d'un niveau réduite de moitié pour son îlot : chaque carré de 2 × 2 cases devient une case (souche, puis
 * sentier, puis sable, puis eau l'emportent ; sinon le terrain le plus courant ; vide s'il y en a au moins deux).
 */
export function reduire(carte: readonly string[]): string[] {
  const lignes: string[] = [];
  for (let y = 0; y < carte.length; y += 2) {
    let ligne = '';
    for (let x = 0; x < (carte[0]?.length ?? 0); x += 2) {
      const bloc = [carte[y]?.[x], carte[y]?.[x + 1], carte[y + 1]?.[x], carte[y + 1]?.[x + 1]].filter((l): l is string => !!l);
      const prioritaire = ['S', '=', 's', 'e'].find((l) => bloc.includes(l));
      if (prioritaire) ligne += prioritaire;
      else if (bloc.filter((l) => l === '.').length >= 2) ligne += '.';
      else {
        const pleins = bloc.filter((l) => l !== '.');
        ligne += pleins.sort((a, b) => pleins.filter((l) => l === b).length - pleins.filter((l) => l === a).length)[0] ?? '.';
      }
    }
    lignes.push(ligne);
  }
  return lignes;
}

/** Étendue de la carte, en cases, pour cadrer la caméra. */
export const COTE_ARCHIPEL = 24;

export interface Ilot {
  cle: string;
  biome: Biome;
  groupe: THREE.Group;
  /** Centre de l'îlot à la surface, pour y poser étoiles et cadenas. */
  centre: THREE.Vector3;
}

export class Archipel {
  readonly groupe = new THREE.Group();
  readonly ilots: Ilot[];
  private readonly pas: THREE.InstancedMesh;

  constructor(etapes: readonly Etape[]) {
    this.ilots = etapes.map(({ cle, biome, lettres }, rang) => {
      const ile = lireCarte(lettres, biome);
      const groupe = construireIle(ile);
      const souche = modeleSouche(1);
      const maillage = new THREE.Mesh(souche.geometrie, souche.materiaux);
      maillage.castShadow = maillage.receiveShadow = true;
      const milieu = ile.tailleSouche / 2;
      versMonde({ x: ile.souche.x + milieu, y: ile.souche.y + milieu }, ile, maillage.position);
      groupe.add(maillage);
      const { droite, haut } = PLACES[rang % PLACES.length]!;
      // Vue de départ (angle π/4) : la droite de l'écran au sol est (1, -1)/√2, le haut (-1, -1)/√2.
      const centre = new THREE.Vector3((droite - haut) * Math.SQRT1_2, 0, (-droite - haut) * Math.SQRT1_2).round();
      groupe.position.copy(centre);
      this.groupe.add(groupe);
      return { cle, biome, groupe, centre };
    });

    // Pas japonais entre deux îlots qui se suivent, hors des îlots eux-mêmes.
    const positions: THREE.Vector3[] = [];
    for (let i = 1; i < this.ilots.length; i++) {
      const a = this.ilots[i - 1]!.centre;
      const b = this.ilots[i]!.centre;
      const longueur = a.distanceTo(b);
      for (let d = 0; d <= longueur; d += 1.3) {
        if (d < 5 || d > longueur - 5) continue;
        positions.push(a.clone().lerp(b, d / longueur).setY(-0.6));
      }
    }
    this.pas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 0.25, 0.5), materiau(COULEURS.sentier), positions.length);
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => this.pas.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z)));
    this.pas.castShadow = true;
    this.groupe.add(this.pas);
  }

  /** Les îlots montent et descendent doucement, chacun à son rythme. */
  animer(secondes: number): void {
    this.ilots.forEach((ilot, i) => {
      ilot.groupe.position.y = Math.round(Math.sin(secondes * 0.9 + i * 1.7) * 3) / 12;
    });
  }
}
