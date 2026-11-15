// Monstres de la Rouille : bestioles couvertes de moisissure grise, taches de rouille, yeux qui luisent ;
// placées entre deux instantanés du moteur pour un mouvement fluide. Barre de vie dès le premier coup ;
// à la mort, le monstre s'écrase puis éclate en cubes, et ses spores montent en « +N ».
import * as THREE from 'three';
import { MONSTRES, type Ile, type Instantane, type TypeMonstre } from '@spore-siege/engine';
import { versMonde } from './repere';
import { lumineuse } from './palette';
import { Eclats } from './effets';
import { hachage, Voxels, type Modele } from './voxels';

const M = {
  gris: 0x8d9198,
  grisClair: 0xb9bec4,
  sombre: 0x4c4f57,
  ventre: 0x6a6d74,
  rouille: 0xb8572b,
  rouilleSombre: 0x7e3a1e,
  carapace: 0x553a32,
  aile: 0xd8e2ea,
  oeil: 0xffa23a,
  pied: 0xc9c1b0,
  chapeau: 0x8a3b22,
  soin: 0x9be05a,
  phalene: 0xd9cfb8,
  oeuf: 0xd6d2a8,
  sangsue: 0x4a4f3a,
  sangsueVentre: 0x6b6a4a,
  crapaud: 0x6f7a5a,
  crapaudVentre: 0xa8a48a,
  chenille: 0x7f8c56,
  chenilleVentre: 0xa9ad86,
  sauterelle: 0x9a9462,
  sauterelleSombre: 0x5e5a38,
  corbeau: 0x2b2d38,
  plume: 0x3f4352,
  bec: 0x5a5048,
};
lumineuse(M.oeil, M.soin);
const C = -0.5;

/** Taches de rouille éparses, tirées d'un hachage de la position. */
function taches(v: Voxels, fond: number, part: number, couleur = M.rouille): void {
  v.peindre((x, y, z, c) => c === fond && hachage(x, y, z) < part, couleur);
}

/** Duvet de moisissure : quelques voxels clairs posés sur le dessus des voxels `fond`. */
function duvet(v: Voxels, fond: number, part: number): void {
  const poses: [number, number, number][] = [];
  for (const [x, y, z, c] of v.entrees())
    if (c === fond && v.lire(x, y + 1, z) === undefined && hachage(x, y, z + 7) < part) poses.push([x, y + 1, z]);
  for (const [x, y, z] of poses) v.poser(x, y, z, M.grisClair);
}

/** Limace : longue, basse, dos moisi, deux cornes aux yeux qui luisent (avant = +x). */
function limace(): Voxels {
  const v = new Voxels().boule(C - 1, 1.5, C, 3.4, 1.5, 1.8, M.gris);
  v.boule(C + 2, 2.2, C, 1.8, 1.8, 1.6, M.gris);
  v.peindre((_x, y, _z, c) => c === M.gris && y === 0, M.ventre);
  taches(v, M.gris, 0.16);
  duvet(v, M.gris, 0.25);
  v.boite(2, 4, -2, 2, 5, -2, M.sombre).boite(2, 4, 1, 2, 5, 1, M.sombre);
  return v.poser(3, 6, -2, M.oeil).poser(3, 6, 1, M.oeil);
}

/** Moucheron : petit corps sombre rayé de rouille, gros yeux qui luisent, ailes claires. */
function moucheron(): Voxels {
  const v = new Voxels().boule(C - 1, 5, C, 2, 1.3, 1.3, M.sombre);
  v.peindre((x, _y, _z, c) => c === M.sombre && x <= -2 && (x & 1) === 0, M.rouille);
  v.boule(C + 1.5, 5.5, C, 1.2, 1.2, 1.4, M.sombre);
  v.poser(2, 6, -2, M.oeil).poser(2, 6, 1, M.oeil);
  v.boite(-2, 7, -4, 0, 7, -2, M.aile).boite(-2, 7, 1, 0, 7, 3, M.aile);
  for (const x of [-2, 0]) v.poser(x, 3, -1, M.sombre).poser(x, 3, 0, M.sombre);
  return v;
}

/** Scarabée : carapace rouillée fendue au milieu, plaques de moisissure, tête sombre à mandibules. */
function scarabee(): Voxels {
  const v = new Voxels().dome(C - 1, C, 1, 3.6, 3, M.carapace);
  v.peindre((_x, _y, z, c) => c === M.carapace && (z === -1 || z === 0), M.rouilleSombre);
  taches(v, M.carapace, 0.22, M.gris);
  duvet(v, M.carapace, 0.12);
  v.boite(3, 1, -2, 4, 3, 1, M.sombre);
  v.poser(5, 1, -2, M.rouille).poser(5, 1, 1, M.rouille).poser(6, 1, -2, M.sombre).poser(6, 1, 1, M.sombre);
  v.poser(4, 3, -2, M.oeil).poser(4, 3, 1, M.oeil);
  for (const x of [-3, -1, 1]) v.poser(x, 0, -5, M.sombre).poser(x, 0, 4, M.sombre);
  return v;
}

