// Tours, projectiles, explosions et éclairs. Modèles des tours dans `fortins.ts`.
import * as THREE from 'three';
import type { Case, ImpactVu, Ile, Instantane, ProjectileVu, TypeTour } from '@spore-siege/engine';
import { Eclats } from './effets';
import { centreCase, versMonde } from './repere';
import { fortin } from './fortins';
import { Voxels, type Modele } from './voxels';

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
  if (!m) modeles.set(cle, (m = (type === 'ronce' ? ronce() : fortin(type, stade)).modele(false)));
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

/**
 * Projectiles dessinés par-dessus tout, à taille fixe à l'écran (en pixels de l'image) pour rester lisibles
 * en vue dézoomée : un cœur coloré dans un cadre sombre, une traînée derrière. `arc` : hauteur de la cloche.
 */
const PROJECTILES: Record<TypeTour, { couleur: number; cote: number; arc: number }> = {
  ruche: { couleur: 0xffd54a, cote: 2, arc: 0 },
  cristal: { couleur: 0xb7f2ff, cote: 2, arc: 0 },
  mortier: { couleur: 0x8fa04a, cote: 4, arc: 1.6 },
  canon: { couleur: 0xf3e6c8, cote: 3, arc: 0.7 },
};
const sansProfondeur = { depthTest: false, depthWrite: false } as const;
const CADRE = new THREE.SpriteMaterial({ color: 0x1a120c, ...sansProfondeur });
const COEURS = new Map<TypeTour, THREE.SpriteMaterial>();
const TRAINEES = new Map<TypeTour, THREE.SpriteMaterial>();
for (const [type, { couleur }] of Object.entries(PROJECTILES) as [TypeTour, { couleur: number }][]) {
  COEURS.set(type, new THREE.SpriteMaterial({ color: couleur, ...sansProfondeur }));
  TRAINEES.set(type, new THREE.SpriteMaterial({ color: couleur, transparent: true, opacity: 0.45, ...sansProfondeur }));
}
const ECLAIR = new THREE.LineBasicMaterial({ color: 0xffffff, ...sansProfondeur });
const HALO = new THREE.LineBasicMaterial({ color: 0x6fd6ea, ...sansProfondeur });

/** Gerbes : explosions, fumée du tir, tour vendue. */
const GERBE_IMPACT: Record<TypeTour, number[]> = {
  ruche: [0xffd54a],
  cristal: [0xb7f2ff],
  mortier: [0x4a3826, 0x7c8f3c, 0x8fa04a],
  canon: [0xf3e6c8, 0xc8403a, 0xe8d9b8],
};
const FUMEE = [0xd8d2c8, 0xb8b2a8];
const DEBRIS = [0x6b4a2f, 0x33241a, 0x5b5550, 0x7d776b];
/** Secondes. */
const DUREE_REBOND = 0.35;
const DUREE_RECUL = 0.15;

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

interface CorpsTour {
  maillage: THREE.Mesh;
  cle: string;
  /** Secondes : pose ou dernière amélioration, dernier tir vu. */
  poseA: number;
  tirA: number;
  dernierTir: number;
  hauteur: number;
}

