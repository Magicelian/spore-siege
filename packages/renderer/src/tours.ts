// Tours, projectiles, explosions et éclairs. Modèles provisoires en voxels (les vrais, 3 stades soignés,
// viendront à l'étape 6) : chaque stade est plus haut et plus hérissé que le précédent.
import * as THREE from 'three';
import type { Case, Ile, Instantane, TypeTour } from '@spore-siege/engine';
import { centreCase, versMonde } from './repere';
import { Voxels, type Modele } from './voxels';

const BOIS = 0x6b4a2f;
const PIERRE = 0x8a8478;
const COULEURS: Record<TypeTour, { corps: number; vif: number }> = {
  ruche: { corps: 0xd9a03a, vif: 0x6b4a2f },
  cristal: { corps: 0x7fd8e8, vif: 0xb7f2ff },
  mortier: { corps: 0x5a4632, vif: 0x8fa04a },
  canon: { corps: 0xc8403a, vif: 0xf3e6c8 },
};

/** Socle commun, puis la silhouette propre à chaque tour ; `stade` de 1 à 3. */
function tour(type: TypeTour, stade: number): Voxels {
  const { corps, vif } = COULEURS[type];
  const v = new Voxels().boite(-5, 0, -5, 4, 1, 4, PIERRE);
  const h = 4 + stade * 3;
  switch (type) {
    case 'ruche':
      for (let i = 0; i < stade + 1; i++) v.cylindre(-0.5, -0.5, 2 + i * 3, 4 + i * 3, 4 - i * 0.5, i % 2 ? vif : corps);
      v.boite(-1, 3, 3, 0, 4, 4, 0x2a1d12);
      break;
    case 'cristal':
      v.cylindre(-0.5, -0.5, 2, 4, 3, PIERRE);
      v.cylindre(-0.5, -0.5, 4, 4 + h, 2, corps, 0.5);
      if (stade >= 2) v.cylindre(-3, 1, 4, 6 + stade, 1, vif, 0.3);
      if (stade >= 3) v.cylindre(2, -2, 4, 9, 1, vif, 0.3);
      break;
    case 'mortier':
      v.cylindre(-0.5, -0.5, 2, 3 + stade * 2, 4, corps, 3.5);
      v.disque(-0.5, 3 + stade * 2, -0.5, 2.5, 0x2a1d12);
      v.boite(-5, 2, -5, 4, 2, 4, vif);
      break;
    case 'canon':
      v.cylindre(-0.5, -0.5, 2, 2 + h - 2, 1.6, vif);
      v.dome(-0.5, -0.5, 2 + h - 2, 3.5 + stade * 0.5, 3, corps);
      v.peindre((x, y, z, c) => c === corps && (x * 7 + z * 13 + y) % 5 === 0, vif);
      break;
  }
  // Épines du dernier stade : la tour se hérisse.
  if (stade >= 3) for (const [x, z] of [[-5, -5], [4, -5], [-5, 4], [4, 4]] as const) v.boite(x, 2, z, x, 4, z, BOIS);
  return v;
}

/** Ronce : buisson de tiges épineuses qui barre le sentier, quelques baies. */
function ronce(): Voxels {
  const v = new Voxels();
  const tiges = 0x3f5a2a;
  const epines = 0x8a6a3a;
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    const r = 1.5 + (i % 3) * 1.4;
    v.boule(Math.cos(a) * r - 0.5, 2 + (i % 4), Math.sin(a) * r - 0.5, 2.2, 1.8, 2.2, i % 2 ? tiges : 0x4f6e30);
  }
  v.peindre((x, y, z, c) => c === tiges && Math.abs(Math.sin(x * 12.9 + y * 78.2 + z * 37.7) * 43758.5) % 1 < 0.2, epines);
  for (const [x, y, z] of [[3, 5, 0], [-3, 4, 2], [0, 6, -3]] as const) v.poser(x, y, z, 0x7a2a4a);
  return v;
}

const modeles = new Map<string, Modele>();
export function modeleTour(type: TypeTour | 'ronce', stade: number): Modele {
  const cle = `${type}${stade}`;
  let m = modeles.get(cle);
  if (!m) modeles.set(cle, (m = (type === 'ronce' ? ronce() : tour(type, stade)).modele(false)));
  return m;
}

/** Copie transparente des matériaux, pour la tour fantôme qu'on s'apprête à poser. */
function fantome(modele: Modele): THREE.Material[] {
  return modele.materiaux.map((m) => {
    const copie = m.clone();
    copie.transparent = true;
    copie.opacity = 0.55;
    copie.depthWrite = false;
    return copie;
  });
}

const PROJECTILES: Record<TypeTour, { couleur: number; taille: number }> = {
  ruche: { couleur: 0xffd54a, taille: 0.1 },
  cristal: { couleur: 0xb7f2ff, taille: 0.1 },
  mortier: { couleur: 0x4a3626, taille: 0.2 },
  canon: { couleur: 0xf3e6c8, taille: 0.16 },
};

