// Une partie sur une île : vagues, monstres qui suivent le sentier, tours qui tirent, spores, vie de la souche.
// Pur et déterministe : mêmes île, vagues, graine et commandes → même partie, pas pour pas.
import type { Case, Commande, ImpactVu, Ile, Instantane, MonstreVu, Phase, Position, TourVue, TypeMonstre, TypeTour } from './contrat';
import {
  BONUS_PAR_SECONDE_GAGNEE,
  BONUS_VAGUE,
  MONSTRES,
  PART_REVENTE,
  PAS_PAR_SECONDE,
  PAUSE_SECONDES,
  PV_SOUCHE,
  SPORES_DEPART,
  TOURS,
  type Vague,
} from './contenu';
import { creerHasard } from './hasard';
import { lireSentier, route, type Sentier } from './sentier';

interface Monstre {
  id: number;
  type: TypeMonstre;
  pv: number;
  /** Points traversés, en cases : centres des cases de la route, puis le bord de la souche. */
  trace: Position[];
  longueur: number;
  /** Distance parcourue le long de `trace`, en cases. */
  avancement: number;
  position: Position;
  /** Ralenti par le mortier jusqu'à ce pas, vitesse multipliée par `facteurRalenti`. */
  ralentiJusqua: number;
  facteurRalenti: number;
}

interface Tour {
  id: number;
  type: TypeTour;
  stade: number;
  case: Case;
  centre: Position;
  /** Pas à attendre avant de pouvoir tirer. */
  recharge: number;
  cible: number | null;
  dernierTir: number;
  chaine: Position[];
  /** Spores payées (pose et améliorations), pour la revente. */
  depense: number;
}

interface Projectile {
  id: number;
  type: TypeTour;
  position: Position;
  /** Point visé ; suit la cible si le projectile est guidé. */
  but: Position;
  cible: number;
  degats: number;
}

