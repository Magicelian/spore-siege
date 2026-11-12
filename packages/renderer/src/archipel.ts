// Carte des îles : un îlot voxel par niveau, qui flotte, relié au suivant par un chemin de pas japonais.
// Même rendu que l'île de jeu (construireIle), en miniature.
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
const PLACES: Record<Biome, { droite: number; haut: number }> = {
  foret: { droite: -10, haut: -17 },
  marais: { droite: 6, haut: -13 },
  prairie: { droite: 11, haut: 1 },
  grotte: { droite: -6, haut: 3 },
  futaie: { droite: 5, haut: 16 },
};

/** Étendue de la carte, en cases, pour cadrer la caméra. */
export const COTE_ARCHIPEL = 24;

export interface Ilot {
  biome: Biome;
  groupe: THREE.Group;
  /** Centre de l'îlot à la surface, pour y poser étoiles et cadenas. */
  centre: THREE.Vector3;
}

export class Archipel {
  readonly groupe = new THREE.Group();
  readonly ilots: Ilot[];
  private readonly pas: THREE.InstancedMesh;

  constructor() {
    this.ilots = ORDRE_ILES.map((biome) => {
      const ile = lireCarte(ILOTS[biome], biome);
      const groupe = construireIle(ile);
      const souche = modeleSouche(1);
      const maillage = new THREE.Mesh(souche.geometrie, souche.materiaux);
      maillage.castShadow = maillage.receiveShadow = true;
      versMonde({ x: ile.souche.x + 0.5, y: ile.souche.y + 0.5 }, ile, maillage.position);
      groupe.add(maillage);
      const { droite, haut } = PLACES[biome];
      // Vue de départ (angle π/4) : la droite de l'écran au sol est (1, -1)/√2, le haut (-1, -1)/√2.
      const centre = new THREE.Vector3((droite - haut) * Math.SQRT1_2, 0, (-droite - haut) * Math.SQRT1_2).round();
      groupe.position.copy(centre);
      this.groupe.add(groupe);
      return { biome, groupe, centre };
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
