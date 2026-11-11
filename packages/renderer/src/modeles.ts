// Tous les modèles du jeu, en voxels. Repère : 12 voxels par case, x et z centrés sur -0,5
// (indices -6 à 5 pour une case), façade vers +z pour les bâtiments, regard vers +x pour les habitants.
import { CHAPEAUX, COULEURS } from './palette';
import { Voxels, type Modele } from './voxels';

const C = -0.5;

const TEINTES = {
  bois: 0x9c6b3f,
  boisClair: 0xc49262,
  boisFonce: 0x5e3b22,
  planche: 0xb07d4c,
  pierre: 0x9a9ea8,
  pierreFonce: 0x72767f,
  pied: 0xf2e6cf,
  lamelles: 0xd9c4a0,
  porte: 0x4e3020,
  fenetre: 0xffd36b,
  blanc: 0xfff8ea,
  baie: 0xd8335a,
  baieFoncee: 0x9c2244,
  orange: 0xf29a3a,
  jaune: 0xffd84a,
  rouille: 0x6b3a2a,
  metal: 0x4a4f5c,
  lilas: 0xe6d4ff,
  toile: 0xf5ecd6,
  mousseClaire: 0x6fc27a,
  fleur: 0xffe06b,
  suie: 0x3a302c,
  tourbe: 0x3b2a22,
  tourbeClaire: 0xa8805a,
  paille: 0xb8862e,
  rose: 0xf28cb8,
  abeille: 0x2a2224,
  terreau: 0x3a2f45,
  mycelium: 0xb8b0d8,
} as const;

/** Couleurs des fleurs de la prairie, tirées tour à tour. */
const PETALES = [TEINTES.jaune, TEINTES.rose, TEINTES.blanc, TEINTES.lilas] as const;

// ─── Morceaux réutilisés ───────────────────────────────────────────────────────

