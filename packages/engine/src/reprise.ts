// Partie en cours enregistrée pour la reprendre plus tard (application fermée en pleine partie).
// Le moteur est déterministe : il suffit de garder ce qui a créé la partie, les commandes acceptées et le pas où
// chacune a été jouée, puis de tout rejouer.
import type { Capacite, Commande, Difficulte } from './contrat';
import { NIVEAUX, NIVEAU_SANS_FIN, partieDe, type Niveau } from './niveaux';
import type { Partie } from './partie';

export interface Reprise {
  niveau: string;
  graine: number;
  capacites: Capacite[];
  difficulte: Difficulte;
  /** Commandes acceptées, avec le pas où elles ont été jouées. */
  commandes: { pas: number; commande: Commande }[];
  /** Pas atteint au dernier enregistrement. */
  pas: number;
}

/** Niveau d'après son id de sauvegarde (îles et vagues sans fin). */
export function niveauParId(id: string): Niveau | undefined {
  if (id === NIVEAU_SANS_FIN.id) return NIVEAU_SANS_FIN;
  return Object.values(NIVEAUX)
    .flat()
    .find((n) => n?.id === id);
}

/** Refait la partie enregistrée jusqu'à son dernier pas ; `null` si le niveau n'existe plus ou si elle était finie. */
export function reprendre(r: Reprise): { niveau: Niveau; partie: Partie } | null {
  const niveau = niveauParId(r.niveau);
  if (!niveau) return null;
  const partie = partieDe(niveau, r.graine, r.capacites, r.difficulte);
  let k = 0;
  for (;;) {
    while (k < r.commandes.length && r.commandes[k]!.pas <= partie.pasJoues) partie.executer(r.commandes[k++]!.commande);
    if (partie.pasJoues >= r.pas) break;
    const avant = partie.pasJoues;
    partie.avancer();
    if (partie.pasJoues === avant) break; // partie finie
  }
  const phase = partie.instantane().phase;
  return phase === 'victoire' || phase === 'defaite' ? null : { niveau, partie };
}
