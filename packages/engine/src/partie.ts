// Une partie sur une île : vagues, déplacement des monstres le long du sentier, vie de la souche.
// Pur et déterministe : mêmes île, vagues, graine et commandes → même partie, pas pour pas.
import type { Case, Commande, Ile, Instantane, MonstreVu, Phase, Position, TypeMonstre } from './contrat';
import { MONSTRES, PAS_PAR_SECONDE, PAUSE_SECONDES, PV_SOUCHE, type Vague } from './contenu';
import { creerHasard } from './hasard';
import { lireSentier, route, type Sentier } from './sentier';

interface Monstre {
  id: number;
  type: TypeMonstre;
  pv: number;
  /** Points traversés, en cases : centres des cases de la route, puis le bord de la souche. */
  trace: Position[];
  /** Distance parcourue le long de `trace`, en cases. */
  avancement: number;
}

/** Un monstre à lâcher, `pas` comptés depuis le début de la vague. */
interface Lacher {
  pas: number;
  type: TypeMonstre;
  plage: number;
}

export class Partie {
  readonly sentier: Sentier;
  private pas = 0;
  private phase: Phase = 'pause';
  private vague = 1;
  private pasPhase = 0;
  private pvSouche = PV_SOUCHE;
  private monstres: Monstre[] = [];
  private prochainId = 1;
  private lachers: Lacher[] = [];
  /** Réservé aux tirages des étapes suivantes (cibles, effets) ; fixé par la graine. */
  readonly hasard: () => number;

  constructor(
    readonly ile: Ile,
    readonly vagues: readonly Vague[],
    graine: number,
  ) {
    this.sentier = lireSentier(ile);
    this.hasard = creerHasard(graine);
    if (this.sentier.plages.length === 0) throw new Error("l'île n'a aucune plage reliée au sentier");
  }

  executer(commande: Commande): boolean {
    if (commande.type === 'lancerVague') {
      if (this.phase !== 'pause') return false;
      this.commencerVague();
      return true;
    }
    return false;
  }

  /** Un pas de simulation. */
  avancer(): void {
    if (this.phase === 'victoire' || this.phase === 'defaite') return;
    this.pas++;
    this.pasPhase++;
    if (this.phase === 'pause') {
      if (this.pasPhase >= PAUSE_SECONDES * PAS_PAR_SECONDE) this.commencerVague();
      return;
    }
    while (this.lachers[0] && this.lachers[0].pas <= this.pasPhase) this.lacher(this.lachers.shift()!);
    this.deplacer();
    if (this.pvSouche <= 0) {
      this.pvSouche = 0;
      this.phase = 'defaite';
    } else if (this.lachers.length === 0 && this.monstres.length === 0) {
      if (this.vague >= this.vagues.length) this.phase = 'victoire';
      else {
        this.vague++;
        this.phase = 'pause';
        this.pasPhase = 0;
      }
    }
  }

  instantane(): Instantane {
    const monstres: MonstreVu[] = this.monstres.map((m) => ({
      id: m.id,
      type: m.type,
      position: pointSur(m.trace, m.avancement),
      pv: m.pv,
      pvMax: MONSTRES[m.type].pv,
    }));
    return {
      pas: this.pas,
      phase: this.phase,
      vague: this.vague,
      vagues: this.vagues.length,
      pauseRestante: this.phase === 'pause' ? Math.ceil(PAUSE_SECONDES - this.pasPhase / PAS_PAR_SECONDE) : 0,
      souche: { pv: this.pvSouche, pvMax: PV_SOUCHE },
      monstres,
      etoiles: this.phase === 'victoire' ? etoiles(this.pvSouche) : 0,
    };
  }

  private commencerVague(): void {
    this.phase = 'vague';
    this.pasPhase = 0;
    const plages = this.sentier.plages.length;
    let tour = 0;
    this.lachers = (this.vagues[this.vague - 1] ?? [])
      .flatMap((g) =>
        Array.from({ length: g.nombre }, (_, i) => ({
          pas: Math.round(((g.debut ?? 0) + i * g.intervalle) * PAS_PAR_SECONDE),
          type: g.type,
          plage: (g.plage ?? tour++) % plages,
        })),
      )
      // Tri stable : à pas égal, l'ordre des groupes est gardé.
      .sort((a, b) => a.pas - b.pas);
  }

  private lacher({ type, plage }: Lacher): void {
    const { depart } = this.sentier.plages[plage]!;
    const chemin = route(this.ile, depart);
    if (!chemin) return;
    this.monstres.push({ id: this.prochainId++, type, pv: MONSTRES[type].pv, trace: tracer(this.ile, chemin), avancement: 0 });
  }

  private deplacer(): void {
    const restants: Monstre[] = [];
    for (const m of this.monstres) {
      m.avancement += MONSTRES[m.type].vitesse / PAS_PAR_SECONDE;
      if (m.avancement >= longueur(m.trace)) this.pvSouche -= MONSTRES[m.type].morsure;
      else restants.push(m);
    }
    this.monstres = restants;
  }
}

/** 1 étoile : île finie ; 2 : souche à la moitié de sa vie ou plus ; 3 : souche intacte. */
export function etoiles(pvSouche: number): number {
  if (pvSouche >= PV_SOUCHE) return 3;
  if (pvSouche >= PV_SOUCHE / 2) return 2;
  return 1;
}

/** Centres des cases du chemin, puis le point où la dernière touche la souche. */
function tracer(ile: Ile, chemin: Case[]): Position[] {
  const trace = chemin.map((c) => ({ x: c.x + 0.5, y: c.y + 0.5 }));
  const derniere = chemin[chemin.length - 1]!;
  const centre = ile.souche.x + ile.tailleSouche / 2;
  const milieu = ile.souche.y + ile.tailleSouche / 2;
  // Un demi-pas vers la souche : le monstre s'arrête contre son bord.
  const dx = Math.sign(centre - (derniere.x + 0.5));
  const dy = Math.sign(milieu - (derniere.y + 0.5));
  const versX = derniere.x < ile.souche.x || derniere.x >= ile.souche.x + ile.tailleSouche;
  trace.push({ x: derniere.x + 0.5 + (versX ? dx * 0.5 : 0), y: derniere.y + 0.5 + (versX ? 0 : dy * 0.5) });
  return trace;
}

function longueur(trace: Position[]): number {
  let total = 0;
  for (let i = 1; i < trace.length; i++) total += Math.hypot(trace[i]!.x - trace[i - 1]!.x, trace[i]!.y - trace[i - 1]!.y);
  return total;
}

function pointSur(trace: Position[], distance: number): Position {
  let reste = distance;
  for (let i = 1; i < trace.length; i++) {
    const a = trace[i - 1]!;
    const b = trace[i]!;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (reste <= segment) {
      const t = segment === 0 ? 0 : reste / segment;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    reste -= segment;
  }
  return { ...trace[trace.length - 1]! };
}