/** Taches claires sur un chapeau : on repeint les voxels de la couleur `fond` proches de points semés sur le dôme. */
function taches(v: Voxels, cx: number, cz: number, y0: number, rayon: number, hauteur: number, fond: number, couleur: number, nombre = 6, decalage = 0): void {
  const centres: [number, number, number][] = [];
  for (let i = 0; i < nombre; i++) {
    const a = decalage + i * 2.39996;
    const e = 0.25 + ((i * 0.37) % 0.55);
    centres.push([cx + rayon * Math.cos(e) * Math.cos(a), y0 + hauteur * Math.sin(e) * 1.05, cz + rayon * Math.cos(e) * Math.sin(a)]);
  }
  const taille = Math.max(0.9, rayon / 5);
  v.peindre((x, y, z, c) => c === fond && centres.some(([px, py, pz]) => (x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2 < taille * taille * 1.3), couleur);
}

/** Chapeau de champignon : dôme, lamelles dessous, taches. */
function chapeau(v: Voxels, cx: number, cz: number, y0: number, rayon: number, hauteur: number, couleur: number, tache: number | null, nombre = 6): void {
  v.dome(cx, cz, y0, rayon, hauteur, couleur);
  v.disque(cx, y0, cz, rayon - 1.2, TEINTES.lamelles);
  if (tache !== null) taches(v, cx, cz, y0, rayon, hauteur, couleur, tache, nombre);
}

/** Pied de champignon habitable, avec une porte en façade (+z) et des fenêtres. */
function pied(v: Voxels, cx: number, cz: number, y0: number, y1: number, rayon: number, fenetres: number[] = []): void {
  v.cylindre(cx, cz, y0, y1, rayon + 0.4, TEINTES.pied, rayon);
  // Base ombrée.
  v.peindre((_, y, __, c) => c === TEINTES.pied && y === y0, TEINTES.lamelles);
  const avant = Math.round(cz + rayon);
  const gauche = Math.floor(cx);
  v.boite(gauche, y0, avant - 1, gauche + 1, y0 + 2, avant + 1, null);
  v.boite(gauche, y0, avant - 1, gauche + 1, y0 + 2, avant - 1, TEINTES.porte);
  v.poser(gauche + 1, y0 + 1, avant - 1, TEINTES.fenetre);
  for (const y of fenetres) {
    v.poser(Math.round(cx + rayon), y, Math.floor(cz), TEINTES.fenetre);
    v.poser(Math.floor(cx - rayon), y, Math.floor(cz), TEINTES.fenetre);
  }
}

/** Bûche couchée le long de x, extrémités claires. */
function buche(v: Voxels, x0: number, x1: number, y: number, z: number, r: number, couleur: number = TEINTES.bois): void {
  for (let x = x0; x <= x1; x++) {
    const bout = x === x0 || x === x1;
    for (let dy = -Math.ceil(r); dy <= Math.ceil(r); dy++)
      for (let dz = -Math.ceil(r); dz <= Math.ceil(r); dz++) {
        if (dy * dy + dz * dz > r * r + 0.3) continue;
        v.poser(x, Math.round(y + dy), Math.round(z + dz), bout ? TEINTES.boisClair : couleur);
      }
  }
}

function poteau(v: Voxels, x: number, z: number, y0: number, y1: number, couleur: number = TEINTES.boisFonce): void {
  v.boite(x, y0, z, x, y1, z, couleur);
}

// ─── Souche-dépôt ──────────────────────────────────────────────────────────────
/** Petit champignon luisant : pied pâle, chapeau en croix, une bosse au sommet des plus grands. */
function luisant(v: Voxels, x: number, y0: number, z: number, hauteur: number): void {
  const l = COULEURS.luisant;
  v.boite(x, y0, z, x, y0 + hauteur - 1, z, COULEURS.piedLuisant);
  const h = y0 + hauteur;
  v.poser(x, h, z, l).poser(x + 1, h, z, l).poser(x - 1, h, z, l).poser(x, h, z + 1, l).poser(x, h, z - 1, l);
  if (hauteur >= 4) v.poser(x, h + 1, z, l);
}


/** Souche à la taille de son emprise (en cases), centrée. */
export function modeleSouche(tailleCases: number): Modele {
  const v = new Voxels();
  const r = tailleCases * 12 * 0.34;
  v.cylindre(C, C, 0, 8, r + 1.2, COULEURS.tronc, r);
  v.peindre((x, y, z, c) => c === COULEURS.tronc && (Math.round(Math.atan2(z - C, x - C) * 5) + y) % 5 === 0, TEINTES.boisFonce);
  v.disque(C, 8, C, r - 0.8, COULEURS.cerne);
  for (const rayon of [r * 0.3, r * 0.62]) {
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      v.poser(Math.round(C + Math.cos(t) * rayon), 8, Math.round(C + Math.sin(t) * rayon), TEINTES.bois);
    }
  }
  // Racines.
  for (let i = 0; i < 5; i++) {
    const t = i * 1.33 + 0.4;
    for (let d = r; d < r + 4; d++) {
      const h = Math.max(0, Math.round((r + 3 - d) * 0.8));
      const x = Math.round(C + Math.cos(t) * d);
      const z = Math.round(C + Math.sin(t) * d);
      v.boite(x, 0, z, x, h, z, COULEURS.tronc);
    }
  }
  // Deux champignons sur le flanc, pour signaler le dépôt.
  const a = 0.8;
  const x0 = C + Math.cos(a) * (r + 1.5);
  const z0 = C + Math.sin(a) * (r + 1.5);
  v.cylindre(x0, z0, 0, 2, 0.7, TEINTES.pied);
  chapeau(v, x0, z0, 3, 1.8, 1, CHAPEAUX[0], TEINTES.blanc, 3);
  v.cylindre(x0 + 2.5, z0 - 1.5, 0, 1, 0.5, TEINTES.pied);
  v.dome(x0 + 2.5, z0 - 1.5, 2, 1.3, 1, CHAPEAUX[1]);
  return v.modele();
}

// ─── Décor et éléments ─────────────────────────────────────────────────────────

export type Decor = 'arbre' | 'roseau' | 'fleur' | 'luisant' | 'chene' | 'buisson' | 'caillou' | 'nenuphar';
let cacheDecor: Record<Decor, Modele> | null = null;

