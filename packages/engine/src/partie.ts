// Une partie sur une île : vagues, monstres qui suivent le sentier, tours qui tirent, spores, vie de la souche.
// Pur et déterministe : mêmes île, vagues, graine et commandes → même partie, pas pour pas.
import type { Capacite, Case, Commande, Regles, EvenementVu, FlaqueVu, ImpactVu, Ile, Instantane, MonstreVu, Phase, Position, TourVue, TypeMonstre, TypeTour } from './contrat';
import {
  BONUS_PAR_SECONDE_GAGNEE,
  BONUS_VAGUE,
  CAPACITES,
  CAPACITES_DE,
  MONSTRES,
  PART_RONCE_RENDUE,
  PART_REVENTE,
  PART_REVENTE_CAPACITE,
  PAS_PAR_SECONDE,
  PAUSE_SECONDES,
  PRIX_RONCE,
  PV_SOUCHE,
  SPORES_DEPART,
  TOURS,
  TYPES_TOURS,
  type StadeTour,
  type Vague,
} from './contenu';
import { creerHasard } from './hasard';
import { cle, emplacementsRonces, lireSentier, route, type Sentier } from './sentier';

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
  /** Empoisonné par le Dard jusqu'à ce pas, en perdant `poisonParPas` à chaque pas. */
  poisonJusqua: number;
  poisonParPas: number;
  /** Soigneur : pas à attendre avant le prochain soin. */
  soinRecharge: number;
  /** Boss : paliers de vie déjà franchis. */
  paliers: number;
}

interface Tour {
  id: number;
  type: TypeTour;
  stade: number;
  capacite: Capacite | null;
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
  capacite: Capacite | null;
  /** Réglages du tir, figés au départ : une amélioration en vol ne les change pas. */
  guide: boolean;
  vitesse: number;
  rayon: number;
  percant: boolean;
  ralenti: { facteur: number; duree: number } | null;
  poison: { degatsParSeconde: number; duree: number } | null;
  flaque: { rayon: number; duree: number; facteur: number } | null;
  position: Position;
  /** Centre de la tour qui l'a tiré (pour l'arc des obus). */
  depart: Position;
  /** Point visé ; suit la cible si le projectile est guidé. */
  but: Position;
  cible: number;
  degats: number;
}

interface Flaque {
  id: number;
  position: Position;
  rayon: number;
  facteur: number;
  debut: number;
  fin: number;
}

/** Pas pendant lesquels une explosion reste dans l'instantané. */
const DUREE_IMPACT = 8;
/** Pas pendant lesquels un événement reste dans l'instantané. */
const DUREE_EVENEMENT = 20;

/** Un monstre à lâcher, `pas` comptés depuis le début de la vague. */
interface Lacher {
  pas: number;
  type: TypeMonstre;
  plage: number;
}

export class Partie {
  readonly sentier: Sentier;
  /** Cases où une ronce peut pousser : l'entrée de chaque branche, autour des carrefours. */
  readonly emplacementsRonces: Case[];
  private ronces = new Set<string>();
  private pas = 0;
  private phase: Phase = 'pause';
  private vague = 1;
  private pasPhase = 0;
  private pvSouche = PV_SOUCHE;
  private monstres: Monstre[] = [];
  private prochainId = 1;
  private lachers: Lacher[] = [];
  private spores: number;
  /** Dégâts infligés depuis le début, par sorte de tour (tours vendues comprises). */
  private degats: Record<TypeTour, number> = { ruche: 0, cristal: 0, mortier: 0, canon: 0 };
  readonly regles: Regles;
  private tours: Tour[] = [];
  private projectiles: Projectile[] = [];
  private impacts: ImpactVu[] = [];
  private flaques: Flaque[] = [];
  private evenements: EvenementVu[] = [];
  /** Réservé aux tirages des étapes suivantes (cibles, effets) ; fixé par la graine. */
  readonly hasard: () => number;

  constructor(
    readonly ile: Ile,
    readonly vagues: readonly Vague[],
    graine: number,
    regles: Partial<Regles> = {},
  ) {
    this.regles = { spores: SPORES_DEPART, tours: [...TYPES_TOURS], ronces: true, ...regles };
    this.spores = this.regles.spores;
    this.sentier = lireSentier(ile);
    this.emplacementsRonces = emplacementsRonces(ile, this.sentier.carrefours);
    this.hasard = creerHasard(graine);
    if (this.sentier.plages.length === 0) throw new Error("l'île n'a aucune plage reliée au sentier");
  }

