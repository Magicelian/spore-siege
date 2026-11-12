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

const modeles = new Map<string, Modele>();
function modeleTour(type: TypeTour, stade: number): Modele {
  const cle = `${type}${stade}`;
  let m = modeles.get(cle);
  if (!m) modeles.set(cle, (m = tour(type, stade).modele(false)));
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

export interface Pose {
  type: TypeTour;
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
  private readonly portee = anneau(0xffffff, 0.7);
  private fantome: { maillage: THREE.Mesh; cle: string } | null = null;
  private readonly v = new THREE.Vector3();

  constructor() {
    this.portee.visible = false;
    this.groupe.add(this.portee);
  }

  /**
   * `selection` : tour dont on montre la portée ; `pose` : tour fantôme sous la souris.
   * `alpha` de 0 (précédent) à 1 (actuel), comme pour les monstres.
   */
  afficher(ile: Ile, precedent: Instantane | null, actuel: Instantane, alpha: number, selection: number | null, pose: Pose | null): void {
    this.afficherTours(ile, actuel);
    this.afficherProjectiles(ile, precedent, actuel, alpha);
    this.afficherImpacts(ile, actuel, alpha);
    this.afficherEclairs(ile, actuel);
    this.afficherPortee(ile, actuel, selection, pose);
    this.afficherFantome(ile, pose);
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
    this.portee.visible = !!cible;
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
