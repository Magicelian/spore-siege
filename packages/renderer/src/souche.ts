// Souche à défendre, au centre de l'île.
import * as THREE from 'three';
import type { Ile } from '@spore-siege/engine';
import { modeleSouche } from './modeles';
import { versMonde } from './repere';

export class SoucheRendu {
  readonly groupe = new THREE.Group();
  private maillage: THREE.Mesh | null = null;
  private taille = 0;
  /** Voile rouge par-dessus la souche, le temps d'une morsure. */
  private readonly flash = new THREE.MeshBasicMaterial({
    color: 0xff3020,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  private voile: THREE.Mesh | null = null;
  private mordueA = -Infinity;

  changerIle(ile: Ile): void {
    if (ile.tailleSouche !== this.taille) {
      this.taille = ile.tailleSouche;
      if (this.maillage) this.groupe.remove(this.maillage);
      const modele = modeleSouche(ile.tailleSouche);
      this.maillage = new THREE.Mesh(modele.geometrie, modele.materiaux);
      this.maillage.castShadow = this.maillage.receiveShadow = true;
      this.groupe.add(this.maillage);
      if (this.voile) this.groupe.remove(this.voile);
      this.voile = new THREE.Mesh(modele.geometrie, this.flash);
      this.groupe.add(this.voile);
    }
    const milieu = ile.tailleSouche / 2;
    versMonde({ x: ile.souche.x + milieu, y: ile.souche.y + milieu }, ile, this.groupe.position);
  }

  /** `instant` en ms. */
  mordre(instant: number): void {
    this.mordueA = instant;
  }

  /** Tremble et rougit pendant 0,35 s après une morsure. */
  animer(instant: number): void {
    const k = Math.max(0, 1 - (instant - this.mordueA) / 350);
    const amplitude = 0.07 * k;
    this.maillage?.position.set(Math.sin(instant / 18) * amplitude, 0, Math.cos(instant / 23) * amplitude);
    if (this.maillage && this.voile) this.voile.position.copy(this.maillage.position);
    this.flash.opacity = 0.55 * k;
    if (this.voile) this.voile.visible = k > 0;
  }
}
