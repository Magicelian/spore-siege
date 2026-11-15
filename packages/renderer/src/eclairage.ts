// Lumières de l'île. Dans la grotte (règle `noir`), le ciel et le soleil baissent jusqu'à une pénombre bleu-violet
// encore lisible, et chaque zone éclairée du moteur reçoit une lampe : cyan pour les luisants de la carte, ambre pour
// les champignons-lanternes. Les lampes forment une réserve fixe (jamais ajoutées ni retirées : changer le nombre de
// lumières recompilerait tous les matériaux) ; celles qui ne servent pas sont éteintes.
import * as THREE from 'three';
import type { Ile, Lumiere } from '@spore-siege/engine';
import { centreCase } from './repere';

const RESERVE = 24;
const JOUR = { ciel: 1.2, soleil: 2.2, couleurCiel: 0xfff4e0, solCiel: 0x5a4a6a };
const PENOMBRE = { ciel: 0.42, soleil: 0.28, couleurCiel: 0x8a8ad8, solCiel: 0x2a2440 };
const COULEUR_LUISANT = 0x6ff0ff;
const COULEUR_LANTERNE = 0xffb050;
/** Hauteur des lampes au-dessus du sol, en cases. */
const HAUTEUR = 1.1;

export class Eclairage {
  private readonly lampes: THREE.PointLight[] = [];
  private noir = false;

  constructor(
    scene: THREE.Scene,
    private readonly ciel: THREE.HemisphereLight,
    private readonly soleil: THREE.DirectionalLight,
  ) {
    for (let i = 0; i < RESERVE; i++) {
      const lampe = new THREE.PointLight(COULEUR_LUISANT, 0, 1, 1.2);
      this.lampes.push(lampe);
      scene.add(lampe);
    }
  }

  /** Règle ciel, soleil et lampes. `t` en secondes (les lanternes vacillent un peu). */
  afficher(ile: Ile, noir: boolean, lumieres: readonly Lumiere[], t: number): void {
    if (noir !== this.noir) {
      this.noir = noir;
      const r = noir ? PENOMBRE : JOUR;
      this.ciel.intensity = r.ciel;
      this.ciel.color.setHex(r.couleurCiel);
      this.ciel.groundColor.setHex(r.solCiel);
      this.soleil.intensity = r.soleil;
    }
    this.lampes.forEach((lampe, i) => {
      const l = noir ? lumieres[i] : undefined;
      if (!l || !l.allumee) {
        lampe.intensity = 0;
        return;
      }
      centreCase(Math.floor(l.position.x), Math.floor(l.position.y), ile, lampe.position);
      lampe.position.y += HAUTEUR;
      const lanterne = l.lanterne !== null;
      lampe.color.setHex(lanterne ? COULEUR_LANTERNE : COULEUR_LUISANT);
      // La portée suit à peu près le rayon du moteur : au-delà, plus rien n'est éclairé.
      lampe.distance = l.rayon + 1.2;
      const vacille = lanterne ? 1 + 0.06 * Math.sin(t * 7 + i * 1.9) + 0.04 * Math.sin(t * 13 + i) : 1 + 0.08 * Math.sin(t * 1.5 + i * 2.3);
      lampe.intensity = (lanterne ? 9 : 7) * vacille;
    });
  }
}
