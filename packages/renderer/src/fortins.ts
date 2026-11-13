// Les quatre tours de guerre, 3 stades chacune : bois brûlé, métal rouillé, et l'élément de Tiny Shrooms au
// sommet (ruche, cristal, tourbe, champignon). Chaque stade monte plus haut et se hérisse davantage.
// Repère : 12 voxels par case, x et z de -6 à 5 ; la caméra regarde depuis +x +z (faces avant).
import type { Capacite, TypeTour } from '@spore-siege/engine';
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
// Stade 4 : une couleur par capacité, pour la reconnaître de loin.
const POISON = 0x8fd14f;
const PRISME = 0xc9a6ff;
const PRISME_VIF = 0xf1e6ff;
const GLU = 0xc6cf3e;
const GLU_SOMBRE = 0x8f9a2a;
const LAITON = 0xc9a24a;
lumineuse(CRISTAL, CRISTAL_VIF, POISON, PRISME, PRISME_VIF);

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

// ─── Stade 4 : le stade 3, plus ce qui fait la capacité ──────────────────────────────────────────────────────

/** Essaim : deux ruchettes accrochées au fût et un nuage d'abeilles. */
function essaim(v: Voxels): void {
  ruche(v, 3);
  for (const [x, z] of [[-5, 2], [3, -5]] as const) {
    v.dome(x + 0.5, z + 0.5, 7, 1.7, 3, MIEL);
    v.peindre((xx, y, zz, c) => c === MIEL && y === 8 && Math.abs(xx - x) < 3 && Math.abs(zz - z) < 3, MIEL_SOMBRE);
    v.poser(x, 7, z + 2, TROU);
  }
  for (const [x, y, z] of [[5, 14, 1], [-6, 12, -2], [4, 19, -4], [-3, 20, 4], [6, 9, -3], [-5, 16, 5], [1, 22, -1], [-7, 9, 3]] as const)
    v.poser(x, y, z, ABEILLE);
}

/** Dard : une longue aiguille de métal au sommet, gouttes de poison sur la ruche. */
function dard(v: Voxels): void {
  ruche(v, 3);
  v.peindre((x, y, z, c) => (c === MIEL || c === MIEL_SOMBRE) && hachage(x, y, z) < 0.14, POISON);
  v.boite(-1, 18, -1, 0, 19, 0, METAL_SOMBRE);
  v.boite(-1, 20, -1, -1, 24, -1, METAL_CLAIR);
  v.poser(-1, 25, -1, POISON).poser(-1, 26, -1, POISON);
}

/** Tempête : paratonnerres aux quatre coins, couronne d'éclats autour du cristal. */
function tempete(v: Voxels): void {
  cristal(v, 3);
  const haut = 7;
  for (const [sx, sz] of COINS) {
    const x = sx < 0 ? -4 : 3;
    const z = sz < 0 ? -4 : 3;
    v.boite(x, haut + 1, z, x, haut + 11, z, METAL);
    v.poser(x, haut + 12, z, CRISTAL_VIF).poser(x, haut + 13, z, CRISTAL_VIF);
    v.poser(x, haut + 6, z, ROUILLE);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    v.cylindre(Math.cos(a) * 2.6 - 0.5, Math.sin(a) * 2.6 - 0.5, haut + 1, haut + 4 + (i % 3) * 2, 0.7, CRISTAL, 0.2);
  }
}

/** Prisme : le cristal laisse place à un seul grand prisme violet, cerclé d'une lentille de métal. */
function prisme(v: Voxels): void {
  cristal(v, 3);
  const haut = 7;
  v.peindre((x, y, z, c) => y > haut && (c === CRISTAL || c === CRISTAL_VIF), PRISME);
  v.cylindre(-0.5, -0.5, haut + 1, haut + 22, 2.6, PRISME, 0.6);
  v.peindre((x, y, z, c) => c === PRISME && (y > haut + 16 || hachage(x, y, z) < 0.1), PRISME_VIF);
  for (let a = 0; a < 48; a++) {
    const t = (a / 48) * Math.PI * 2;
    v.poser(Math.round(-0.5 + Math.cos(t) * 3.6), haut + 11, Math.round(-0.5 + Math.sin(t) * 3.6), a % 6 ? METAL : RIVET);
  }
}

