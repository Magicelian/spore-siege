// Rendu de l'île : scène Three.js pixelisée, dans le style de Tiny Shrooms.
import * as THREE from 'three';
import type { Case, Ile, Instantane } from '@spore-siege/engine';
import { CameraIso } from './camera';
import { construireIle } from './ile';
import { MonstresRendu } from './monstres';
import { Pixelisation } from './pixelisation';
import { SoucheRendu } from './souche';
import { caseSous, ToursRendu, type Marque, type Pose } from './tours';
import { Vignettes } from './vignettes';

export type { Marque, Pose } from './tours';

export const IMAGES_PAR_SECONDE = 60;
/** Facteur de réduction de la résolution de rendu par rapport à la fenêtre, à l'échelle 1. */
export const REDUCTION = 2;
/** Côté de fenêtre pour lequel le jeu est dessiné ; au-delà, les pixels grossissent d'autant. */
export const TAILLE_BASE = 480;

/** Grossissement de l'affichage : une fenêtre plus grande ne montre pas plus d'île, elle la dessine plus gros. */
export function echelleAffichage(): number {
  return Math.max(1, Math.min(window.innerWidth, window.innerHeight) / TAILLE_BASE);
}

export class Rendu {
  readonly canevas: HTMLCanvasElement;
  /** Nombre d'images dessinées depuis la création, pour mesurer la cadence. */
  images = 0;

  private readonly moteur: THREE.WebGLRenderer;
  /** Images des tours pour l'interface. */
  readonly vignettes: Vignettes;
  private readonly scene = new THREE.Scene();
  private readonly vue = new CameraIso();
  private readonly pixelisation: Pixelisation;
  private readonly souche = new SoucheRendu();
  private readonly monstres = new MonstresRendu();
  private readonly tours = new ToursRendu();
  private ile: Ile | null = null;
  /** Appelé avant chaque image, avec l'instant en millisecondes : c'est là que le frontend fait tourner le moteur. */
  surImage: ((instant: number) => void) | null = null;
  private decor: THREE.Group | null = null;
  private actif = false;
  private derniereImage = 0;

  constructor(conteneur: HTMLElement) {
    this.moteur = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    this.moteur.setPixelRatio(1);
    this.moteur.setClearColor(0x000000, 0);
    this.moteur.shadowMap.enabled = true;
    this.moteur.shadowMap.type = THREE.BasicShadowMap;
    this.canevas = this.moteur.domElement;
    conteneur.prepend(this.canevas);

    this.pixelisation = new Pixelisation(this.moteur);
    this.vignettes = new Vignettes(this.moteur);
    const ciel = new THREE.HemisphereLight(0xfff4e0, 0x5a4a6a, 1.2);
    const soleil = new THREE.DirectionalLight(0xfff0d0, 2.2);
    soleil.position.set(6, 12, 4);
    soleil.castShadow = true;
    soleil.shadow.mapSize.set(1024, 1024);
    soleil.shadow.bias = -0.002;
    Object.assign(soleil.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 50 });
    this.scene.add(ciel, soleil, this.souche.groupe, this.monstres.groupe, this.tours.groupe);
    this.redimensionner();
  }

  appliquerIle(ile: Ile): void {
    if (this.decor) this.scene.remove(this.decor);
    this.decor = construireIle(ile);
    this.scene.add(this.decor);
    this.souche.changerIle(ile);
    this.ile = ile;
    this.vue.cadrer(ile.largeur, ile.profondeur);
  }

  /**
   * Montre la partie entre deux pas du moteur ; `alpha` de 0 (précédent) à 1 (actuel).
   * `selection` : tour dont on montre la portée ; `pose` : tour fantôme à l'endroit visé.
   */
  afficherPartie(
    precedent: Instantane | null,
    actuel: Instantane,
    alpha: number,
    selection: number | null = null,
    pose: Pose | null = null,
    marque: Marque | null = null,
  ): void {
    if (!this.ile) return;
    this.monstres.afficher(this.ile, precedent, actuel, alpha, performance.now());
    this.tours.afficher(this.ile, precedent, actuel, alpha, selection, pose, marque);
  }

  /** Case de l'île sous un point de la fenêtre (pixels CSS), ou null. */
  caseSous(clientX: number, clientY: number): Case | null {
    if (!this.ile) return null;
    const r = this.canevas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    return caseSous(ndc, this.vue.camera, this.ile);
  }

  tourner(sens: 1 | -1): void {
    this.vue.tourner(sens);
  }

  zoomer(sens: 1 | -1): void {
    this.vue.zoomer(sens);
  }

  /** Déplace la vue pour suivre la souris, `dx`, `dy` en pixels CSS. */
  glisser(dx: number, dy: number): void {
    this.vue.glisser(dx, dy, window.innerHeight);
  }

  redimensionner(): void {
    const reduction = REDUCTION * echelleAffichage();
    const largeur = Math.max(1, Math.ceil(window.innerWidth / reduction));
    const hauteur = Math.max(1, Math.ceil(window.innerHeight / reduction));
    this.moteur.setSize(largeur, hauteur, false);
    this.pixelisation.redimensionner(largeur, hauteur);
    this.vue.redimensionner(largeur / hauteur);
  }

  demarrer(): void {
    if (this.actif) return;
    this.actif = true;
    this.derniereImage = 0;
    requestAnimationFrame(this.boucle);
  }

  arreter(): void {
    this.actif = false;
  }

  private readonly boucle = (instant: number): void => {
    if (!this.actif) return;
    requestAnimationFrame(this.boucle);
    const ecart = instant - this.derniereImage;
    if (ecart < 1000 / IMAGES_PAR_SECONDE - 2) return;
    const dt = this.derniereImage === 0 ? 0 : ecart / 1000;
    this.derniereImage = instant;
    this.surImage?.(instant);
    this.vue.animer(dt);
    this.pixelisation.rendre(this.scene, this.vue.camera, []);
    this.images++;
  };
}