export class ToursRendu {
  readonly groupe = new THREE.Group();
  /** Projectiles et éclairs : dessinés par-dessus l'île, sans contour (superposition). */
  readonly dessus = new THREE.Group();
  private readonly tours = new Map<number, CorpsTour>();
  private readonly projectiles = new Map<number, { cadre: THREE.Sprite; coeur: THREE.Sprite; trainee: THREE.Sprite }>();
  private readonly impacts: THREE.Mesh[] = [];
  private impactsVus = new Set<string>();
  private readonly eclats = new Eclats();
  private readonly eclairs = new Map<number, { coeur: THREE.Line; halo: THREE.Line }>();
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
    this.groupe.add(this.portee, this.sol, this.surlignage, this.eclats.groupe);
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
    instant = performance.now(),
    parPixel = 0.05,
  ): void {
    const t = instant / 1000;
    this.afficherMarque(ile, marque);
    this.afficherTours(ile, actuel, t);
    this.afficherRonces(ile, actuel);
    this.afficherProjectiles(ile, precedent, actuel, alpha, instant, parPixel);
    this.afficherImpacts(ile, actuel, alpha, t);
    this.afficherEclairs(ile, actuel, parPixel);
    this.eclats.animer(t);
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

  /** Pose et amélioration : la tour jaillit avec un rebond ; chaque tir la fait reculer ; vendue, elle s'effondre. */
  private afficherTours(ile: Ile, vue: Instantane, t: number): void {
    const vus = new Set<number>();
    for (const tv of vue.tours) {
      vus.add(tv.id);
      const cle = `${tv.type}${tv.stade}`;
      let corps = this.tours.get(tv.id);
      if (corps?.cle !== cle) {
        if (corps) this.groupe.remove(corps.maillage);
        const modele = modeleTour(tv.type, tv.stade);
        const maillage = new THREE.Mesh(modele.geometrie, modele.materiaux);
        maillage.castShadow = maillage.receiveShadow = true;
        centreCase(tv.case.x, tv.case.y, ile, maillage.position);
        corps = { maillage, cle, poseA: t, tirA: -Infinity, dernierTir: tv.dernierTir, hauteur: modele.hauteur };
        this.tours.set(tv.id, corps);
        this.groupe.add(maillage);
      }
      if (tv.dernierTir !== corps.dernierTir) {
        corps.dernierTir = tv.dernierTir;
        corps.tirA = t;
        if (tv.type === 'canon' || tv.type === 'mortier') {
          const p = corps.maillage.position;
          this.eclats.lancer(new THREE.Vector3(p.x, p.y + corps.hauteur, p.z), t, { couleurs: FUMEE, nombre: 4, taille: 0.09, force: 0.5, duree: 0.3 });
        }
      }
      const r = Math.min(1, (t - corps.poseA) / DUREE_REBOND);
      const rebond = r < 1 ? 1 - 0.35 * (1 - r) ** 2 * Math.cos(r * Math.PI * 2.5) : 1;
      const k = Math.min(1, (t - corps.tirA) / DUREE_RECUL);
      const recul = 1 - 0.08 * (1 - k);
      const sy = rebond * recul;
      corps.maillage.scale.set(1 - (sy - 1) * 0.5, sy, 1 - (sy - 1) * 0.5);
    }
    for (const [id, corps] of this.tours) {
      if (vus.has(id)) continue;
      this.groupe.remove(corps.maillage);
      this.tours.delete(id);
      const p = corps.maillage.position;
      this.eclats.lancer(new THREE.Vector3(p.x, p.y + 0.3, p.z), t, { couleurs: DEBRIS, nombre: 10, taille: 0.15, force: 1.2 });
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

  private afficherProjectiles(ile: Ile, precedent: Instantane | null, actuel: Instantane, alpha: number, instant: number, parPixel: number): void {
    const anciens = new Map(precedent?.projectiles.map((p) => [p.id, p.position]));
    const vus = new Set<number>();
    for (const p of actuel.projectiles) {
      vus.add(p.id);
      const { cote, arc } = PROJECTILES[p.type];
      let s = this.projectiles.get(p.id);
      if (!s) {
        s = { cadre: new THREE.Sprite(CADRE), coeur: new THREE.Sprite(COEURS.get(p.type)), trainee: new THREE.Sprite(TRAINEES.get(p.type)) };
        s.cadre.renderOrder = 1;
        s.coeur.renderOrder = 2;
        this.projectiles.set(p.id, s);
        this.dessus.add(s.trainee, s.cadre, s.coeur);
      }
      const a = anciens.get(p.id) ?? p.position;
      const ici = { x: a.x + (p.position.x - a.x) * alpha, y: a.y + (p.position.y - a.y) * alpha };
      // Un pas plus tôt : la traînée.
      const avant = { x: ici.x - (p.position.x - a.x), y: ici.y - (p.position.y - a.y) };
      versMonde(ici, ile, s.coeur.position).setY(this.hauteurTir(p, ici, instant));
      versMonde(avant, ile, s.trainee.position).setY(this.hauteurTir(p, avant, instant));
      s.cadre.position.copy(s.coeur.position);
      s.coeur.scale.set(cote * parPixel, cote * parPixel, 1);
      s.cadre.scale.set((cote + 2) * parPixel, (cote + 2) * parPixel, 1);
      s.trainee.scale.set(Math.max(1, cote - 1) * parPixel, Math.max(1, cote - 1) * parPixel, 1);
      s.trainee.visible = arc > 0 || p.type !== 'ruche';
    }
    for (const [id, s] of this.projectiles) {
      if (vus.has(id)) continue;
      this.dessus.remove(s.cadre, s.coeur, s.trainee);
      this.projectiles.delete(id);
    }
  }

  /** Obus en cloche entre la tour et le point visé ; abeille qui volette à hauteur fixe. */
  private hauteurTir(p: ProjectileVu, ici: { x: number; y: number }, instant: number): number {
    const { arc } = PROJECTILES[p.type];
    if (arc === 0) return 0.6 + Math.sin(instant / 45 + p.id) * 0.05;
    const total = Math.hypot(p.but.x - p.depart.x, p.but.y - p.depart.y);
    const fait = Math.hypot(ici.x - p.depart.x, ici.y - p.depart.y);
    const f = total > 0 ? Math.min(1, fait / total) : 1;
    // Part du haut de la tour (≈ 0,9) et retombe au sol.
    return 0.9 * (1 - f) + 0.15 * f + arc * 4 * f * (1 - f);
  }

  /** Explosions : un anneau qui s'élargit et s'efface en quelques pas. */
  private afficherImpacts(ile: Ile, vue: Instantane, alpha: number, t: number): void {
    const cle = (i: ImpactVu) => `${i.pas}:${i.position.x.toFixed(2)},${i.position.y.toFixed(2)}`;
    for (const i of vue.impacts) {
      if (this.impactsVus.has(cle(i))) continue;
      const depart = versMonde(i.position, ile).setY(0.15);
      this.eclats.lancer(depart, t, { couleurs: GERBE_IMPACT[i.type], nombre: 7, taille: 0.11, force: i.rayon * 1.6, duree: 0.4 });
    }
    this.impactsVus = new Set(vue.impacts.map(cle));
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

  /** Éclair du cristal, visible quelques pas après le tir : zigzag blanc doublé d'un halo cyan d'un pixel. */
  private afficherEclairs(ile: Ile, vue: Instantane, parPixel: number): void {
    for (const t of vue.tours) {
      let ligne = this.eclairs.get(t.id);
      const visible = t.type === 'cristal' && t.dernierTir >= 0 && vue.pas - t.dernierTir < 4 && t.chaine.length > 1;
      if (!visible) {
        if (ligne) ligne.coeur.visible = ligne.halo.visible = false;
        continue;
      }
      if (!ligne) {
        ligne = { coeur: new THREE.Line(new THREE.BufferGeometry(), ECLAIR), halo: new THREE.Line(new THREE.BufferGeometry(), HALO) };
        ligne.coeur.renderOrder = 2;
        this.eclairs.set(t.id, ligne);
        this.dessus.add(ligne.halo, ligne.coeur);
      }
      const sommets = t.chaine.map((p, i) => versMonde(p, ile).setY(i === 0 ? 1.1 : 0.3));
      const points: THREE.Vector3[] = [];
      sommets.forEach((p, i) => {
        if (i > 0) {
          const q = sommets[i - 1]!;
          // Trois coudes entre deux maillons, qui changent à chaque tir.
          for (let k = 1; k <= 3; k++) {
            const m = q.clone().lerp(p, k / 4);
            const g = Math.sin(t.dernierTir * 7.3 + i * 3.1 + k * 5.7) * 0.12;
            m.x += g;
            m.z -= g;
            m.y += Math.cos(t.dernierTir * 3.7 + k * 2.3) * 0.08;
            points.push(m);
          }
        }
        points.push(p);
      });
      ligne.coeur.geometry.setFromPoints(points);
      ligne.halo.geometry.setFromPoints(points.map((p) => p.clone().setY(p.y - parPixel)));
      ligne.coeur.visible = ligne.halo.visible = true;
    }
    for (const [id, ligne] of this.eclairs) {
      if (vue.tours.some((t) => t.id === id)) continue;
      this.dessus.remove(ligne.coeur, ligne.halo);
      ligne.coeur.geometry.dispose();
      ligne.halo.geometry.dispose();
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