/** Amas de Rouille : boule de moisissure bosselée, couverte de duvet, plusieurs yeux. */
function amas(rayon: number): Voxels {
  const v = new Voxels().boule(C, rayon, C, rayon, rayon * 0.9, rayon, M.gris);
  v.boule(C + rayon * 0.5, rayon * 1.5, C - rayon * 0.3, rayon * 0.55, rayon * 0.5, rayon * 0.55, M.gris);
  v.boule(C - rayon * 0.6, rayon * 1.2, C + rayon * 0.5, rayon * 0.5, rayon * 0.5, rayon * 0.5, M.gris);
  taches(v, M.gris, 0.3);
  duvet(v, M.gris, 0.3);
  // Yeux sur la face avant (+x), plus nombreux chez le gros.
  const yeux = rayon > 2 ? [[1.4, -1], [1.9, 1], [1, 2]] : [[1.2, -0.5], [1.2, 0.8]];
  for (const [hy, z] of yeux) {
    const y = Math.round(rayon * hy!);
    for (let x = 6; x > -6; x--)
      if (v.lire(x, y, Math.round(C + z!)) !== undefined) {
        v.poser(x, y, Math.round(C + z!), M.oeil);
        break;
      }
  }
  return v;
}

/** Phalène moisie : grandes ailes triangulaires bordées de sombre, ocelles de rouille, corps velu dessus (avant = +x). */
function volant(): Voxels {
  const v = new Voxels();
  // Envergure de chaque côté selon x : large à l'avant, effilée à l'arrière.
  const envergure: Record<number, number> = { 3: 4, 2: 6, 1: 6, 0: 5, [-1]: 4, [-2]: 4, [-3]: 3, [-4]: 2 };
  for (const [cle, n] of Object.entries(envergure)) {
    const x = Number(cle);
    for (let k = 1; k <= n; k++) {
      const bord = k === n || x === -4;
      const couleur = bord ? M.sombre : M.phalene;
      v.poser(x, 9, k, couleur).poser(x, 9, -1 - k, couleur);
    }
  }
  taches(v, M.phalene, 0.18, M.gris);
  // Ocelles de rouille sur les ailes avant.
  for (const z of [3, 4]) v.poser(1, 9, z, M.rouille).poser(1, 9, -1 - z, M.rouille);
  v.poser(2, 9, 3, M.rouilleSombre).poser(2, 9, -4, M.rouilleSombre);
  // Corps velu posé sur les ailes, tête et yeux qui luisent.
  v.boule(C - 0.5, 10, C, 2.6, 1, 1, M.sombre);
  duvet(v, M.sombre, 0.5);
  v.poser(3, 10, -1, M.oeil).poser(3, 10, 0, M.oeil);
  v.poser(4, 11, -2, M.sombre).poser(4, 11, 1, M.sombre).poser(5, 12, -3, M.sombre).poser(5, 12, 2, M.sombre);
  return v;
}

/** Prêtre champignon : pied pâle voûté, chapeau de rouille piqué de moisissure, bâton à spore luisante. */
function soigneur(): Voxels {
  const v = new Voxels().cylindre(C, C, 0, 4, 1.8, M.pied, 1.4);
  v.dome(C, C, 5, 3.6, 2.6, M.chapeau);
  v.peindre((_x, y, _z, c) => c === M.chapeau && y === 5, M.rouilleSombre);
  taches(v, M.chapeau, 0.2, M.grisClair);
  duvet(v, M.chapeau, 0.2);
  v.poser(1, 3, -1, M.oeil).poser(1, 3, 0, M.oeil);
  // Bâton sur le côté, surmonté d'une spore qui luit.
  v.boite(0, 0, 3, 0, 7, 3, M.carapace).poser(0, 8, 3, M.soin).poser(1, 8, 3, M.soin).poser(0, 9, 3, M.soin);
  return v;
}