/** Salve : trois tubes côte à côte au lieu d'un gros. */
function salve(v: Voxels): void {
  const haut = 5;
  fut(v, 4, 2, haut);
  creneaux(v, 4, haut + 1);
  for (const dx of [-3, 0, 3]) {
    const ht = 7 + (dx === 0 ? 2 : 0);
    for (let i = 0; i <= ht; i++) v.disque(-0.5 + dx, haut + 1 + i, -0.5 + i * 0.25, 1.3, i === ht || i === 3 ? ROUILLE : METAL_CLAIR);
    v.disque(-0.5 + dx, haut + 1 + ht, -0.5 + ht * 0.25, 0.7, TROU);
  }
  piques(v, 4, haut - 2);
  drapeau(v, -4, 3, haut + 2, 5);
  for (const [x, z] of [[-4, -4], [2, -4]] as const) v.boite(x, haut + 1, z, x + 1, haut + 1, z + 1, TOURBE);
}

/** Glu : un tonneau de glu à l'arrière, le tube et le fût dégoulinants. */
function glu(v: Voxels): void {
  mortier(v, 3);
  v.cylindre(-3, -3, 6, 10, 1.8, BOIS);
  v.peindre((x, y, z, c) => c === BOIS && y > 6 && y < 10 && y % 2 === 0, METAL);
  v.disque(-3, 10, -3, 1.4, GLU);
  v.peindre((x, y, z, c) => c === TROU && y > 10, GLU);
  // Coulures : sur le tube et le long du fût, côté caméra.
  v.peindre((x, y, z, c) => (c === METAL_CLAIR || c === BOIS || c === BOIS_SOMBRE) && hachage(x, y, z) < 0.3 && z >= 1, GLU);
  // Le bord du tube et les créneaux nappés de glu : la couleur se voit de loin.
  v.peindre((x, y, z, c) => (c === ROUILLE || c === BOIS_BRULE) && y >= 6, GLU);
  v.peindre((x, y, z, c) => c === GLU && hachage(z, x, y) < 0.3, GLU_SOMBRE);
  v.boite(-5, 2, 4, -3, 2, 5, GLU);
}

/** Mitraille : faisceau de six canons fins à l'avant, bande de cartouches en laiton. */
function mitraille(v: Voxels): void {
  canon(v, 3);
  const yc = 8;
  v.boite(-2, yc - 2, 2, 1, yc + 1, 3, METAL_SOMBRE);
  for (const [x, y] of [[-2, yc - 2], [0, yc - 2], [-2, yc], [0, yc], [-1, yc + 1], [-1, yc - 3]] as const) {
    v.boite(x, y, 4, x, y, 8, METAL_CLAIR);
    v.poser(x, y, 8, TROU);
  }
  for (let i = 0; i < 6; i++) v.poser(2 + (i >> 1), yc - 3 - (i & 1), 2 + i, LAITON);
}

/** Gros calibre : un fût énorme à l'avant, cerclé de rouille, et un chapeau plus large. */
function grosCalibre(v: Voxels): void {
  canon(v, 3);
  const yc = 8;
  v.boite(-3, yc - 3, 1, 2, yc + 2, 9, METAL);
  v.peindre((x, y, z, c) => c === METAL && (z === 4 || z === 8) && y >= yc - 3, ROUILLE);
  v.boite(-2, yc - 2, 9, 1, yc + 1, 9, TROU);
  v.boite(-3, yc - 4, 2, 2, yc - 4, 6, METAL_SOMBRE);
  v.disque(-0.5, 15, -0.5, 6.2, CHAPEAU);
  v.peindre((x, y, z, c) => c === CHAPEAU && y === 15 && hachage(x, y, z) < 0.2, POIS);
}

const CAPACITES_VOXELS: Record<Capacite, (v: Voxels) => void> = { essaim, dard, tempete, prisme, salve, glu, mitraille, grosCalibre };

/** `stade` de 1 à 3 ; au stade 4, le modèle de la capacité. */
export function fortin(type: TypeTour, stade: number, capacite: Capacite | null = null): Voxels {
  const v = new Voxels();
  socle(v);
  if (stade >= 4 && capacite) CAPACITES_VOXELS[capacite](v);
  else ({ ruche, cristal, mortier, canon })[type](v, Math.min(3, stade));
  return v;
}