/** Cercle plat au ras du sol (portée, explosions). */
function anneau(couleur: number, opacite: number): THREE.Mesh {
  const g = new THREE.RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color: couleur, transparent: true, opacity: opacite, depthWrite: false });
  return new THREE.Mesh(g, m);
}

/** Ce que la souris peut cliquer : une case libre (carré vert au sol) ou une tour, une ronce (boîte claire). */
export interface Marque {
  case: Case;
  sorte: 'case' | 'boite';
  hauteur: number;
}

const SOL = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const BOITE = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);

export interface Pose {
  type: TypeTour | 'ronce';
  case: Case;
  possible: boolean;
  portee: number;
}

export class ToursRendu {
  readonly groupe = new THREE.Group();
  private readonly tours = new Map<number, { maillage: THREE.Mesh; cle: string }>();
  private readonly projectiles = new Map<number, THREE.Mesh>();
  private readonly impacts: THREE.Mesh[] = [];
  private readonly eclairs = new Map<number, THREE.Line>();
  private readonly ronces = new Map<string, THREE.Mesh>();
  private readonly portee = anneau(0xffffff, 0.7);
  private fantome: { maillage: THREE.Mesh; cle: string } | null = null;
  private readonly sol = new THREE.Mesh(SOL, new THREE.MeshBasicMaterial({ color: 0xb6ff5c, transparent: true, opacity: 0.6, depthWrite: false }));
  private readonly surlignage = new THREE.Group();
  private readonly v = new THREE.Vector3();

  constructor() {
    this.portee.visible = false;
    this.sol.visible = false;
    const clair = 0xfff4d8;
    this.surlignage.add(
      new THREE.Mesh(BOITE, new THREE.MeshBasicMaterial({ color: clair, transparent: true, opacity: 0.18, depthWrite: false })),
      new THREE.LineSegments(new THREE.EdgesGeometry(BOITE), new THREE.LineBasicMaterial({ color: clair, transparent: true, opacity: 0.9, depthWrite: false })),
    );
    this.surlignage.visible = false;
    this.groupe.add(this.portee, this.sol, this.surlignage);
  }

  /**
   * `selection` : tour dont on montre la portée ; `pose` : tour fantôme sous la souris.
   * `alpha` de 0 (précédent) à 1 (actuel), comme pour les monstres.
   */
  afficher(
    ile: Ile,
    precedent: Instantane | null,
    actuel: Instantane,
    alpha: number,
    selection: number | null,
    pose: Pose | null,
    marque: Marque | null = null,
  ): void {
    this.afficherMarque(ile, marque);
    this.afficherTours(ile, actuel);
    this.afficherRonces(ile, actuel);
    this.afficherProjectiles(ile, precedent, actuel, alpha);
    this.afficherImpacts(ile, actuel, alpha);
    this.afficherEclairs(ile, actuel);
    this.afficherPortee(ile, actuel, selection, pose);
    this.afficherFantome(ile, pose);
  }

  private afficherMarque(ile: Ile, marque: Marque | null): void {
    this.sol.visible = marque?.sorte === 'case';
    this.surlignage.visible = marque?.sorte === 'boite';
    if (!marque) return;
    if (marque.sorte === 'case') centreCase(marque.case.x, marque.case.y, ile, this.sol.position).setY(0.02);
    else {
      centreCase(marque.case.x, marque.case.y, ile, this.surlignage.position);
      this.surlignage.scale.set(1, marque.hauteur + 0.05, 1);
    }
  }

  private afficherTours(ile: Ile, vue: Instantane): void {
    const vus = new Set<number>();
    for (const t of vue.tours) {
      vus.add(t.id);
      const cle = `${t.type}${t.stade}`;
      let corps = this.tours.get(t.id);
      if (corps?.cle !== cle) {
        if (corps) this.groupe.remove(corps.maillage);
        const modele = modeleTour(t.type, t.stade);
        corps = { maillage: new THREE.Mesh(modele.geometrie, modele.materiaux), cle };
        corps.maillage.castShadow = corps.maillage.receiveShadow = true;
        centreCase(t.case.x, t.case.y, ile, corps.maillage.position);
        this.tours.set(t.id, corps);
        this.groupe.add(corps.maillage);
      }
    }
    for (const [id, corps] of this.tours) {
      if (vus.has(id)) continue;
      this.groupe.remove(corps.maillage);
      this.tours.delete(id);
    }
  }

  private afficherRonces(ile: Ile, vue: Instantane): void {
    const vues = new Set<string>();
    for (const c of vue.ronces) {
      const cle = `${c.x},${c.y}`;
      vues.add(cle);
      if (this.ronces.has(cle)) continue;
      const modele = modeleTour('ronce', 1);
      const maillage = new THREE.Mesh(modele.geometrie, modele.materiaux);
      maillage.castShadow = maillage.receiveShadow = true;
      centreCase(c.x, c.y, ile, maillage.position);
      this.ronces.set(cle, maillage);
      this.groupe.add(maillage);
    }
    for (const [cle, maillage] of this.ronces) {
      if (vues.has(cle)) continue;
      this.groupe.remove(maillage);
      this.ronces.delete(cle);
    }
  }