/** Pas pendant lesquels une explosion reste dans l'instantané. */
const DUREE_IMPACT = 8;

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
  private spores = SPORES_DEPART;
  private tours: Tour[] = [];
  private projectiles: Projectile[] = [];
  private impacts: ImpactVu[] = [];
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
    if (this.phase === 'victoire' || this.phase === 'defaite') return false;
    switch (commande.type) {
      case 'lancerVague': {
        if (this.phase !== 'pause') return false;
        this.spores += this.pauseRestante() * BONUS_PAR_SECONDE_GAGNEE;
        this.commencerVague();
        return true;
      }
      case 'poserTour': {
        const prix = TOURS[commande.tour].stades[0].prix;
        const c = commande.case;
        if (!this.libre(c) || this.spores < prix) return false;
        this.spores -= prix;
        this.tours.push({
          id: this.prochainId++,
          type: commande.tour,
          stade: 1,
          case: { x: c.x, y: c.y },
          centre: { x: c.x + 0.5, y: c.y + 0.5 },
          recharge: 0,
          cible: null,
          dernierTir: -1,
          chaine: [],
          depense: prix,
        });
        return true;
      }
      case 'ameliorerTour': {
        const tour = this.tours.find((t) => t.id === commande.id);
        const prix = tour && prixAmelioration(tour);
        if (!tour || prix == null || this.spores < prix) return false;
        this.spores -= prix;
        tour.stade++;
        tour.depense += prix;
        return true;
      }
      case 'vendreTour': {
        const tour = this.tours.find((t) => t.id === commande.id);
        if (!tour) return false;
        this.spores += revente(tour);
        this.tours = this.tours.filter((t) => t !== tour);
        return true;
      }
    }
  }

  /** Une tour peut-elle être posée sur cette case ? */
  libre(c: Case): boolean {
    return constructible(this.ile, c) && !this.tours.some((t) => t.case.x === c.x && t.case.y === c.y);
  }

  /** Un pas de simulation. */
  avancer(): void {
    if (this.phase === 'victoire' || this.phase === 'defaite') return;
    this.pas++;
    this.pasPhase++;
    if (this.phase === 'vague') {
      while (this.lachers[0] && this.lachers[0].pas <= this.pasPhase) this.lacher(this.lachers.shift()!);
      this.deplacer();
    }
    this.tirer();
    this.voler();
    this.enterrer();
    this.impacts = this.impacts.filter((i) => this.pas - i.pas < DUREE_IMPACT);
    if (this.phase === 'pause') {
      if (this.pasPhase >= PAUSE_SECONDES * PAS_PAR_SECONDE) this.commencerVague();
      return;
    }
    if (this.pvSouche <= 0) {
      this.pvSouche = 0;
      this.phase = 'defaite';
    } else if (this.lachers.length === 0 && this.monstres.length === 0) {
      if (this.vague >= this.vagues.length) this.phase = 'victoire';
      else {
        this.spores += BONUS_VAGUE.fixe + BONUS_VAGUE.parVague * this.vague;
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
      position: { ...m.position },
      pv: m.pv,
      pvMax: MONSTRES[m.type].pv,
      ralenti: this.pas < m.ralentiJusqua,
    }));
    const tours: TourVue[] = this.tours.map((t) => ({
      id: t.id,
      type: t.type,
      stade: t.stade,
      case: { ...t.case },
      portee: stadeDe(t).portee,
      cible: t.cible,
      dernierTir: t.dernierTir,
      chaine: t.chaine.map((p) => ({ ...p })),
      prixAmelioration: prixAmelioration(t),
      revente: revente(t),
    }));
    return {
      pas: this.pas,
      phase: this.phase,
      vague: this.vague,
      vagues: this.vagues.length,
      pauseRestante: this.pauseRestante(),
      souche: { pv: this.pvSouche, pvMax: PV_SOUCHE },
      monstres,
      spores: this.spores,
      tours,
      projectiles: this.projectiles.map((p) => ({ id: p.id, type: p.type, position: { ...p.position } })),
      impacts: this.impacts.map((i) => ({ ...i, position: { ...i.position } })),
      etoiles: this.phase === 'victoire' ? etoiles(this.pvSouche) : 0,
    };
  }

  private pauseRestante(): number {
    return this.phase === 'pause' ? Math.ceil(PAUSE_SECONDES - this.pasPhase / PAS_PAR_SECONDE) : 0;
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
    this.monstres.push(this.nouveauMonstre(type, tracer(this.ile, chemin), 0));
  }

  private nouveauMonstre(type: TypeMonstre, trace: Position[], avancement: number): Monstre {
    return {
      id: this.prochainId++,
      type,
      pv: MONSTRES[type].pv,
      trace,
      longueur: longueur(trace),
      avancement,
      position: pointSur(trace, avancement),
      ralentiJusqua: 0,
      facteurRalenti: 1,
    };
  }

  /** Vitesse actuelle, en cases par seconde. */
  private vitesse(m: Monstre): number {
    return MONSTRES[m.type].vitesse * (this.pas < m.ralentiJusqua ? m.facteurRalenti : 1);
  }

  private deplacer(): void {
    const restants: Monstre[] = [];
    for (const m of this.monstres) {
      m.avancement += this.vitesse(m) / PAS_PAR_SECONDE;
      if (m.avancement >= m.longueur) this.pvSouche -= MONSTRES[m.type].morsure;
      else {
        m.position = pointSur(m.trace, m.avancement);
        restants.push(m);
      }
    }
    this.monstres = restants;
  }

  /** Le monstre vivant le plus proche de la souche, à portée de `centre`. */
  private viser(centre: Position, portee: number, exclus?: Set<Monstre>): Monstre | null {
    let meilleur: Monstre | null = null;
    for (const m of this.monstres) {
      if (m.pv <= 0 || exclus?.has(m) || distance(centre, m.position) > portee) continue;
      if (!meilleur || m.longueur - m.avancement < meilleur.longueur - meilleur.avancement) meilleur = m;
    }
    return meilleur;
  }

  private tirer(): void {
    for (const t of this.tours) {
      if (t.recharge > 0) t.recharge--;
      const stade = stadeDe(t);
      const cible = this.viser(t.centre, stade.portee);
      t.cible = cible?.id ?? null;
      if (!cible || t.recharge > 0) continue;
      t.recharge = Math.round(stade.cadence * PAS_PAR_SECONDE);
      t.dernierTir = this.pas;
      const fiche = TOURS[t.type];
      if (fiche.eclair) {
        this.eclair(t, cible, stade.degats, stade.rebonds ?? 0, fiche.eclair);
      } else if (fiche.projectile) {
        const but = fiche.projectile.guide ? { ...cible.position } : this.ouSera(cible, t.centre, fiche.projectile.vitesse);
        this.projectiles.push({ id: this.prochainId++, type: t.type, position: { ...t.centre }, but, cible: cible.id, degats: stade.degats });
      }
    }
  }

  /** Coup immédiat qui rebondit de monstre en monstre ; il traverse l'armure. */
  private eclair(t: Tour, cible: Monstre, degats: number, rebonds: number, { distance: saut, attenuation }: { distance: number; attenuation: number }): void {
    const touches = new Set<Monstre>([cible]);
    t.chaine = [{ ...t.centre }, { ...cible.position }];
    this.blesser(cible, degats, true);
    let dernier = cible;
    for (let i = 0; i < rebonds; i++) {
      const suivant = this.viser(dernier.position, saut, touches);
      if (!suivant) break;
      degats *= attenuation;
      touches.add(suivant);
      t.chaine.push({ ...suivant.position });
      this.blesser(suivant, degats, true);
      dernier = suivant;
    }
  }

  /** Où sera le monstre quand un projectile tiré de `depuis` l'atteindra. */
  private ouSera(m: Monstre, depuis: Position, vitesseProjectile: number): Position {
    let point = m.position;
    for (let i = 0; i < 2; i++) {
      const duree = distance(depuis, point) / vitesseProjectile;
      point = pointSur(m.trace, Math.min(m.longueur, m.avancement + this.vitesse(m) * duree));
    }
    return { ...point };
  }

  private voler(): void {
    const parId = new Map(this.monstres.map((m) => [m.id, m]));
    const restants: Projectile[] = [];
    for (const p of this.projectiles) {
      const fiche = TOURS[p.type].projectile!;
      if (fiche.guide) {
        const cible = parId.get(p.cible);
        // Sa cible morte, l'abeille s'en va.
        if (!cible || cible.pv <= 0) continue;
        p.but = { ...cible.position };
      }
      const pasVol = fiche.vitesse / PAS_PAR_SECONDE;
      const reste = distance(p.position, p.but);
      if (reste > pasVol) {
        p.position.x += ((p.but.x - p.position.x) / reste) * pasVol;
        p.position.y += ((p.but.y - p.position.y) / reste) * pasVol;
        restants.push(p);
        continue;
      }
      if (fiche.guide) {
        this.blesser(parId.get(p.cible)!, p.degats);
        continue;
      }
      const ralenti = TOURS[p.type].ralenti;
      for (const m of this.monstres) {
        if (m.pv <= 0 || distance(m.position, p.but) > fiche.rayon) continue;
        this.blesser(m, p.degats);
        if (ralenti) {
          m.ralentiJusqua = this.pas + Math.round(ralenti.duree * PAS_PAR_SECONDE);
          m.facteurRalenti = ralenti.facteur;
        }
      }
      this.impacts.push({ type: p.type, position: { ...p.but }, rayon: fiche.rayon, pas: this.pas });
    }
    this.projectiles = restants;
  }

  private blesser(m: Monstre, degats: number, percant = false): void {
    if (m.pv <= 0) return;
    m.pv -= percant ? degats : Math.max(1, degats - MONSTRES[m.type].armure);
  }

  /** Retire les morts : leurs spores tombent, l'amas se divise en deux petits. */
  private enterrer(): void {
    const vivants: Monstre[] = [];
    for (const m of this.monstres) {
      if (m.pv > 0) {
        vivants.push(m);
        continue;
      }
      this.spores += MONSTRES[m.type].butin;
      if (m.type === 'amas') {
        vivants.push(this.nouveauMonstre('petitAmas', m.trace, m.avancement));
        vivants.push(this.nouveauMonstre('petitAmas', m.trace, Math.max(0, m.avancement - 0.4)));
      }
    }
    this.monstres = vivants;
  }
}

/** 1 étoile : île finie ; 2 : souche à la moitié de sa vie ou plus ; 3 : souche intacte. */
export function etoiles(pvSouche: number): number {
  if (pvSouche >= PV_SOUCHE) return 3;
  if (pvSouche >= PV_SOUCHE / 2) return 2;
  return 1;
}

/** Herbe ou fleurs, hors de la souche : là où une tour peut pousser. */
export function constructible(ile: Ile, c: Case): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= ile.largeur || c.y >= ile.profondeur) return false;
  const { souche, tailleSouche } = ile;
  if (c.x >= souche.x && c.x < souche.x + tailleSouche && c.y >= souche.y && c.y < souche.y + tailleSouche) return false;
  const terrain = ile.terrain[c.y * ile.largeur + c.x];
  return terrain === 'herbe' || terrain === 'fleurs';
}

function stadeDe(t: Tour) {
  return TOURS[t.type].stades[t.stade - 1]!;
}

function prixAmelioration(t: Tour): number | null {
  return t.stade < 3 ? TOURS[t.type].stades[t.stade]!.prix : null;
}

function revente(t: Tour): number {
  return Math.floor(t.depense * PART_REVENTE + 1e-9);
}

function distance(a: Position, b: Position): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
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
