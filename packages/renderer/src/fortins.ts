// Les quatre tours de guerre, 3 stades chacune : bois brûlé, métal rouillé, et l'élément de Tiny Shrooms au
// sommet (ruche, cristal, tourbe, champignon). Chaque stade monte plus haut et se hérisse davantage.
// Repère : 12 voxels par case, x et z de -6 à 5 ; la caméra regarde depuis +x +z (faces avant).
import type { TypeTour } from '@spore-siege/engine';
import { lumineuse } from './palette';
import { hachage, Voxels } from './voxels';

const BOIS = 0x6b4a2f;
const BOIS_SOMBRE = 0x553a25;
const BOIS_BRULE = 0x33241a;
const POINTE = 0xb09366;
const METAL = 0x5b5550;
const METAL_SOMBRE = 0x37322e;
const METAL_CLAIR = 0x8a847c;
const ROUILLE = 0x9a4a24;
const RIVET = 0xc9b48a;
const PIERRE = 0x7d776b;
const PIERRE_SOMBRE = 0x5f5a50;
const ROUGE = 0xa8322a;
const ROUGE_SOMBRE = 0x7a2420;
const TROU = 0x1a120c;
const MIEL = 0xe0a83a;
const MIEL_SOMBRE = 0xb07a26;
const ABEILLE = 0xf2d24a;
const CRISTAL = 0x6fd6ea;
const CRISTAL_VIF = 0xc4f6ff;
const TOURBE = 0x4a3826;
const MOUSSE = 0x7c8f3c;
const CHAPEAU = 0xc8403a;
const POIS = 0xf3e6c8;
const LAMELLES = 0xe8d9b8;
lumineuse(CRISTAL, CRISTAL_VIF);