/** Limace-mère : une limace énorme, dos couvert d'œufs pâles et de moisissure, quatre cornes aux yeux qui luisent. */
function limaceMere(): Voxels {
  const v = new Voxels().boule(C - 2, 3, C, 7, 3, 3.8, M.gris);
  v.boule(C + 4, 4.4, C, 3.4, 3.4, 3.2, M.gris);
  v.peindre((_x, y, _z, c) => c === M.gris && y <= 1, M.ventre);
  taches(v, M.gris, 0.2);
  // Grappes d'œufs sur le dos.
  for (const [x, z] of [[-6, -1], [-4, 1], [-2, -2], [-1, 1], [-5, -3], [-3, 3], [0, -1]] as const) v.boule(x, 6.2, z, 1.1, 0.9, 1.1, M.oeuf);
  taches(v, M.oeuf, 0.15, M.rouille);
  duvet(v, M.gris, 0.35);
  for (const z of [-3, -1, 1, 3]) v.boite(5, 8, z - 1, 5, 9 + (Math.abs(z) === 1 ? 1 : 0), z - 1, M.sombre);
  for (const z of [-3, -1, 1, 3]) v.poser(6, 10 + (Math.abs(z) === 1 ? 1 : 0), z - 1, M.oeil);
  // Bouche sombre à l'avant.
  return v.boite(8, 2, -2, 8, 3, 1, M.sombre);
}

/** Sangsue : long corps annelé vase sombre, anneaux de rouille, ventouse à l'avant, deux yeux qui luisent (avant = +x). */
function sangsue(): Voxels {
  const v = new Voxels();
  for (const [x, r] of [[-5, 0.9], [-3.5, 1.2], [-2, 1.4], [-0.5, 1.5], [1, 1.4], [2.5, 1.2]] as const) v.boule(C + x, 1.2, C, 1.1, r, r, M.sangsue);
  v.peindre((_x, y, _z, c) => c === M.sangsue && y === 0, M.sangsueVentre);
  v.peindre((x, _y, _z, c) => c === M.sangsue && (x & 1) === 0 && x > -6 && hachage(x, 1, 1) < 0.55, M.rouille);
  duvet(v, M.sangsue, 0.12);
  v.boite(3, 0, -1, 3, 2, 0, M.sombre).poser(3, 1, -1, M.rouilleSombre).poser(3, 1, 0, M.rouilleSombre);
  return v.poser(2, 3, -2, M.oeil).poser(2, 3, 1, M.oeil);
}

/** Crapaud : trapu et large, peau verruqueuse moisie, pustules de rouille, gros yeux luisants sur le dessus. */
function crapaud(): Voxels {
  const v = new Voxels().boule(C - 0.5, 2.2, C, 3, 2.3, 2.8, M.crapaud);
  v.peindre((_x, y, _z, c) => c === M.crapaud && y <= 1, M.crapaudVentre);
  taches(v, M.crapaud, 0.14);
  duvet(v, M.crapaud, 0.2);
  // Pattes arrière repliées, pattes avant.
  for (const z of [-3, 2]) v.boite(-4, 0, z, -2, 2, z, M.crapaud).boite(1, 0, z, 2, 0, z, M.crapaud);
  // Yeux en bosse sur le dessus de la tête.
  for (const z of [-2, 1]) v.boite(1, 4, z, 2, 5, z, M.crapaud).poser(2, 5, z, M.oeil).poser(3, 5, z, M.oeil);
  // Large bouche sombre.
  return v.boite(3, 1, -2, 3, 1, 1, M.sombre);
}

/** Crapaud-roi : un crapaud énorme, couronne de métal rouillé, dos de pustules et de vase, gorge pâle, yeux luisants. */
function crapaudRoi(): Voxels {
  const v = new Voxels().boule(C - 1, 4.5, C, 7, 4.6, 6, M.crapaud);
  v.peindre((_x, y, _z, c) => c === M.crapaud && y <= 2, M.crapaudVentre);
  taches(v, M.crapaud, 0.18);
  duvet(v, M.crapaud, 0.3);
  // Pattes arrière énormes, repliées ; pattes avant.
  for (const z of [-7, 5]) v.boule(-5, 2, z + 0.5, 2.6, 2, 1.6, M.crapaud);
  for (const z of [-5, 4]) v.boite(3, 0, z, 5, 1, z, M.crapaud);
  // Yeux en bosse et couronne entre les deux.
  for (const z of [-4, 3]) v.boule(3, 8.5, z, 1.4, 1.4, 1.4, M.crapaud).boite(4, 9, z, 4, 9, z, M.oeil).poser(5, 9, z, M.oeil);
  v.boite(-2, 9, -3, 1, 9, 2, M.rouilleSombre);
  for (const [x, z] of [[-2, -3], [1, -3], [-2, 2], [1, 2], [-0.5, -0.5]] as const) v.boite(Math.round(x), 10, Math.round(z), Math.round(x), 11, Math.round(z), M.rouille);
  // Large bouche sombre.
  return v.boite(6, 3, -4, 6, 3, 3, M.sombre);
}

