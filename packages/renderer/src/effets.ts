// Gerbes de petits cubes qui volent, retombent et rapetissent : mort d'un monstre, explosion, tour vendue.
import * as THREE from 'three';
import { materiau } from './palette';
import { hachage, sansNuance } from './voxels';

const GEO = sansNuance(new THREE.BoxGeometry(1, 1, 1));
const GRAVITE = 9;

interface Eclat {
  maillage: THREE.Mesh;
  debut: number;
  duree: number;
  depart: THREE.Vector3;
  vitesse: THREE.Vector3;
  taille: number;
}

export interface Gerbe {
  couleurs: number[];
  nombre?: number;
  /** Côté d'un cube, en cases. */
  taille?: number;
  /** Vitesse horizontale, en cases par seconde. */
  force?: number;
  /** Secondes. */
  duree?: number;
}

export class Eclats {
  readonly groupe = new THREE.Group();
  private eclats: Eclat[] = [];

  /** `t` en secondes. */
  lancer(depart: THREE.Vector3, t: number, { couleurs, nombre = 8, taille = 0.13, force = 1.4, duree = 0.45 }: Gerbe): void {
    const tourne = hachage(depart.x, depart.y, depart.z) * Math.PI * 2;
    for (let i = 0; i < nombre; i++) {
      const a = tourne + (i * Math.PI * 2) / nombre;
      const vite = force * (0.8 + hachage(i, depart.x, depart.z) * 0.6);
      const maillage = new THREE.Mesh(GEO, materiau(couleurs[i % couleurs.length]!));
      maillage.scale.setScalar(taille);
      maillage.position.copy(depart);
      this.groupe.add(maillage);
      const vitesse = new THREE.Vector3(Math.cos(a) * vite, 2 + (i % 3) * 0.5, Math.sin(a) * vite);
      this.eclats.push({ maillage, debut: t, duree, depart: depart.clone(), vitesse, taille });
    }
  }

  animer(t: number): void {
    this.eclats = this.eclats.filter((e) => {
      const d = t - e.debut;
      if (d >= e.duree) {
        this.groupe.remove(e.maillage);
        return false;
      }
      e.maillage.position.set(
        e.depart.x + e.vitesse.x * d,
        Math.max(0.05, e.depart.y + e.vitesse.y * d - (GRAVITE * d * d) / 2),
        e.depart.z + e.vitesse.z * d,
      );
      // Rapetisse pendant la seconde moitié.
      e.maillage.scale.setScalar(e.taille * Math.min(1, (e.duree - d) / (e.duree / 2)));
      return true;
    });
  }

  get nombre(): number {
    return this.eclats.length;
  }
}