/** Arbre, roseaux, fleurs, luisants, vieux chêne, buisson sauvage, rocher et nénuphar, posés en instances sur le terrain. */
export function modelesDecor(): Record<Decor, Modele> {
  if (cacheDecor) return cacheDecor;
  const arbre = new Voxels();
  arbre.boite(-1, 0, -1, 0, 4, 0, COULEURS.tronc);
  for (const [y0, r0] of [[3, 5.2], [7, 4], [10, 2.8]] as const) {
    arbre.cylindre(C, C, y0, y0 + 4, r0, COULEURS.feuillage, 0.8);
  }
  arbre.poser(-1, 15, -1, COULEURS.feuillage);
  const buisson = new Voxels();
  buisson.boule(C, 2.5, C, 4.5, 3.2, 4.2, COULEURS.buisson);
  buisson.boule(2, 3.5, 1, 2.5, 2.2, 2.5, COULEURS.buisson);
  buisson.boite(-6, 0, -6, 5, -1, 5, null);
  const caillou = new Voxels();
  caillou.boule(C, 1.5, C, 4.5, 3.5, 4, COULEURS.caillou);
  caillou.boule(2.5, 1, 2, 2.5, 2, 2.5, COULEURS.caillou);
  caillou.peindre((x, y, z) => y <= 0 || (x * 3 + z * 5 + y) % 7 === 0, COULEURS.roche);
  caillou.boite(-7, -1, -7, 6, -1, 6, null);
  // Touffe de roseaux : tiges de hauteurs variées, massette brune au bout des plus hautes.
  const roseau = new Voxels();
  const tiges: [number, number, number][] = [[-4, -2, 9], [-2, 1, 12], [0, -4, 10], [1, 2, 13], [3, -1, 8], [-1, 4, 7], [2, -5, 11], [-5, 3, 6]];
  for (const [x, z, h] of tiges) {
    roseau.boite(x, 0, z, x, h, z, COULEURS.roseau);
    if (h >= 9) roseau.boite(x, h + 1, z, x, h + 3, z, COULEURS.massette);
  }
  // Feuille de nénuphar à fleur d'eau, entaillée, avec sa fleur.
  const nenuphar = new Voxels();
  nenuphar.disque(C, 0, C, 3.4, COULEURS.nenuphar);
  nenuphar.boite(0, 0, 0, 3, 0, 0, null);
  nenuphar.poser(-2, 1, -1, COULEURS.fleurNenuphar).poser(-1, 1, -1, COULEURS.fleurNenuphar).poser(-2, 1, -2, COULEURS.fleurNenuphar);
  nenuphar.poser(-2, 2, -2, TEINTES.jaune);
  // Touffe de fleurs des champs : tiges courtes, corolles de quatre couleurs, quelques feuilles.
  const fleur = new Voxels();
  const corolles: [number, number, number][] = [[-4, -3, 4], [-1, 2, 6], [2, -4, 5], [3, 2, 3], [-3, 3, 5], [0, -1, 7], [4, -1, 4], [-5, 0, 3], [1, 4, 4]];
  corolles.forEach(([x, z, h], i) => {
    fleur.boite(x, 0, z, x, h - 1, z, COULEURS.tige);
    const petale = PETALES[i % PETALES.length]!;
    fleur.poser(x, h, z, i % 2 === 0 ? TEINTES.orange : petale).poser(x + 1, h, z, petale).poser(x - 1, h, z, petale);
    fleur.poser(x, h, z + 1, petale).poser(x, h, z - 1, petale);
  });
  fleur.poser(-2, 1, -1, COULEURS.tige).poser(2, 1, 0, COULEURS.tige).poser(0, 1, 3, COULEURS.tige);
  // Touffe de champignons luisants de la grotte : jamais sous la neige, pour qu'ils brillent aussi l'hiver.
  const luisants = new Voxels();
  for (const [x, z, h] of [[-3, -2, 3], [0, 1, 5], [2, -3, 2], [-1, -4, 4], [3, 2, 3], [-4, 3, 2], [1, 4, 2]] as const) luisant(luisants, x, 0, z, h);
  // Vieux chêne de la futaie : tronc épais aux racines saillantes, large couronne en trois touffes.
  const chene = new Voxels();
  chene.cylindre(C, C, 0, 7, 2.2, COULEURS.troncChene);
  for (const [x, z] of [[-3, -1], [2, -1], [-1, -3], [-1, 2]] as const) chene.poser(x, 0, z, COULEURS.troncChene);
  chene.boite(1, 7, -1, 3, 8, 0, COULEURS.troncChene);
  chene.boule(C, 11, C, 6, 3.6, 6, COULEURS.feuillageChene);
  chene.boule(2.5, 13, 1, 3.6, 2.8, 3.6, COULEURS.feuillageChene);
  chene.boule(-3, 13.5, -2, 3.2, 2.6, 3.2, COULEURS.feuillageChene);
  chene.peindre((x, y, z, c) => c === COULEURS.feuillageChene && (x * 5 + y * 3 + z * 7) % 6 === 0, COULEURS.feuillageCheneClair);
  cacheDecor = {
    arbre: arbre.modele(),
    roseau: roseau.modele(),
    fleur: fleur.modele(),
    luisant: luisants.modele(false),
    chene: chene.modele(),
    buisson: buisson.modele(),
    caillou: caillou.modele(),
    nenuphar: nenuphar.modele(false),
  };
  return cacheDecor;
}