/** Chenille : six anneaux dodus vert-de-gris cerclés de rouille, poils de moisissure, tête sombre et mandibules. */
function chenille(): Voxels {
  const v = new Voxels();
  for (const [x, r] of [[-6, 1.3], [-4.2, 1.7], [-2.2, 1.9], [-0.2, 1.9], [1.8, 1.7]] as const) v.boule(C + x, 1.9, C, 1.1, r, r, M.chenille);
  v.peindre((_x, y, _z, c) => c === M.chenille && y === 0, M.chenilleVentre);
  // Un anneau sur deux cerclé de rouille.
  v.peindre((x, _y, _z, c) => c === M.chenille && (x === -5 || x === -1 || x === 3), M.rouille);
  duvet(v, M.chenille, 0.3);
  // Pattes courtes sous chaque anneau.
  for (const x of [-6, -4, -2, 0]) for (const z of [-2, 1]) v.poser(x, 0, z, M.sombre);
  // Tête, mandibules, yeux.
  v.boule(C + 3.8, 2.4, C, 1.5, 1.6, 1.6, M.sombre);
  v.poser(5, 1, -1, M.rouilleSombre).poser(5, 1, 0, M.rouilleSombre);
  return v.poser(5, 3, -2, M.oeil).poser(5, 3, 1, M.oeil);
}

/** Sauterelle : corps fin et sec, longues pattes arrière repliées, antennes, yeux luisants. */
function sauterelle(): Voxels {
  const v = new Voxels().boule(C - 0.5, 2, C, 2.6, 1, 0.9, M.sauterelle);
  v.boule(C + 2.3, 2.4, C, 1.1, 1.2, 1, M.sauterelle);
  taches(v, M.sauterelle, 0.2);
  // Ailes repliées sur le dos, plus sombres.
  v.boite(-3, 3, -1, 1, 3, 0, M.sauterelleSombre);
  // Pattes arrière : cuisse qui monte, tibia qui redescend.
  for (const z of [-2, 1]) v.boite(-1, 2, z, 0, 4, z, M.sauterelle).boite(-3, 0, z, -2, 3, z, M.sauterelleSombre).poser(1, 0, z, M.sombre);
  // Antennes et yeux.
  for (const z of [-1, 0]) v.poser(3, 4, z, M.sauterelleSombre).poser(4, 5, z, M.sauterelleSombre).poser(5, 6, z, M.sauterelleSombre);
  return v.poser(3, 3, -1, M.oeil).poser(3, 3, 0, M.oeil);
}

/**
 * Grand Corbeau rouillé : corps noir-bleu, ailes déployées le long de z frangées de plumes plus claires, plaques de
 * métal rouillé sur les ailes, bec sombre, yeux qui luisent, queue en éventail.
 */
function corbeau(): Voxels {
  const v = new Voxels().boule(C - 0.5, 4, C, 4.5, 2.4, 2.4, M.corbeau);
  v.boule(C + 4, 5.5, C, 2, 2, 1.8, M.corbeau);
  // Bec long et épais, un peu crochu.
  v.boite(6, 5, -1, 8, 6, 0, M.bec).poser(9, 5, -1, M.bec).poser(9, 5, 0, M.bec).poser(9, 4, 0, M.bec);
  v.poser(5, 7, -2, M.oeil).poser(5, 7, 1, M.oeil);
  // Queue en éventail.
  for (let x = -5; x >= -8; x--) v.boite(x, 4, -1 - (-5 - x), x, 4, (-5 - x), M.plume);
  // Ailes : envergure de chaque côté selon z, plus courte vers l'arrière ; bout des plumes plus clair.
  const envergure: Record<number, number> = { 3: 6, 2: 9, 1: 10, 0: 10, [-1]: 9, [-2]: 8, [-3]: 6, [-4]: 4 };
  for (const [cle, n] of Object.entries(envergure)) {
    const x = Number(cle);
    for (let k = 2; k <= n; k++) {
      const couleur = k >= n - 1 || (k > 4 && x <= -2) ? M.plume : M.corbeau;
      v.poser(x, 5, k, couleur).poser(x, 5, -1 - k, couleur);
    }
  }
  // Plaques de métal rouillé rivées sur les ailes.
  for (const [x, z] of [[1, 4], [0, 5], [1, 5], [-1, 4], [2, 6]] as const) v.poser(x, 6, z, M.rouille).poser(x, 6, -1 - z, M.rouille);
  v.poser(0, 6, 7, M.rouilleSombre).poser(0, 6, -8, M.rouilleSombre);
  taches(v, M.corbeau, 0.06);
  // Pattes griffues.
  for (const z of [-2, 1]) v.boite(0, 0, z, 0, 1, z, M.bec).poser(1, 0, z, M.bec);
  return v;
}