const COINS = [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const;

/** Dalle de pierre sur toute la case. */
function socle(v: Voxels): void {
  v.boite(-5, 0, -5, 4, 1, 4, PIERRE);
  v.peindre((x, y, z, c) => c === PIERRE && hachage(x, y, z) < 0.3, PIERRE_SOMBRE);
}

/** Cerclage de métal à la hauteur `y` sur ce qui est déjà en bois : taches de rouille, rivets aux coins. */
function cercler(v: Voxels, y: number): void {
  v.peindre((x, yy, z, c) => yy === y && (c === BOIS || c === BOIS_SOMBRE), METAL);
  v.peindre((x, yy, z, c) => yy === y && c === METAL && hachage(x, y, z) < 0.25, ROUILLE);
}

/** Fût carré de planches (de -a à a-1), cerclé de métal tous les 4 voxels en partant du haut. */
function fut(v: Voxels, a: number, y0: number, y1: number, cerclages = true): void {
  v.boite(-a, y0, -a, a - 1, y1, a - 1, BOIS);
  v.peindre((x, y, z, c) => c === BOIS && y >= y0 && ((x + z) & 1) === 0, BOIS_SOMBRE);
  if (cerclages) for (let y = y1 - 1; y > y0; y -= 4) cercler(v, y);
  for (const [sx, sz] of COINS) {
    const x = sx < 0 ? -a : a - 1;
    const z = sz < 0 ? -a : a - 1;
    for (let y = y1 - 1; y > y0; y -= 4) if (cerclages) v.poser(x, y, z, RIVET);
  }
}

/** Merlons de bois brûlé sur le pourtour du fût, un voxel sur deux. */
function creneaux(v: Voxels, a: number, y: number): void {
  for (let i = -a; i < a; i += 2) {
    v.poser(i, y, -a, BOIS_BRULE).poser(i + 1, y, a - 1, BOIS_BRULE);
    v.poser(-a, y, i + 1, BOIS_BRULE).poser(a - 1, y, i, BOIS_BRULE);
  }
}

/** Pieux taillés qui sortent en biais des coins et du milieu des faces. */
function piques(v: Voxels, a: number, y: number): void {
  for (const [sx, sz] of COINS) {
    const x0 = sx < 0 ? -a : a - 1;
    const z0 = sz < 0 ? -a : a - 1;
    v.poser(x0 + sx, y + 1, z0 + sz, BOIS_BRULE).poser(x0 + sx * 2, y + 2, z0 + sz * 2, POINTE);
  }
  for (const [x, z, dx, dz] of [[-1, a - 1, 0, 1], [a - 1, -1, 1, 0], [0, -a, 0, -1], [-a, 0, -1, 0]] as const)
    v.poser(x + dx, y, z + dz, BOIS_BRULE).poser(x + dx * 2, y + 1, z + dz * 2, POINTE);
}

/** Mât de métal et fanion rouge tourné vers la caméra. */
function drapeau(v: Voxels, x: number, z: number, y0: number, h: number): void {
  v.boite(x, y0, z, x, y0 + h, z, METAL_SOMBRE);
  v.boite(x + 1, y0 + h - 2, z, x + 3, y0 + h, z, ROUGE);
  v.poser(x + 3, y0 + h - 2, z, ROUGE_SOMBRE).poser(x + 1, y0 + h - 2, z, ROUGE_SOMBRE);
}

/** Creuse une ouverture sur la face avant (+z) : premier voxel plein rencontré en venant de l'avant. */
function percer(v: Voxels, xs: number[], ys: number[], couleur = TROU): void {
  for (const x of xs)
    for (const y of ys)
      for (let z = 6; z > -6; z--)
        if (v.lire(x, y, z) !== undefined) {
          v.poser(x, y, z, couleur);
          break;
        }
}

/** Poste-ruche : fortin de planches coiffé d'une ruche en cloche, abeilles autour. */
function ruche(v: Voxels, stade: number): void {
  const a = stade === 1 ? 3 : 4;
  const haut = [4, 7, 10][stade - 1]!;
  fut(v, a, 2, haut, stade >= 2);
  if (stade >= 2) creneaux(v, a, haut + 1);
  const r = 2.4 + stade * 0.4;
  const h = 3 + stade;
  v.dome(-0.5, -0.5, haut + 1, r, h, MIEL);
  v.peindre((x, y, z, c) => c === MIEL && Math.floor((y - haut - 1) / 2) % 2 === 1, MIEL_SOMBRE);
  percer(v, [-1, 0], [haut + 2]);
  // Meurtrière dans le fût.
  percer(v, [-1, 0], [haut - 2, haut - 3]);
  const sommet = haut + 1 + h;
  if (stade >= 2) v.poser(3, sommet - 1, 2, ABEILLE).poser(-4, sommet - 3, 2, ABEILLE);
  if (stade >= 3) {
    v.poser(2, sommet + 1, -3, ABEILLE);
    piques(v, a, haut - 4);
    drapeau(v, -a, -a, haut + 2, 6);
  }
}

/** Obélisque : socle de pierre, griffes de métal qui serrent un cristal ; éclats qui poussent à côté. */
function cristal(v: Voxels, stade: number): void {
  const haut = [3, 5, 7][stade - 1]!;
  v.cylindre(-0.5, -0.5, 2, haut, 3.2, PIERRE, 2.6);
  v.peindre((x, y, z, c) => c === PIERRE && y >= 2 && hachage(x, y, z) < 0.3, PIERRE_SOMBRE);
  v.disque(-0.5, haut, -0.5, 3.6, METAL);
  v.peindre((x, y, z, c) => y === haut && c === METAL && hachage(x, y, z) < 0.25, ROUILLE);
  for (const [sx, sz] of COINS) {
    const x = sx < 0 ? -3 : 2;
    const z = sz < 0 ? -3 : 2;
    v.boite(x, haut + 1, z, x, haut + 2 + stade, z, METAL);
    v.poser(x - sx, haut + 3 + stade, z - sz, ROUILLE);
  }
  const hc = 5 + stade * 3;
  v.cylindre(-0.5, -0.5, haut + 1, haut + hc, 1.6 + stade * 0.25, CRISTAL, 0.3);
  v.peindre((x, y, z, c) => c === CRISTAL && (y > haut + hc * 0.65 || hachage(x, y, z) < 0.12), CRISTAL_VIF);
  if (stade >= 2) v.cylindre(-0.5, -3.5, haut + 1, haut + 3 + stade, 0.9, CRISTAL, 0.2);
  if (stade >= 3) {
    v.cylindre(-3.5, -0.5, haut + 1, haut + 5, 0.9, CRISTAL, 0.2);
    v.cylindre(2.5, -0.5, haut + 1, haut + 4, 0.8, CRISTAL_VIF, 0.2);
    piques(v, 3, haut - 2);
  }
}

/** Mortier à tourbe : casemate basse, gros tube rouillé penché vers l'avant, mottes de tourbe moussue. */
function mortier(v: Voxels, stade: number): void {
  const haut = [3, 4, 5][stade - 1]!;
  fut(v, 4, 2, haut, stade >= 2);
  if (stade >= 2) creneaux(v, 4, haut + 1);
  const r = 1.4 + stade * 0.4;
  const ht = 3 + stade * 2;
  for (let i = 0; i <= ht; i++) {
    const t = i / ht;
    const c = -0.5 + i * 0.25;
    v.disque(c, haut + 1 + i, c, r + t * 0.6, i === ht || i === Math.floor(ht / 2) ? ROUILLE : METAL_CLAIR);
  }
  const c = -0.5 + ht * 0.25;
  v.disque(c, haut + 1 + ht, c, r - 0.4, TROU);
  const mottes = [[-4, -4], [2, -4], [-4, 2], [2, 2]].slice(0, stade + 1);
  for (const [x, z] of mottes) {
    v.boite(x!, haut + 1, z!, x! + 1, haut + 1, z! + 1, TOURBE);
    v.poser(x!, haut + 2, z!, MOUSSE);
  }
  if (stade >= 3) {
    piques(v, 4, haut - 2);
    drapeau(v, -4, 3, haut + 2, 5);
  }
}

/** Canon à spores : tourelle ronde de planches, fûts de métal, coiffée d'un chapeau de champignon. */
function canon(v: Voxels, stade: number): void {
  const haut = [4, 7, 10][stade - 1]!;
  v.cylindre(-0.5, -0.5, 2, haut, 3.4, BOIS);
  v.peindre((x, y, z, c) => c === BOIS && (Math.round(Math.atan2(z + 0.5, x + 0.5) * 3) & 1) === 0, BOIS_SOMBRE);
  if (stade >= 2) for (let y = haut - 1; y > 2; y -= 4) cercler(v, y);
  // Fûts : avant (+z), puis droite (+x), puis gauche (-x).
  const yc = haut - 2;
  const futs: [number, number, number, number, number, number][] = [
    [-1, yc - 1, 2, 0, yc, 5],
    [2, yc - 1, -1, 5, yc, 0],
    [-6, yc - 1, -1, -3, yc, 0],
  ];
  for (const [x0, y0, z0, x1, y1, z1] of futs.slice(0, stade)) {
    v.boite(x0, y0, z0, x1, y1, z1, METAL_CLAIR);
    v.peindre((x, y, z, col) => col === METAL_CLAIR && (x === -6 || x === 5 || z === 5), ROUILLE);
  }
  const r = 3.8 + stade * 0.5;
  v.disque(-0.5, haut + 1, -0.5, r - 0.6, LAMELLES);
  v.dome(-0.5, -0.5, haut + 2, r, 2 + stade, CHAPEAU);
  v.peindre((x, y, z, c) => c === CHAPEAU && hachage(x, y, z) < 0.18, POIS);
  if (stade >= 2) {
    const sommet = haut + 3 + stade;
    v.boite(-1, sommet, -1, 0, sommet + stade - 1, 0, METAL_SOMBRE);
    v.poser(-1, sommet + stade, -1, POINTE);
  }
  if (stade >= 3) piques(v, 3, 3);
}

/** `stade` de 1 à 3. */
export function fortin(type: TypeTour, stade: number): Voxels {
  const v = new Voxels();
  socle(v);
  ({ ruche, cristal, mortier, canon })[type](v, stade);
  return v;
}