  executer(commande: Commande): boolean {
    if (this.phase === 'victoire' || this.phase === 'defaite') return false;
    switch (commande.type) {
      case 'lancerVague': {
        if (this.phase !== 'pause') return false;
        this.spores += this.bonusLancer();
        this.commencerVague();
        return true;
      }
      case 'poserTour': {
        const prix = TOURS[commande.tour].stades[0].prix;
        const c = commande.case;
        if (!this.regles.tours.includes(commande.tour) || !this.libre(c) || this.spores < prix) return false;
        this.spores -= prix;
        this.tours.push({
          id: this.prochainId++,
          type: commande.tour,
          stade: 1,
          capacite: null,
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
      case 'choisirCapacite': {
        const tour = this.tours.find((t) => t.id === commande.id);
        if (!tour || tour.stade !== 3 || !CAPACITES_DE[tour.type].includes(commande.capacite)) return false;
        const prix = CAPACITES[commande.capacite].prix;
        if (this.spores < prix) return false;
        this.spores -= prix;
        tour.stade = 4;
        tour.capacite = commande.capacite;
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
      case 'poserRonce': {
        if (this.spores < PRIX_RONCE || !this.ronceLibre(commande.case)) return false;
        this.spores -= PRIX_RONCE;
        this.ronces.add(cle(commande.case));
        this.rerouter();
        return true;
      }
      case 'enleverRonce': {
        if (!this.ronces.delete(cle(commande.case))) return false;
        this.spores += Math.floor(PRIX_RONCE * PART_RONCE_RENDUE);
        this.rerouter();
        return true;
      }
    }
  }

  /**
   * Une ronce peut-elle pousser ici ? À l'entrée d'une branche, sans monstre dessus, et seulement si chaque plage
   * et chaque monstre en route gardent un chemin vers la souche : il reste toujours une branche ouverte.
   */
  ronceLibre(c: Case): boolean {
    const k = cle(c);
    if (!this.regles.ronces || this.ronces.has(k) || !this.emplacementsRonces.some((e) => cle(e) === k)) return false;
    const bloquees = new Set(this.ronces).add(k);
    if (this.sentier.plages.some((p) => !route(this.ile, p.depart, bloquees))) return false;
    for (const m of this.monstres) {
      if (MONSTRES[m.type].volant) continue;
      const voisines = casesAutour(m);
      if (voisines.some((v) => cle(v) === k)) return false;
      if (voisines.length > 0 && !this.nouvelleTrace(m, bloquees)) return false;
    }
    return true;
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
      this.empoisonner();
      this.soigner();
    }
    this.tirer();
    this.voler();
    this.pondre();
    this.enterrer();
    this.impacts = this.impacts.filter((i) => this.pas - i.pas < DUREE_IMPACT);
    this.flaques = this.flaques.filter((f) => this.pas < f.fin);
    this.evenements = this.evenements.filter((e) => this.pas - e.pas < DUREE_EVENEMENT);
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
      ralenti: this.facteurVitesse(m) < 1,
      empoisonne: this.pas < m.poisonJusqua,
    }));
    const tours: TourVue[] = this.tours.map((t) => ({
      id: t.id,
      type: t.type,
      stade: t.stade,
      capacite: t.capacite,
      case: { ...t.case },
      portee: stadeDe(t).portee,
      cible: t.cible,
      dernierTir: t.dernierTir,
      chaine: t.chaine.map((p) => ({ ...p })),
      prixAmelioration: prixAmelioration(t),
      prixCapacites: t.stade === 3 ? [CAPACITES[CAPACITES_DE[t.type][0]].prix, CAPACITES[CAPACITES_DE[t.type][1]].prix] : null,
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
      projectiles: this.projectiles.map((p) => ({ id: p.id, type: p.type, capacite: p.capacite, position: { ...p.position }, depart: { ...p.depart }, but: { ...p.but } })),
      impacts: this.impacts.map((i) => ({ ...i, position: { ...i.position } })),
      evenements: this.evenements.map((e) =>
        e.type === 'mort' ? { ...e, position: { ...e.position } } : e.type === 'soin'
            ? { ...e, position: { ...e.position }, soignes: [...e.soignes] }
            : e.type === 'ponte'
              ? { ...e, position: { ...e.position }, petits: [...e.petits] }
              : { ...e },
      ),
      flaques: this.flaques.map(
        (f): FlaqueVu => ({ id: f.id, position: { ...f.position }, rayon: f.rayon, reste: Math.max(0, (f.fin - this.pas) / (f.fin - f.debut)) }),
      ),
      ronces: [...this.ronces].map((k) => {
        const [x, y] = k.split(',').map(Number) as [number, number];
        return { x, y };
      }),
      bonusLancer: this.bonusLancer(),
      etoiles: this.phase === 'victoire' ? etoiles(this.pvSouche) : 0,
      monstresVague: this.monstresVague(),
      regles: { ...this.regles, tours: [...this.regles.tours] },
      degats: { ...this.degats },
    };
  }

  /** Sortes de monstres de la vague en cours ou à venir, dans l'ordre ; l'amas amène ses petits. */
  private monstresVague(): TypeMonstre[] {
    const types = new Set<TypeMonstre>();
    for (const g of this.vagues[this.vague - 1] ?? []) {
      types.add(g.type);
      if (g.type === 'amas') types.add('petitAmas');
    }
    return [...types];
  }

  /** Spores gagnées en lançant la vague maintenant : une par seconde de pause écourtée. */
  private bonusLancer(): number {
    return this.pauseRestante() * BONUS_PAR_SECONDE_GAGNEE;
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
    if (MONSTRES[type].volant) {
      this.monstres.push(this.nouveauMonstre(type, enVol(this.ile, depart), 0));
      return;
    }
    const chemin = route(this.ile, depart, this.ronces);
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
      poisonJusqua: 0,
      poisonParPas: 0,
      soinRecharge: Math.round((MONSTRES[type].soin?.cadence ?? 0) * PAS_PAR_SECONDE),
      paliers: 0,
    };
  }

  /** Après une ronce posée ou enlevée : chaque monstre repart par le plus court chemin encore ouvert. */
  private rerouter(): void {
    for (const m of this.monstres) {
      if (MONSTRES[m.type].volant) continue;
      const trace = this.nouvelleTrace(m, this.ronces);
      if (!trace) continue;
      m.trace = trace;
      m.longueur = longueur(trace);
      m.avancement = 0;
    }
  }

  /**
   * Nouveau parcours depuis la position du monstre : par la case qu'il quitte ou par celle où il va, au plus court.
   * Null s'il fait déjà son dernier demi-pas vers la souche (rien à changer) ou s'il est coincé.
   */
  private nouvelleTrace(m: Monstre, bloquees: ReadonlySet<string>): Position[] | null {
    let meilleure: Position[] | null = null;
    let plusCourte = Infinity;
    for (const c of casesAutour(m)) {
      if (bloquees.has(cle(c))) continue;
      const chemin = route(this.ile, c, bloquees);
      if (!chemin) continue;
      const trace = [{ ...m.position }, ...tracer(this.ile, chemin)];
      const l = longueur(trace);
      if (l < plusCourte) [meilleure, plusCourte] = [trace, l];
    }
    return meilleure;
  }

  /** Vitesse actuelle, en cases par seconde. */
  private vitesse(m: Monstre): number {
    return MONSTRES[m.type].vitesse * this.facteurVitesse(m);
  }

  /** Le plus fort des ralentis en cours : coup de mortier, flaque de glu. */
  private facteurVitesse(m: Monstre): number {
    let facteur = this.pas < m.ralentiJusqua ? m.facteurRalenti : 1;
    if (MONSTRES[m.type].volant) return facteur;
    for (const f of this.flaques) if (distance(m.position, f.position) <= f.rayon) facteur = Math.min(facteur, f.facteur);
    return facteur;
  }

  /** Chaque soigneur, à son rythme, rend de la vie aux autres monstres blessés autour de lui. */
  private soigner(): void {
    for (const s of this.monstres) {
      const soin = MONSTRES[s.type].soin;
      if (!soin || s.pv <= 0 || --s.soinRecharge > 0) continue;
      s.soinRecharge = Math.round(soin.cadence * PAS_PAR_SECONDE);
      const soignes: number[] = [];
      for (const m of this.monstres) {
        const max = MONSTRES[m.type].pv;
        if (m === s || m.pv <= 0 || m.pv >= max || distance(m.position, s.position) > soin.rayon) continue;
        m.pv = Math.min(max, m.pv + soin.pv);
        soignes.push(m.id);
      }
      if (soignes.length > 0) this.evenements.push({ type: 'soin', id: s.id, monstre: s.type, position: { ...s.position }, soignes, pas: this.pas });
    }
  }

  private empoisonner(): void {
    for (const m of this.monstres) if (this.pas < m.poisonJusqua) this.blesser(m, m.poisonParPas, true, 'ruche');
  }

  private deplacer(): void {
    const restants: Monstre[] = [];
    for (const m of this.monstres) {
      m.avancement += this.vitesse(m) / PAS_PAR_SECONDE;
      if (m.avancement >= m.longueur) {
        // Le boss qui touche la souche l'emporte : la partie est perdue.
        const degats = MONSTRES[m.type].boss ? Math.max(this.pvSouche, MONSTRES[m.type].morsure) : MONSTRES[m.type].morsure;
        this.pvSouche -= degats;
        this.evenements.push({ type: 'morsure', id: m.id, monstre: m.type, degats, pas: this.pas });
      } else {
        m.position = pointSur(m.trace, m.avancement);
        restants.push(m);
      }
    }
    this.monstres = restants;
  }

  /** Le monstre vivant le plus proche de la souche, à portée de `centre`. */
  private viser(centre: Position, portee: number, aerien: boolean, exclus?: Set<Monstre>): Monstre | null {
    let meilleur: Monstre | null = null;
    for (const m of this.monstres) {
      if (m.pv <= 0 || exclus?.has(m) || distance(centre, m.position) > portee) continue;
      if (!aerien && MONSTRES[m.type].volant) continue;
      if (!meilleur || m.longueur - m.avancement < meilleur.longueur - meilleur.avancement) meilleur = m;
    }
    return meilleur;
  }

  private tirer(): void {
    for (const t of this.tours) {
      if (t.recharge > 0) t.recharge--;
      const stade = stadeDe(t);
      const cible = this.viser(t.centre, stade.portee, TOURS[t.type].aerien ?? false);
      t.cible = cible?.id ?? null;
      if (!cible || t.recharge > 0) continue;
      t.recharge = Math.round(stade.cadence * PAS_PAR_SECONDE);
      t.dernierTir = this.pas;
      const fiche = TOURS[t.type];
      const capacite = t.capacite ? CAPACITES[t.capacite] : null;
      if (fiche.eclair) {
        this.eclair(t, cible, stade.degats, stade.rebonds ?? 0, capacite?.eclair ?? fiche.eclair);
        continue;
      }
      const tir = fiche.projectile!;
      const base = {
        type: t.type,
        capacite: t.capacite,
        depart: { ...t.centre },
        degats: stade.degats,
        guide: tir.guide,
        vitesse: capacite?.vitesse ?? tir.vitesse,
        rayon: capacite?.rayon ?? tir.rayon,
        percant: capacite?.percant ?? false,
        ralenti: fiche.ralenti ?? null,
        poison: capacite?.poison ?? null,
        flaque: capacite?.flaque ?? null,
      };
      const lancer = (m: Monstre, but: Position) => this.projectiles.push({ ...base, id: this.prochainId++, position: { ...t.centre }, but, cible: m.id });
      const viserMonstre = (m: Monstre) => (base.guide ? { ...m.position } : this.ouSera(m, t.centre, base.vitesse));
      const tirs = capacite?.tirs ?? 1;
      if (capacite?.ecart) {
        // Salve : les obus tombent devant, sur et derrière la cible, le long de son chemin.
        const arrivee = this.avancementA(cible, t.centre, base.vitesse);
        for (let i = 0; i < tirs; i++) {
          const decalage = (i - (tirs - 1) / 2) * capacite.ecart;
          lancer(cible, { ...pointSur(cible.trace, Math.max(0, Math.min(cible.longueur, arrivee + decalage))) });
        }
        continue;
      }
      // Essaim, Mitraille : un projectile par monstre, les plus proches de la souche d'abord ; s'il en manque,
      // les suivants repartent sur la première cible.
      const touches = new Set<Monstre>([cible]);
      const cibles = [cible];
      while (cibles.length < tirs) {
        const autre = this.viser(t.centre, stade.portee, TOURS[t.type].aerien ?? false, touches);
        if (!autre) break;
        touches.add(autre);
        cibles.push(autre);
      }
      for (let i = 0; i < tirs; i++) {
        const m = cibles[i % cibles.length]!;
        lancer(m, viserMonstre(m));
      }
    }
  }

  /** Coup immédiat qui rebondit de monstre en monstre ; il traverse l'armure. */
  private eclair(t: Tour, cible: Monstre, degats: number, rebonds: number, { distance: saut, attenuation }: { distance: number; attenuation: number }): void {
    const touches = new Set<Monstre>([cible]);
    t.chaine = [{ ...t.centre }, { ...cible.position }];
    this.blesser(cible, degats, true, t.type);
    let dernier = cible;
    for (let i = 0; i < rebonds; i++) {
      const suivant = this.viser(dernier.position, saut, true, touches);
      if (!suivant) break;
      degats *= attenuation;
      touches.add(suivant);
      t.chaine.push({ ...suivant.position });
      this.blesser(suivant, degats, true, t.type);
      dernier = suivant;
    }
  }

  /** Où sera le monstre quand un projectile tiré de `depuis` l'atteindra. */
  private ouSera(m: Monstre, depuis: Position, vitesseProjectile: number): Position {
    return { ...pointSur(m.trace, this.avancementA(m, depuis, vitesseProjectile)) };
  }

  /** Avancement du monstre (en cases le long de sa trace) quand un projectile tiré de `depuis` l'atteindra. */
  private avancementA(m: Monstre, depuis: Position, vitesseProjectile: number): number {
    let point = m.position;
    let avancement = m.avancement;
    for (let i = 0; i < 2; i++) {
      const duree = distance(depuis, point) / vitesseProjectile;
      avancement = Math.min(m.longueur, m.avancement + this.vitesse(m) * duree);
      point = pointSur(m.trace, avancement);
    }
    return avancement;
  }

  private voler(): void {
    const parId = new Map(this.monstres.map((m) => [m.id, m]));
    const restants: Projectile[] = [];
    for (const p of this.projectiles) {
      if (p.guide) {
        const cible = parId.get(p.cible);
        // Sa cible morte, l'abeille s'en va.
        if (!cible || cible.pv <= 0) continue;
        p.but = { ...cible.position };
      }
      const pasVol = p.vitesse / PAS_PAR_SECONDE;
      const reste = distance(p.position, p.but);
      if (reste > pasVol) {
        p.position.x += ((p.but.x - p.position.x) / reste) * pasVol;
        p.position.y += ((p.but.y - p.position.y) / reste) * pasVol;
        restants.push(p);
        continue;
      }
      if (p.guide) {
        this.toucher(parId.get(p.cible)!, p);
        continue;
      }
      for (const m of this.monstres) {
        if (m.pv <= 0 || distance(m.position, p.but) > p.rayon) continue;
        if (MONSTRES[m.type].volant && !TOURS[p.type].aerien) continue;
        this.toucher(m, p);
      }
      if (p.flaque) {
        const duree = Math.round(p.flaque.duree * PAS_PAR_SECONDE);
        this.flaques.push({ id: this.prochainId++, position: { ...p.but }, rayon: p.flaque.rayon, facteur: p.flaque.facteur, debut: this.pas, fin: this.pas + duree });
      }
      this.impacts.push({ type: p.type, capacite: p.capacite, position: { ...p.but }, rayon: p.rayon, pas: this.pas });
    }
    this.projectiles = restants;
  }

  /** Un projectile atteint un monstre : dégâts, puis ralenti ou poison selon la tour. */
  private toucher(m: Monstre, p: Projectile): void {
    this.blesser(m, p.degats, p.percant, p.type);
    if (p.ralenti) {
      m.ralentiJusqua = this.pas + Math.round(p.ralenti.duree * PAS_PAR_SECONDE);
      m.facteurRalenti = p.ralenti.facteur;
    }
    if (p.poison) {
      m.poisonJusqua = this.pas + Math.round(p.poison.duree * PAS_PAR_SECONDE);
      m.poisonParPas = p.poison.degatsParSeconde / PAS_PAR_SECONDE;
    }
  }

  /** Retire de la vie au monstre ; `source` = la sorte de tour, pour le bilan des dégâts (sans compter l'excédent). */
  private blesser(m: Monstre, degats: number, percant: boolean, source: TypeTour): void {
    if (m.pv <= 0) return;
    const coup = percant ? degats : Math.max(1, degats - MONSTRES[m.type].armure);
    this.degats[source] += Math.min(coup, m.pv);
    m.pv -= coup;
  }

  /** Le boss blessé sous un palier pond son escorte juste derrière lui (plusieurs paliers d'un coup : tout). */
  private pondre(): void {
    const nes: Monstre[] = [];
    for (const m of this.monstres) {
      const paliers = MONSTRES[m.type].boss?.paliers;
      if (!paliers || m.pv <= 0) continue;
      while (m.paliers < paliers.length && m.pv <= paliers[m.paliers]!.part * MONSTRES[m.type].pv) {
        const petits: number[] = [];
        let rang = 0;
        for (const { type, nombre } of paliers[m.paliers]!.escorte)
          for (let k = 0; k < nombre; k++) {
            const petit = this.nouveauMonstre(type, m.trace, Math.max(0, m.avancement - 0.3 - 0.35 * rang++));
            nes.push(petit);
            petits.push(petit.id);
          }
        m.paliers++;
        this.evenements.push({ type: 'ponte', id: m.id, monstre: m.type, position: { ...m.position }, petits, pas: this.pas });
      }
    }
    this.monstres.push(...nes);
  }

  /** Retire les morts : leurs spores tombent, l'amas se divise en deux petits. */
  private enterrer(): void {
    const vivants: Monstre[] = [];
    for (const m of this.monstres) {
      if (m.pv > 0) {
        vivants.push(m);
        continue;
      }
      const butin = MONSTRES[m.type].butin;
      this.spores += butin;
      this.evenements.push({ type: 'mort', id: m.id, monstre: m.type, position: { ...m.position }, butin, pas: this.pas });
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

/**
 * Les deux cases entre lesquelles marche le monstre : celle qu'il quitte et celle où il va.
 * Vide pendant le dernier demi-pas, contre la souche.
 */
function casesAutour(m: Monstre): Case[] {
  let reste = m.avancement;
  for (let i = 1; i < m.trace.length; i++) {
    const a = m.trace[i - 1]!;
    const b = m.trace[i]!;
    const segment = Math.hypot(b.x - a.x, b.y - a.y);
    if (reste <= segment || i === m.trace.length - 1) {
      if (i === m.trace.length - 1) return [];
      return [versCase(a), versCase(b)];
    }
    reste -= segment;
  }
  return [];
}

function versCase(p: Position): Case {
  return { x: Math.floor(p.x), y: Math.floor(p.y) };
}

function stadeDe(t: Tour): StadeTour {
  return t.capacite ? CAPACITES[t.capacite] : TOURS[t.type].stades[t.stade - 1]!;
}

function prixAmelioration(t: Tour): number | null {
  return t.stade < 3 ? TOURS[t.type].stades[t.stade]!.prix : null;
}

function revente(t: Tour): number {
  return Math.floor(t.depense * (t.capacite ? PART_REVENTE_CAPACITE : PART_REVENTE) + 1e-9);
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

/** Vol en ligne droite, du centre de la case de sable jusqu'au point le plus proche du bord de la souche. */
function enVol(ile: Ile, depart: Case): Position[] {
  const a = { x: depart.x + 0.5, y: depart.y + 0.5 };
  const { souche, tailleSouche: t } = ile;
  const b = { x: Math.min(Math.max(a.x, souche.x), souche.x + t), y: Math.min(Math.max(a.y, souche.y), souche.y + t) };
  return [a, b];
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