/** Couleurs des éclats quand le monstre meurt. */
export const ECLATS: Record<TypeMonstre, number[]> = {
  limace: [M.gris, M.rouille, M.grisClair],
  moucheron: [M.sombre, M.rouille, M.aile],
  scarabee: [M.carapace, M.rouilleSombre, M.gris],
  amas: [M.gris, M.rouille, M.grisClair],
  petitAmas: [M.gris, M.rouille, M.grisClair],
  volant: [M.phalene, M.sombre, M.rouille],
  soigneur: [M.chapeau, M.pied, M.soin],
  limaceMere: [M.gris, M.oeuf, M.rouille],
  sangsue: [M.sangsue, M.rouille, M.sangsueVentre],
  crapaud: [M.crapaud, M.rouille, M.crapaudVentre],
  crapaudRoi: [M.crapaud, M.rouille, M.crapaudVentre],
  chenille: [M.chenille, M.rouille, M.chenilleVentre],
  sauterelle: [M.sauterelle, M.sauterelleSombre, M.rouille],
  corbeau: [M.corbeau, M.plume, M.rouille],
};

let modeles: Record<TypeMonstre, Modele> | null = null;
export function modelesMonstres(): Record<TypeMonstre, Modele> {
  modeles ??= {
    limace: limace().modele(false),
    moucheron: moucheron().modele(false),
    scarabee: scarabee().modele(false),
    amas: amas(3).modele(false),
    petitAmas: amas(1.8).modele(false),
    volant: volant().modele(false),
    soigneur: soigneur().modele(false),
    limaceMere: limaceMere().modele(false),
    sangsue: sangsue().modele(false),
    crapaud: crapaud().modele(false),
    crapaudRoi: crapaudRoi().modele(false),
    chenille: chenille().modele(false),
    sauterelle: sauterelle().modele(false),
    corbeau: corbeau().modele(false),
  };
  return modeles;
}

/** Secondes : le monstre s'écrase, puis ses éclats volent, pendant que son butin monte. */
const DUREE_ECRASE = 0.12;
/** Gerbes d'eau du Crapaud-roi. */
const EAU = 0x4a9a8e;
const EAU_CLAIRE = 0xa8dcd2;
/** Sangsue sous l'eau : de combien elle s'enfonce (unités du monde). */
const PROFONDEUR_PLONGEE = 0.45;
/** Crapaud : hauteur du bond. */
const HAUTEUR_SAUT = 0.55;
const DUREE_BUTIN = 0.9;
const DUREE_MORSURE = 0.15;

const sansProfondeur = { depthTest: false, depthWrite: false } as const;
const FOND = new THREE.SpriteMaterial({ color: 0x1a120c, ...sansProfondeur });
const JAUGES = {
  vert: new THREE.SpriteMaterial({ color: 0x7bd63a, ...sansProfondeur }),
  jaune: new THREE.SpriteMaterial({ color: 0xf0c040, ...sansProfondeur }),
  rouge: new THREE.SpriteMaterial({ color: 0xe04030, ...sansProfondeur }),
};

/** Texte « +N » en pixels nets (police des chiffres de l'interface), mis en cache par valeur. */
const textes = new Map<number, { materiau: THREE.SpriteMaterial; largeur: number; hauteur: number }>();
function texteButin(n: number): { materiau: THREE.SpriteMaterial; largeur: number; hauteur: number } {
  let t = textes.get(n);
  if (t) return t;
  const texte = `+${n}`;
  const toile = document.createElement('canvas');
  const ctx = toile.getContext('2d')!;
  const police = "9px 'Chiffres', 'Pixelify Sans', sans-serif";
  ctx.font = police;
  toile.width = Math.ceil(ctx.measureText(texte).width) + 4;
  toile.height = 12;
  ctx.font = police;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#1a120c';
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const)
    ctx.fillText(texte, 2 + dx, 6 + dy);
  ctx.fillStyle = '#ffe08a';
  ctx.fillText(texte, 2, 6);
  // Bords nets : chaque pixel est plein ou vide.
  const image = ctx.getImageData(0, 0, toile.width, toile.height);
  for (let i = 3; i < image.data.length; i += 4) image.data[i] = image.data[i]! > 110 ? 255 : 0;
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(toile);
  texture.magFilter = texture.minFilter = THREE.NearestFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  t = { materiau: new THREE.SpriteMaterial({ map: texture, transparent: true, ...sansProfondeur }), largeur: toile.width, hauteur: toile.height };
  textes.set(n, t);
  return t;
}

interface Corps {
  maillage: THREE.Mesh;
  type: TypeMonstre;
  hauteur: number;
  fond: THREE.Sprite;
  jauge: THREE.Sprite;
  /** Sangsue : 0 en surface, 1 sous l'eau. */
  plonge?: number;
  /** Grand Corbeau : son ombre au sol, et sa hauteur affichée (lissée). */
  ombre?: THREE.Mesh;
  vol?: number;
}