  private afficherProjectiles(ile: Ile, precedent: Instantane | null, actuel: Instantane, alpha: number): void {
    const anciens = new Map(precedent?.projectiles.map((p) => [p.id, p.position]));
    const vus = new Set<number>();
    for (const p of actuel.projectiles) {
      vus.add(p.id);
      let maillage = this.projectiles.get(p.id);
      if (!maillage) {
        const { couleur, taille } = PROJECTILES[p.type];
        maillage = new THREE.Mesh(new THREE.BoxGeometry(taille, taille, taille), new THREE.MeshBasicMaterial({ color: couleur }));
        this.projectiles.set(p.id, maillage);
        this.groupe.add(maillage);
      }
      const a = anciens.get(p.id) ?? p.position;
      versMonde({ x: a.x + (p.position.x - a.x) * alpha, y: a.y + (p.position.y - a.y) * alpha }, ile, maillage.position);
      maillage.position.y = 0.55;
    }
    for (const [id, maillage] of this.projectiles) {
      if (vus.has(id)) continue;
      this.groupe.remove(maillage);
      maillage.geometry.dispose();
      this.projectiles.delete(id);
    }
  }

  /** Explosions : un anneau qui s'élargit et s'efface en quelques pas. */
  private afficherImpacts(ile: Ile, vue: Instantane, alpha: number): void {
    while (this.impacts.length < vue.impacts.length) {
      const m = anneau(0xffffff, 1);
      this.impacts.push(m);
      this.groupe.add(m);
    }
    this.impacts.forEach((m, i) => {
      const impact = vue.impacts[i];
      m.visible = !!impact;
      if (!impact) return;
      const age = (vue.pas - impact.pas + alpha) / 8;
      versMonde(impact.position, ile, m.position).setY(0.04);
      m.scale.setScalar(impact.rayon * (0.4 + 0.6 * Math.min(1, age * 2)));
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.set(impact.type === 'mortier' ? 0x8fa04a : 0xf3e6c8);
      mat.opacity = Math.max(0, 1 - age);
    });
  }

  /** Éclair du cristal, visible quelques pas après le tir. */
  private afficherEclairs(ile: Ile, vue: Instantane): void {
    for (const t of vue.tours) {
      let ligne = this.eclairs.get(t.id);
      const visible = t.type === 'cristal' && t.dernierTir >= 0 && vue.pas - t.dernierTir < 4 && t.chaine.length > 1;
      if (!visible) {
        if (ligne) ligne.visible = false;
        continue;
      }
      if (!ligne) {
        ligne = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xdffaff }));
        this.eclairs.set(t.id, ligne);
        this.groupe.add(ligne);
      }
      const points = t.chaine.map((p, i) => versMonde(p, ile).setY(i === 0 ? 0.9 : 0.3));
      ligne.geometry.setFromPoints(points);
      ligne.visible = true;
    }
    for (const [id, ligne] of this.eclairs) {
      if (vue.tours.some((t) => t.id === id)) continue;
      this.groupe.remove(ligne);
      ligne.geometry.dispose();
      this.eclairs.delete(id);
    }
  }

  private afficherPortee(ile: Ile, vue: Instantane, selection: number | null, pose: Pose | null): void {
    const tour = vue.tours.find((t) => t.id === selection);
    const cible = pose ?? (tour && { case: tour.case, portee: tour.portee, possible: true });
    this.portee.visible = !!cible && cible.portee > 0;
    if (!cible) return;
    centreCase(cible.case.x, cible.case.y, ile, this.portee.position).setY(0.03);
    this.portee.scale.setScalar(cible.portee);
    (this.portee.material as THREE.MeshBasicMaterial).color.set(cible.possible ? 0xffffff : 0xff5a4a);
  }

  private afficherFantome(ile: Ile, pose: Pose | null): void {
    const cle = pose?.type ?? '';
    if (this.fantome?.cle !== cle) {
      if (this.fantome) this.groupe.remove(this.fantome.maillage);
      this.fantome = null;
      if (pose) {
        const modele = modeleTour(pose.type, 1);
        this.fantome = { maillage: new THREE.Mesh(modele.geometrie, fantome(modele)), cle };
        this.groupe.add(this.fantome.maillage);
      }
    }
    if (pose && this.fantome) {
      centreCase(pose.case.x, pose.case.y, ile, this.fantome.maillage.position);
      this.fantome.maillage.visible = pose.possible;
    }
  }
}

/** Case sous un point de l'écran (coordonnées normalisées −1..1), au niveau du sol ; null hors de l'île. */
export function caseSous(ndc: THREE.Vector2, camera: THREE.Camera, ile: Ile): Case | null {
  const rayon = new THREE.Raycaster();
  camera.updateMatrixWorld();
  rayon.setFromCamera(ndc, camera);
  const point = new THREE.Vector3();
  if (!rayon.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) return null;
  const x = Math.floor(point.x + ile.largeur / 2);
  const y = Math.floor(point.z + ile.profondeur / 2);
  return x >= 0 && y >= 0 && x < ile.largeur && y < ile.profondeur ? { x, y } : null;
}
