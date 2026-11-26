import * as THREE from 'three';
import type { Case, Ile } from '@tiny-siege/engine';
import { Eclats } from './effets';
import type { PlateformeVue } from './ile';
import { modelesDecor } from './modeles';
import { COULEURS } from './palette';
import { centreCase, HAUTEUR_PLATEFORME } from './repere';

/** Secondes : l'arbre bascule puis s'écrase. */
const DUREE_CHUTE = 0.7;
const CACHE = new THREE.Matrix4().makeScale(0, 0, 0);

interface Chute {
  maillage: THREE.Mesh;
  debut: number;
  axe: THREE.Vector3;
  pivot: THREE.Vector3;
  base: THREE.Matrix4;
  ecrase: boolean;
}

/**
 * Plateformes de la futaie abattues par le Colosse d'écorce : l'arbre caché dans le décor est remplacé par une copie
 * qui bascule et s'écrase dans une gerbe de planches, puis par un chicot.
 */
export class ChutesRendu {
  readonly groupe = new THREE.Group();
  private readonly eclats = new Eclats();
  private decor: THREE.Group | null = null;
  /** Cases abattues (clé `x,y`) et leur chicot. */
  private abattues = new Map<string, THREE.Mesh>();
  private chutes: Chute[] = [];

  constructor() {
    this.groupe.add(this.eclats.groupe);
  }

  /** `instant` en millisecondes. */
  afficher(decor: THREE.Group, ile: Ile, tombees: Case[], instant: number): void {
    const t = instant / 1000;
    if (decor !== this.decor) this.oublier(decor);
    const plateformes = decor.userData.plateformes as Map<string, PlateformeVue> | undefined;
    if (!plateformes) return;
    const voulues = new Set(tombees.map((c) => `${c.x},${c.y}`));
    // Nouvelle partie : les arbres reviennent.
    for (const [cle, chicot] of this.abattues) {
      if (voulues.has(cle)) continue;
      const p = plateformes.get(cle);
      if (p) this.montrer(p, p.matrice);
      this.groupe.remove(chicot);
      this.abattues.delete(cle);
    }
    for (const cle of voulues) {
      if (this.abattues.has(cle)) continue;
      const p = plateformes.get(cle);
      if (!p) continue;
      this.montrer(p, CACHE);
      const [x, y] = cle.split(',').map(Number) as [number, number];
      const centre = centreCase(x, y, ile, new THREE.Vector3());
      const chicot = new THREE.Mesh(modelesDecor().chicot.geometrie, modelesDecor().chicot.materiaux);
      chicot.position.copy(centre);
      chicot.castShadow = true;
      this.groupe.add(chicot);
      this.abattues.set(cle, chicot);
      // La copie bascule autour de sa base, vers un côté tiré de la case.
      const copie = new THREE.Mesh(p.maillage.geometry, p.maillage.material);
      copie.castShadow = true;
      copie.matrixAutoUpdate = false;
      copie.matrix.copy(p.matrice);
      this.groupe.add(copie);
      const a = ((x * 7 + y * 13) % 8) * (Math.PI / 4);
      this.chutes.push({ maillage: copie, debut: t, axe: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)), pivot: centre, base: p.matrice.clone(), ecrase: false });
    }
    this.animer(t);
  }

  private animer(t: number): void {
    const rotation = new THREE.Matrix4();
    const aller = new THREE.Matrix4();
    const retour = new THREE.Matrix4();
    this.chutes = this.chutes.filter((c) => {
      const d = (t - c.debut) / DUREE_CHUTE;
      if (d >= 1.4) {
        this.groupe.remove(c.maillage);
        return false;
      }
      // Bascule de plus en plus vite (pesanteur), puis s'enfonce un peu en s'écrasant.
      const k = Math.min(1, d);
      rotation.makeRotationAxis(c.axe, k * k * (Math.PI / 2) * 0.95);
      aller.makeTranslation(c.pivot.x, c.pivot.y - Math.max(0, d - 1) * 1.5, c.pivot.z);
      retour.makeTranslation(-c.pivot.x, -c.pivot.y, -c.pivot.z);
      c.maillage.matrix.copy(aller).multiply(rotation).multiply(retour).multiply(c.base);
      if (d >= 1 && !c.ecrase) {
        c.ecrase = true;
        // Le plancher touche le sol à une hauteur d'arbre du pied, du côté où il tombe.
        const sol = c.pivot.clone().add(new THREE.Vector3(-c.axe.z, 0, c.axe.x).multiplyScalar(HAUTEUR_PLATEFORME * 0.85));
        sol.y += 0.15;
        this.eclats.lancer(sol, t, { couleurs: [COULEURS.planche, COULEURS.plancheSombre, COULEURS.troncChene, COULEURS.feuillageChene], nombre: 24, taille: 0.16, force: 2.2, duree: 0.6 });
      }
      return true;
    });
    this.eclats.animer(t);
  }

  private montrer(p: PlateformeVue, matrice: THREE.Matrix4): void {
    p.maillage.setMatrixAt(p.index, matrice);
    p.maillage.instanceMatrix.needsUpdate = true;
  }

  /** Nouveau décor (autre île) : rien n'y est encore abattu. */
  private oublier(decor: THREE.Group): void {
    for (const chicot of this.abattues.values()) this.groupe.remove(chicot);
    for (const c of this.chutes) this.groupe.remove(c.maillage);
    this.abattues.clear();
    this.chutes = [];
    this.decor = decor;
  }
}