/** Hauteur du Grand Corbeau quand il tourne au-dessus de l'île, en cases. */
const HAUTEUR_VOL = 2.4;
/** Le corbeau est un boss : son modèle est grossi d'autant. */
const TAILLE_CORBEAU = 1.5;
const OMBRE = new THREE.CircleGeometry(0.55, 20).rotateX(-Math.PI / 2);
/** Cible d'un piqué du corbeau : anneau rouge qui bat, le temps qu'il arrive. */
const ALERTE = new THREE.RingGeometry(0.4, 0.55, 24).rotateX(-Math.PI / 2);
const DUREE_ALERTE = 1.6;
interface Mourant {
  maillage: THREE.Mesh;
  type: TypeMonstre;
  debut: number;
  mort: boolean;
}
interface Butin {
  sprite: THREE.Sprite;
  debut: number;
  depart: THREE.Vector3;
  largeur: number;
  hauteur: number;
}

export class MonstresRendu {
  readonly groupe = new THREE.Group();
  /** Barres de vie et butins : dessinés par-dessus tout, sans contour (superposition). */
  readonly dessus = new THREE.Group();
  private readonly corps = new Map<number, Corps>();
  private mourants: Mourant[] = [];
  private alertes: { maillage: THREE.Mesh; debut: number }[] = [];
  private readonly eclats = new Eclats();
  private butins: Butin[] = [];
  private readonly position = new THREE.Vector3();
  private readonly avant = new THREE.Vector3();

  constructor() {
    this.groupe.add(this.eclats.groupe);
  }

  /**
   * Place les monstres entre `precedent` et `actuel` ; `alpha` de 0 (précédent) à 1 (actuel).
   * `instant` en ms ; `parPixel` : taille d'un pixel de l'image en unités du monde (barres et textes nets).
   */
  afficher(ile: Ile, precedent: Instantane | null, actuel: Instantane, alpha: number, instant: number, parPixel: number): void {
    const t = instant / 1000;
    const anciens = new Map(precedent?.monstres.map((m) => [m.id, m.position]));
    const vus = new Set<number>();
    for (const m of actuel.monstres) {
      vus.add(m.id);
      let corps = this.corps.get(m.id);
      if (!corps) {
        const modele = modelesMonstres()[m.type];
        const maillage = new THREE.Mesh(modele.geometrie, modele.materiaux);
        maillage.castShadow = true;
        corps = { maillage, type: m.type, hauteur: modele.hauteur, fond: new THREE.Sprite(FOND), jauge: new THREE.Sprite(JAUGES.vert) };
        this.corps.set(m.id, corps);
        this.groupe.add(maillage);
        this.dessus.add(corps.fond, corps.jauge);
      }
      const ancienne = anciens.get(m.id) ?? m.position;
      const x = ancienne.x + (m.position.x - ancienne.x) * alpha;
      const y = ancienne.y + (m.position.y - ancienne.y) * alpha;
      // Léger décalage propre à chaque monstre : la file ne marche pas sur une seule ligne.
      const ecart = ((m.id * 0.618) % 1) * 0.36 - 0.18;
      versMonde({ x: x + ecart, y: y - ecart }, ile, this.position);
      if (m.type === 'moucheron') this.position.y += Math.sin(instant / 120 + m.id) * 0.06;
      if (m.type === 'volant') this.position.y += Math.sin(instant / 300 + m.id) * 0.08;
      if (m.altitude !== null) this.planer(corps, m.altitude, x, y, ile, instant);
      // Sauterelle : petits bonds rapides.
      if (m.type === 'sauterelle') this.position.y += Math.abs(Math.sin(instant / 110 + m.id)) * 0.14;
      // Sangsue : s'enfonce sous la surface des gués, ressort sur la terre (en glissant, pas d'un coup).
      corps.plonge = (corps.plonge ?? 0) + ((m.immerge ? 1 : 0) - (corps.plonge ?? 0)) * 0.25;
      // Le boss s'enfonce tout entier.
      this.position.y -= corps.plonge * Math.max(PROFONDEUR_PLONGEE, corps.hauteur + 0.1);
      // Crapaud : bond en cloche (le roi bondit plus haut).
      if (m.saut !== null) this.position.y += Math.sin(Math.PI * m.saut) * HAUTEUR_SAUT * (m.type === 'crapaudRoi' ? 1.6 : 1);
      corps.maillage.position.copy(this.position);
      if (m.type === 'crapaud' || m.type === 'crapaudRoi') {
        const etire = m.saut === null ? 0 : Math.sin(Math.PI * m.saut) * 0.25;
        corps.maillage.scale.set(1 + etire, 1 - etire * 0.6, 1);
      }
      // La phalène bat des ailes (elles s'étendent le long de z) ; le corbeau aussi, lentement, et les replie posé.
      if (m.type === 'volant') corps.maillage.scale.set(1, 1, 1 + Math.sin(instant / 70 + m.id) * 0.3);
      if (m.type === 'corbeau') {
        const vol = corps.vol ?? 1;
        corps.maillage.scale.set(TAILLE_CORBEAU, TAILLE_CORBEAU, TAILLE_CORBEAU * (0.4 + 0.6 * Math.min(1, vol * 4) + Math.sin(instant / 160) * 0.18 * Math.min(1, vol * 4)));
      }
      // Limace et amas ondulent en avançant (et s'arrêtent avec eux).
      if (m.type === 'limace' || m.type === 'amas' || m.type === 'petitAmas' || m.type === 'limaceMere') {
        const s = Math.sin((x + y) * 7 + m.id) * 0.07;
        corps.maillage.scale.set(1 + s, 1 - s, 1 + s);
      }
      // Chenille : ondule en avançant (en long), mâche quand elle mange.
      if (m.type === 'chenille') {
        const s = m.mange ? Math.abs(Math.sin(instant / 90 + m.id)) * 0.12 : Math.sin((x + y) * 6 + m.id) * 0.1;
        corps.maillage.scale.set(1 + s, 1 - s * 0.5, 1);
      }
      // Regard vers la direction de marche (+x du modèle).
      versMonde(m.position, ile, this.avant);
      versMonde(ancienne, ile, this.position);
      const dx = this.avant.x - this.position.x;
      const dz = this.avant.z - this.position.z;
      if (dx * dx + dz * dz > 1e-6) corps.maillage.rotation.y = Math.atan2(-dz, dx);
      this.placerJauge(corps, m.immerge ? 1 : m.pv / m.pvMax, parPixel);
    }
    for (const [id, corps] of this.corps) {
      if (vus.has(id)) continue;
      this.dessus.remove(corps.fond, corps.jauge);
      if (corps.ombre) this.groupe.remove(corps.ombre);
      this.corps.delete(id);
      const fin = actuel.evenements.find((e) => e.id === id && (e.type === 'mort' || e.type === 'morsure'));
      if (!fin) {
        this.groupe.remove(corps.maillage);
        continue;
      }
      this.mourants.push({ maillage: corps.maillage, type: corps.type, debut: t, mort: fin.type === 'mort' });
      if (fin.type === 'mort') this.lacherButin(fin.butin, corps.maillage.position, corps.hauteur, t);
    }
    this.animerMourants(t);
    this.eclats.animer(t);
    this.animerButins(t, parPixel);
    this.animerAlertes(t);
  }

