// Monstres de la Rouille : modèles provisoires en voxels (les vrais viendront à l'étape 6), placés entre
// deux instantanés du moteur pour un mouvement fluide.
import * as THREE from 'three';
import type { Ile, Instantane, TypeMonstre } from '@spore-siege/engine';
import { versMonde } from './repere';
import { Voxels, type Modele } from './voxels';

const ROUILLE = { gris: 0x8d9198, sombre: 0x4c4f57, rouille: 0xb8572b, clair: 0xdfe8ef, oeil: 0x1d1d22, carapace: 0x4a3a38 };
const C = -0.5;

/** Taches de rouille éparses, tirées d'un hachage de la position. */
function taches(v: Voxels, fond: number, part: number): void {
  v.peindre((x, y, z, c) => c === fond && Math.abs(Math.sin(x * 12.99 + y * 78.23 + z * 37.71) * 43758.5) % 1 < part, ROUILLE.rouille);
}

function limace(): Voxels {
  const v = new Voxels().boule(C, 1.5, C, 3.6, 1.6, 1.8, ROUILLE.gris);
  taches(v, ROUILLE.gris, 0.15);
  // Cornes à l'avant (+x).
  v.boite(2, 3, -2, 2, 4, -2, ROUILLE.sombre).boite(2, 3, 1, 2, 4, 1, ROUILLE.sombre);
  return v.poser(2, 5, -2, ROUILLE.oeil).poser(2, 5, 1, ROUILLE.oeil);
}

function moucheron(): Voxels {
  const v = new Voxels().boule(C, 5, C, 1.6, 1.2, 1.2, ROUILLE.sombre);
  v.poser(1, 5, -1, ROUILLE.rouille).poser(1, 5, 0, ROUILLE.rouille);
  // Ailes.
  return v.boite(-2, 6, -4, 0, 6, -2, ROUILLE.clair).boite(-2, 6, 1, 0, 6, 3, ROUILLE.clair);
}

function scarabee(): Voxels {
  const v = new Voxels().dome(C, C, 1, 3.4, 3, ROUILLE.carapace);
  // Raie de rouille le long du dos.
  v.peindre((_x, _y, z, c) => c === ROUILLE.carapace && (z === -1 || z === 0), ROUILLE.rouille);
  v.boite(3, 1, -2, 4, 2, 1, ROUILLE.sombre);
  for (const x of [-2, 0, 2]) v.poser(x, 0, -4, ROUILLE.sombre).poser(x, 0, 3, ROUILLE.sombre);
  return v;
}

function amas(rayon: number): Voxels {
  const v = new Voxels().boule(C, rayon, C, rayon, rayon * 0.9, rayon, ROUILLE.gris);
  v.boule(C + rayon * 0.5, rayon * 1.5, C - rayon * 0.3, rayon * 0.5, rayon * 0.5, rayon * 0.5, ROUILLE.gris);
  taches(v, ROUILLE.gris, 0.35);
  return v;
}

let modeles: Record<TypeMonstre, Modele> | null = null;
function modelesMonstres(): Record<TypeMonstre, Modele> {
  modeles ??= {
    limace: limace().modele(false),
    moucheron: moucheron().modele(false),
    scarabee: scarabee().modele(false),
    amas: amas(3).modele(false),
    petitAmas: amas(1.8).modele(false),
  };
  return modeles;
}

interface Corps {
  maillage: THREE.Mesh;
  type: TypeMonstre;
}

export class MonstresRendu {
  readonly groupe = new THREE.Group();
  private readonly corps = new Map<number, Corps>();
  private readonly position = new THREE.Vector3();
  private readonly avant = new THREE.Vector3();

  /** Place les monstres entre `precedent` et `actuel` ; `alpha` de 0 (précédent) à 1 (actuel). */
  afficher(ile: Ile, precedent: Instantane | null, actuel: Instantane, alpha: number, instant: number): void {
    const anciens = new Map(precedent?.monstres.map((m) => [m.id, m.position]));
    const vus = new Set<number>();
    for (const m of actuel.monstres) {
      vus.add(m.id);
      let corps = this.corps.get(m.id);
      if (!corps) {
        const modele = modelesMonstres()[m.type];
        const maillage = new THREE.Mesh(modele.geometrie, modele.materiaux);
        maillage.castShadow = true;
        corps = { maillage, type: m.type };
        this.corps.set(m.id, corps);
        this.groupe.add(maillage);
      }
      const ancienne = anciens.get(m.id) ?? m.position;
      const x = ancienne.x + (m.position.x - ancienne.x) * alpha;
      const y = ancienne.y + (m.position.y - ancienne.y) * alpha;
      // Léger décalage propre à chaque monstre : la file ne marche pas sur une seule ligne.
      const ecart = ((m.id * 0.618) % 1) * 0.36 - 0.18;
      versMonde({ x: x + ecart, y: y - ecart }, ile, this.position);
      if (m.type === 'moucheron') this.position.y += Math.sin(instant / 120 + m.id) * 0.06;
      corps.maillage.position.copy(this.position);
      // Regard vers la direction de marche (+x du modèle).
      versMonde(m.position, ile, this.avant);
      versMonde(ancienne, ile, this.position);
      const dx = this.avant.x - this.position.x;
      const dz = this.avant.z - this.position.z;
      if (dx * dx + dz * dz > 1e-6) corps.maillage.rotation.y = Math.atan2(-dz, dx);
    }
    for (const [id, corps] of this.corps) {
      if (vus.has(id)) continue;
      this.groupe.remove(corps.maillage);
      this.corps.delete(id);
    }
  }
}