  /** Grand Corbeau : en l'air selon son altitude (lissée), ombre au sol qui grandit quand il descend. */
  private planer(corps: Corps, altitude: number, x: number, y: number, ile: Ile, instant: number): void {
    corps.vol = (corps.vol ?? altitude) + (altitude - (corps.vol ?? altitude)) * 0.3;
    this.position.y += corps.vol * HAUTEUR_VOL + (corps.vol > 0.05 ? Math.sin(instant / 400) * 0.06 : 0);
    if (!corps.ombre) {
      corps.ombre = new THREE.Mesh(OMBRE, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
      this.groupe.add(corps.ombre);
    }
    versMonde({ x, y }, ile, corps.ombre.position).setY(0.03);
    corps.ombre.scale.setScalar(1.2 - corps.vol * 0.5);
    corps.ombre.visible = corps.vol > 0.02;
  }

  /** Le corbeau pique : un anneau rouge bat sur sa cible (fleur ou souche) pour prévenir. */
  alerter(cible: { x: number; y: number }, ile: Ile, instant: number): void {
    const maillage = new THREE.Mesh(ALERTE, new THREE.MeshBasicMaterial({ color: 0xff3a2a, transparent: true, opacity: 0.9, depthWrite: false }));
    versMonde(cible, ile, maillage.position).setY(0.04);
    this.groupe.add(maillage);
    this.alertes.push({ maillage, debut: instant / 1000 });
  }

  private animerAlertes(t: number): void {
    this.alertes = this.alertes.filter((a) => {
      const d = t - a.debut;
      if (d >= DUREE_ALERTE) {
        this.groupe.remove(a.maillage);
        (a.maillage.material as THREE.Material).dispose();
        return false;
      }
      a.maillage.scale.setScalar(1 + Math.abs(Math.sin(d * 9)) * 0.35);
      (a.maillage.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - d / DUREE_ALERTE);
      return true;
    });
  }

  /** Barre de 10 × 2 pixels dans un cadre sombre, cachée tant que le monstre est intact. */
  private placerJauge(corps: Corps, part: number, parPixel: number): void {
    // Le boss a sa grande barre en haut de l'écran (interface).
    const visible = part < 1 && !MONSTRES[corps.type].boss;
    corps.fond.visible = corps.jauge.visible = visible;
    if (!visible) return;
    const p = corps.maillage.position;
    corps.fond.position.set(p.x, p.y + corps.hauteur + 0.12, p.z);
    corps.jauge.position.copy(corps.fond.position);
    corps.fond.scale.set(12 * parPixel, 4 * parPixel, 1);
    const largeur = Math.max(1, Math.round(10 * part));
    corps.jauge.scale.set(largeur * parPixel, 2 * parPixel, 1);
    // Ancrée à gauche : son bord gauche reste au bord gauche du cadre.
    corps.jauge.center.set(5 / largeur, 0.5);
    corps.jauge.material = part > 0.5 ? JAUGES.vert : part > 0.25 ? JAUGES.jaune : JAUGES.rouge;
    corps.fond.renderOrder = 1;
    corps.jauge.renderOrder = 2;
  }

  /** « +N » qui monte au-dessus de `position` (butin d'un mort, récolte d'une fleur). */
  lacherButin(n: number, position: THREE.Vector3, hauteur: number, t: number): void {
    const { materiau, largeur, hauteur: h } = texteButin(n);
    const sprite = new THREE.Sprite(materiau.clone());
    sprite.renderOrder = 3;
    this.dessus.add(sprite);
    this.butins.push({ sprite, debut: t, depart: position.clone().setY(position.y + hauteur + 0.1), largeur, hauteur: h });
  }

  /** Le mort s'écrase puis éclate ; celui qui mord la souche rapetisse d'un coup. */
  private animerMourants(t: number): void {
    this.mourants = this.mourants.filter((m) => {
      const k = (t - m.debut) / (m.mort ? DUREE_ECRASE : DUREE_MORSURE);
      if (k < 1) {
        if (m.mort) m.maillage.scale.set(1 + 0.4 * k, 1 - 0.7 * k, 1 + 0.4 * k);
        else m.maillage.scale.setScalar(1 - k);
        return true;
      }
      this.groupe.remove(m.maillage);
      if (m.mort) this.eclater(m, t);
      return false;
    });
  }

  /** Le boss pond : grosse gerbe d'œufs et de moisissure là où il est (le Crapaud-roi : gerbe d'eau en ressortant). */
  pondre(id: number, instant: number): void {
    const corps = this.corps.get(id);
    if (!corps) return;
    if (corps.type === 'crapaudRoi') return this.eclabousser(corps, instant, 18);
    const depart = corps.maillage.position.clone().setY(corps.maillage.position.y + corps.hauteur * 0.7);
    this.eclats.lancer(depart, instant / 1000, { couleurs: [M.oeuf, M.gris, M.rouille], nombre: 14, taille: 0.16, force: 1.8, duree: 0.5 });
  }

  /** Le Crapaud-roi plonge : gerbe d'eau là où il disparaît. */
  plonger(id: number, instant: number): void {
    const corps = this.corps.get(id);
    if (corps) this.eclabousser(corps, instant, 14);
  }

  private eclabousser(corps: Corps, instant: number, nombre: number): void {
    const depart = corps.maillage.position.clone().setY(Math.max(0, corps.maillage.position.y) + 0.2);
    this.eclats.lancer(depart, instant / 1000, { couleurs: [EAU, EAU_CLAIRE, M.crapaud], nombre, taille: 0.14, force: 2, duree: 0.55 });
  }

  /** Un soigneur a soigné : petite gerbe verte sur lui et sur chaque monstre soigné. */
  soigner(ids: number[], instant: number): void {
    for (const id of ids) {
      const corps = this.corps.get(id);
      if (!corps) continue;
      const depart = corps.maillage.position.clone().setY(corps.maillage.position.y + corps.hauteur * 0.6);
      this.eclats.lancer(depart, instant / 1000, { couleurs: [M.soin], nombre: 5, taille: 0.07, force: 0.5, duree: 0.4 });
    }
  }

  private eclater(m: Mourant, t: number): void {
    const depart = m.maillage.position.clone().setY(m.maillage.position.y + 0.15);
    this.eclats.lancer(depart, t, { couleurs: ECLATS[m.type], taille: m.type === 'amas' ? 0.18 : 0.13 });
  }

  private animerButins(t: number, parPixel: number): void {
    this.butins = this.butins.filter((b) => {
      const d = t - b.debut;
      if (d >= DUREE_BUTIN) {
        this.dessus.remove(b.sprite);
        b.sprite.material.dispose();
        return false;
      }
      const monte = 1 - (1 - d / DUREE_BUTIN) ** 3;
      b.sprite.position.set(b.depart.x, b.depart.y + monte * 0.5, b.depart.z);
      b.sprite.scale.set(b.largeur * parPixel, b.hauteur * parPixel, 1);
      b.sprite.material.opacity = d < DUREE_BUTIN * 0.6 ? 1 : 1 - (d - DUREE_BUTIN * 0.6) / (DUREE_BUTIN * 0.4);
      return true;
    });
  }
}
