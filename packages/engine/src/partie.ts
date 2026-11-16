// Une partie sur une île : vagues, monstres qui suivent le sentier, tours qui tirent, spores, vie de la souche.
// Pur et déterministe : mêmes île, vagues, graine et commandes → même partie, pas pour pas.
import type { Arrivee, Capacite, Case, Commande, Regles, EvenementVu, FlaqueVu, FleurVue, ImpactVu, Ile, Instantane, LanterneVue, Lumiere, ModeCible, MonstreVu, Phase, Position, TourVue, TypeMonstre, TypeTour } from './contrat';
import { estSentier, MODES_CIBLE } from './contrat';
import {
  BONUS_PAR_SECONDE_GAGNEE,
  BONUS_VAGUE,
  CAPACITES,
  CAPACITES_DE,
  FACTEUR_GUE,
  FLEUR,
  LANTERNE,
  MONSTRES,
  PART_RONCE_RENDUE,
  PART_REVENTE,
  PART_REVENTE_CAPACITE,
  PAS_PAR_SECONDE,
  PAUSE_SECONDES,
  PLATEFORME,
  prixPour,
  PRIX_RONCE,
  PV_SOUCHE,
  SPORES_DEPART,
  TOURS,
  TYPES_TOURS,
  TOUTES_CAPACITES,
  type StadeTour,
  type Vague,
} from './contenu';
import { creerHasard } from './hasard';
import { vieSansFin } from './sansFin';
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
  /** Crapaud : pas où a commencé le bond en cours (-1 : aucun), pas du prochain bond. */
  sautDebut: number;
  prochainSaut: number;
  /** Crapaud-roi : pas où il ressort de sa plongée (-1 : il n'est pas sous l'eau) et l'escorte qu'il pondra alors. */
  plongeeFin: number;
  escorte: TypeMonstre[];
  /**
   * Chenille hors du sentier : `aller` vers la fleur `fleur`, `repas` (jusqu'au pas `repasFin`), `retour` vers le
   * sentier le plus proche ; null sur le sentier. `rassasiee` : elle a déjà mangé.
   */
  horsSentier: 'aller' | 'repas' | 'retour' | null;
  fleur: number | null;
  /** Écureuil : tour visée, puis sur laquelle il est perché (`repas`). */
  tour: number | null;
  /** Araignée : pas où elle touche le sentier, au bout de son fil (-1 : posée). */
  descenteFin: number;
  repasFin: number;
  rassasiee: boolean;
  /** Grand Corbeau : où il en est (voir `planer`) ; null pour les autres. */
  rapace: Rapace | null;
  /** Cloporte : roulé en boule jusqu'à ce pas, plus rapide jusqu'à `elanFin`, pas de nouvelle boule avant `bouleRecharge`. */
  bouleFin: number;
  elanFin: number;
  bouleRecharge: number;
}

interface Rapace {
  etat: 'rejoindre' | 'vol' | 'pique' | 'sol' | 'assaut';
  /** Angle sur son cercle autour de la souche. */
  angle: number;
  /** Pas où finit l'attente en vol ou la pause au sol. */
  fin: number;
  /** Fleur visée par le piqué. */
  fleur: number | null;
  plongees: number;
  /** Distance au début du piqué ou de l'assaut (pour l'altitude). */
  depart: number;
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
  mode: ModeCible;
  dernierTir: number;
  chaine: Position[];
  /** Spores payées (pose et améliorations), pour la revente. */
  depense: number;
  /** Sur une plateforme de la futaie. */
  haute: boolean;
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
  /** Harpon du héron : file en ligne droite et blesse une fois chaque monstre frôlé ; `rebonds` = départs restants. */
  harpon: { largeur: number; rebonds: number; saut: number; touches: Set<Monstre> } | null;
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
  private fleurs: { id: number; case: Case }[] = [];
  /** Plateformes abattues par le Colosse d'écorce. */
  private tombees = new Set<string>();
  /** Champignons-lanternes (grotte) ; `eteinteJusqua` = pas jusqu'auquel elle n'éclaire plus. */
  private lanternes: { id: number; case: Case; eteinteJusqua: number }[] = [];
  /** Centres des luisants de la carte. */
  private readonly luisants: Position[];
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
  private degats: Record<TypeTour, number> = { ruche: 0, cristal: 0, mortier: 0, canon: 0, heron: 0 };
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
    this.regles = { spores: SPORES_DEPART, tours: [...TYPES_TOURS], ronces: true, fleurs: false, noir: false, capacites: [...TOUTES_CAPACITES], vieMonstres: 1, sansFin: false, ...regles };
    this.spores = this.regles.spores;
    this.sentier = lireSentier(ile);
    this.emplacementsRonces = emplacementsRonces(ile, this.sentier.carrefours);
    this.hasard = creerHasard(graine);
    this.luisants = [];
    ile.terrain.forEach((t, i) => {
      if (t === 'luisant') this.luisants.push({ x: (i % ile.largeur) + 0.5, y: Math.floor(i / ile.largeur) + 0.5 });
    });
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
        const c = commande.case;
        const haute = surPlateforme(this.ile, c);
        const prix = prixPour(TOURS[commande.tour].stades[0].prix, haute);
        if (!this.regles.tours.includes(commande.tour) || !this.libre(c, commande.tour) || this.spores < prix) return false;
        this.spores -= prix;
        this.tours.push({
          id: this.prochainId++,
          type: commande.tour,
          stade: 1,
          capacite: null,
          case: { x: c.x, y: c.y },
          haute,
          centre: { x: c.x + 0.5, y: c.y + 0.5 },
          recharge: 0,
          cible: null,
          mode: TOURS[commande.tour].cible ?? 'premier',
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
        if (!this.regles.capacites.includes(commande.capacite)) return false;
        const prix = prixPour(CAPACITES[commande.capacite].prix, tour.haute);
        if (this.spores < prix) return false;
        this.spores -= prix;
        tour.stade = 4;
        tour.capacite = commande.capacite;
        tour.depense += prix;
        return true;
      }
      case 'ciblerTour': {
        const tour = this.tours.find((t) => t.id === commande.id);
        if (!tour || !MODES_CIBLE.includes(commande.mode)) return false;
        tour.mode = commande.mode;
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
      case 'planterFleur': {
        const c = commande.case;
        if (this.spores < FLEUR.prix || !this.fleurLibre(c)) return false;
        this.spores -= FLEUR.prix;
        this.fleurs.push({ id: this.prochainId++, case: { x: c.x, y: c.y } });
        return true;
      }
      case 'arracherFleur': {
        const fleur = this.fleurs.find((f) => f.id === commande.id);
        if (!fleur) return false;
        this.spores += Math.floor(FLEUR.prix * FLEUR.partRendue);
        this.fleurs = this.fleurs.filter((f) => f !== fleur);
        return true;
      }
      case 'poserLanterne': {
        const c = commande.case;
        if (this.spores < LANTERNE.prix || !this.lanterneLibre(c)) return false;
        this.spores -= LANTERNE.prix;
        this.lanternes.push({ id: this.prochainId++, case: { x: c.x, y: c.y }, eteinteJusqua: 0 });
        return true;
      }
      case 'enleverLanterne': {
        const lanterne = this.lanternes.find((l) => l.id === commande.id);
        if (!lanterne) return false;
        this.spores += Math.floor(LANTERNE.prix * LANTERNE.partRendue);
        this.lanternes = this.lanternes.filter((l) => l !== lanterne);
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
      if (this.enLAir(m) || m.horsSentier) continue;
      const voisines = casesAutour(m);
      if (voisines.some((v) => cle(v) === k)) return false;
      if (voisines.length > 0 && !this.nouvelleTrace(m, bloquees)) return false;
    }
    return true;
  }

  /** Une tour (de cette sorte, ou de n'importe laquelle) peut-elle être posée sur cette case ? */
  libre(c: Case, tour?: TypeTour): boolean {
    return constructible(this.ile, c, tour) && !this.occupee(c) && !this.tombees.has(cle(c));
  }

  /** Une fleur à spores peut-elle être plantée ici ? Là où pousse une tour de terre, si le niveau le permet. */
  fleurLibre(c: Case): boolean {
    return this.regles.fleurs && constructible(this.ile, c, 'ruche') && !surPlateforme(this.ile, c) && !this.occupee(c);
  }

  /** Un champignon-lanterne peut-il être posé ici ? Là où pousse une tour de terre, dans la grotte. */
  lanterneLibre(c: Case): boolean {
    return this.regles.noir && constructible(this.ile, c, 'ruche') && !surPlateforme(this.ile, c) && !this.occupee(c);
  }

  /** Une tour, une fleur ou une lanterne est-elle déjà sur cette case ? */
  private occupee(c: Case): boolean {
    const ici = (o: { case: Case }) => o.case.x === c.x && o.case.y === c.y;
    return this.tours.some(ici) || this.fleurs.some(ici) || this.lanternes.some(ici);
  }

  /** Zones éclairées : luisants de la carte, puis lanternes (vide hors de la grotte). */
  private lumieres(): Lumiere[] {
    if (!this.regles.noir) return [];
    return [
      ...this.luisants.map((p): Lumiere => ({ position: { ...p }, rayon: LANTERNE.luisant, lanterne: null, allumee: true })),
      ...this.lanternes.map((l): Lumiere => ({
        position: { x: l.case.x + 0.5, y: l.case.y + 0.5 },
        rayon: LANTERNE.rayon,
        lanterne: l.id,
        allumee: this.pas >= l.eteinteJusqua,
      })),
    ];
  }

  /** Ce point est-il éclairé ? Toujours hors de la grotte. */
  private eclaire(p: Position): boolean {
    if (!this.regles.noir) return true;
    for (const l of this.luisants) if (distance(l, p) <= LANTERNE.luisant) return true;
    for (const l of this.lanternes) {
      if (this.pas >= l.eteinteJusqua && distance({ x: l.case.x + 0.5, y: l.case.y + 0.5 }, p) <= LANTERNE.rayon) return true;
    }
    return false;
  }

  /** Un pas de simulation. */
  avancer(): void {
    if (this.phase === 'victoire' || this.phase === 'defaite') return;
    this.pas++;
    this.pasPhase++;
    if (this.phase === 'vague') {
      while (this.lachers[0] && this.lachers[0].pas <= this.pasPhase) this.lacher(this.lachers.shift()!);
      this.deplacer();
      this.souffler();
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
      // Avant la vague 1, pas de limite : on prépare tant qu'on veut, la vague part sur commande.
      if (this.vague > 1 && this.pasPhase >= PAUSE_SECONDES * PAS_PAR_SECONDE) this.commencerVague();
      return;
    }
    if (this.pvSouche <= 0) {
      this.pvSouche = 0;
      this.phase = 'defaite';
    } else if (this.lachers.length === 0 && this.monstres.length === 0) {
      if (this.vague >= this.vagues.length && !this.regles.sansFin) this.phase = 'victoire';
      else {
        this.spores += BONUS_VAGUE.fixe + BONUS_VAGUE.parVague * this.vague;
        this.recolter();
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
      pvMax: this.pvMax(m.type),
      ralenti: this.facteurVitesse(m) < 1,
      empoisonne: this.pas < m.poisonJusqua,
      immerge: this.immerge(m),
      saut: this.enSaut(m) ? (this.pas - m.sautDebut) / dureeSaut(m.type) : null,
      mange: m.horsSentier === 'repas',
      altitude: this.altitude(m),
      dansLeNoir: !this.eclaire(m.position),
      enBoule: this.enBoule(m),
      descente: this.descend(m) ? (m.descenteFin - this.pas) / (MONSTRES[m.type].fil!.duree * PAS_PAR_SECONDE) : null,
      perche: !!MONSTRES[m.type].grimpeur && m.horsSentier === 'repas',
    }));
    const tours: TourVue[] = this.tours.map((t) => ({
      id: t.id,
      type: t.type,
      stade: t.stade,
      capacite: t.capacite,
      case: { ...t.case },
      haute: t.haute,
      bloquee: this.bloquee(t),
      portee: porteeDe(t),
      cible: t.cible,
      mode: t.mode,
      dernierTir: t.dernierTir,
      chaine: t.chaine.map((p) => ({ ...p })),
      prixAmelioration: prixAmelioration(t),
      prixCapacites: t.stade === 3 ? [prixPour(CAPACITES[CAPACITES_DE[t.type][0]].prix, t.haute), prixPour(CAPACITES[CAPACITES_DE[t.type][1]].prix, t.haute)] : null,
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
              : e.type === 'recolte' || e.type === 'devore' || e.type === 'extinction'
                ? { ...e, case: { ...e.case } }
                : e.type === 'pique'
                  ? { ...e, cible: { ...e.cible } }
                : { ...e },
      ),
      flaques: this.flaques.map(
        (f): FlaqueVu => ({ id: f.id, position: { ...f.position }, rayon: f.rayon, reste: Math.max(0, (f.fin - this.pas) / (f.fin - f.debut)) }),
      ),
      ronces: [...this.ronces].map((k) => {
        const [x, y] = k.split(',').map(Number) as [number, number];
        return { x, y };
      }),
      fleurs: this.fleurs.map((f): FleurVue => ({ id: f.id, case: { ...f.case }, revente: Math.floor(FLEUR.prix * FLEUR.partRendue) })),
      plateformesTombees: [...this.tombees].map((k) => {
        const [x, y] = k.split(',').map(Number) as [number, number];
        return { x, y };
      }),
      lanternes: this.lanternes.map(
        (l): LanterneVue => ({ id: l.id, case: { ...l.case }, revente: Math.floor(LANTERNE.prix * LANTERNE.partRendue), allumee: this.pas >= l.eteinteJusqua }),
      ),
      lumieres: this.lumieres(),
      bonusLancer: this.bonusLancer(),
      etoiles: this.phase === 'victoire' ? etoiles(this.pvSouche) : 0,
      monstresVague: this.monstresVague(),
      arrivees: this.arrivees(),
      regles: { ...this.regles, tours: [...this.regles.tours], capacites: [...this.regles.capacites] },
      degats: { ...this.degats },
    };
  }

  /** Fin de vague : chaque fleur à spores rapporte. */
  private recolter(): void {
    for (const f of this.fleurs) {
      this.spores += FLEUR.rapport;
      this.evenements.push({ type: 'recolte', id: f.id, case: { ...f.case }, gain: FLEUR.rapport, pas: this.pas });
    }
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

  /** Spores gagnées en lançant la vague maintenant : une par seconde de pause écourtée (aucune avant la vague 1). */
  private bonusLancer(): number {
    return (this.pauseRestante() ?? 0) * BONUS_PAR_SECONDE_GAGNEE;
  }

  /** Secondes avant le départ automatique ; `null` avant la vague 1 (pas de limite). */
  private pauseRestante(): number | null {
    if (this.phase !== 'pause') return 0;
    if (this.vague === 1) return null;
    return Math.ceil(PAUSE_SECONDES - this.pasPhase / PAS_PAR_SECONDE);
  }

  /** Lâchers de la vague `n` (1 = première), triés par pas ; les groupes sans plage tournent sur toutes. */
  private lachersDe(n: number): Lacher[] {
    const plages = this.sentier.plages.length;
    let tour = 0;
    return (this.vagues[n - 1] ?? [])
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

  /** Plages de la vague en cours ou à venir, dans l'ordre de la carte, avec leurs sortes de monstres. */
  private arrivees(): Arrivee[] {
    if (this.phase !== 'pause' && this.phase !== 'vague') return [];
    const parPlage = new Map<number, Set<TypeMonstre>>();
    for (const { plage, type } of this.lachersDe(this.vague)) {
      if (MONSTRES[type].fil) continue;
      if (!parPlage.has(plage)) parPlage.set(plage, new Set());
      parPlage.get(plage)!.add(type);
    }
    return [...parPlage]
      .sort(([a], [b]) => a - b)
      .map(([plage, types]) => ({ plage, depart: { ...this.sentier.plages[plage]!.depart }, types: [...types] }));
  }

  private commencerVague(): void {
    this.phase = 'vague';
    this.pasPhase = 0;
    this.lachers = this.lachersDe(this.vague);
  }

  private lacher({ type, plage }: Lacher): void {
    // Mode sans fin : un boss qui marche prend toujours la plus longue des routes (ronces comprises).
    if (this.regles.sansFin && MONSTRES[type].boss && !MONSTRES[type].rapace) plage = this.plageLaPlusLongue();
    const { depart } = this.sentier.plages[plage]!;
    if (MONSTRES[type].rapace) {
      const a = { x: depart.x + 0.5, y: depart.y + 0.5 };
      const m = this.nouveauMonstre(type, [a, this.centreSouche()], 0);
      m.rapace = { etat: 'rejoindre', angle: Math.atan2(a.y - this.centreSouche().y, a.x - this.centreSouche().x), fin: 0, fleur: null, plongees: 0, depart: 0 };
      this.monstres.push(m);
      return;
    }
    if (MONSTRES[type].volant) {
      this.monstres.push(this.nouveauMonstre(type, enVol(this.ile, depart), 0));
      return;
    }
    const chemin = route(this.ile, depart, this.ronces);
    if (!chemin) return;
    const fil = MONSTRES[type].fil;
    if (fil) {
      // L'araignée se pose au centre d'une case de la route, quelque part au milieu.
      const trace = tracer(this.ile, chemin);
      const rang = Math.min(trace.length - 2, Math.round((chemin.length - 1) * (fil.de + this.hasard() * (fil.a - fil.de))));
      const m = this.nouveauMonstre(type, trace, longueur(trace.slice(0, Math.max(1, rang) + 1)));
      m.descenteFin = this.pas + Math.round(fil.duree * PAS_PAR_SECONDE);
      this.monstres.push(m);
      this.evenements.push({ type: 'fil', id: m.id, monstre: type, position: { ...m.position }, pas: this.pas });
      return;
    }
    this.monstres.push(this.nouveauMonstre(type, tracer(this.ile, chemin), 0));
  }

  /** Plage dont la route jusqu'à la souche est la plus longue, avec les ronces posées. */
  private plageLaPlusLongue(): number {
    let meilleure = 0;
    let longue = -1;
    this.sentier.plages.forEach((p, k) => {
      const n = route(this.ile, p.depart, this.ronces)?.length ?? -1;
      if (n > longue) [meilleure, longue] = [k, n];
    });
    return meilleure;
  }

  /** Araignée encore au bout de son fil : hors d'atteinte, immobile. */
  private descend(m: Monstre): boolean {
    return m.descenteFin >= 0 && this.pas < m.descenteFin;
  }

  /** Tour sur laquelle un écureuil est perché : elle ne tire pas. */
  private bloquee(t: Tour): boolean {
    return this.monstres.some((m) => m.tour === t.id && m.horsSentier === 'repas' && m.pv > 0);
  }

  /** Vie pleine d'un monstre, selon la difficulté de la partie (et la vague, en mode sans fin). */
  private pvMax(type: TypeMonstre): number {
    const vague = this.regles.sansFin ? vieSansFin(this.vague, !!MONSTRES[type].boss) : 1;
    return Math.max(1, Math.round(MONSTRES[type].pv * this.regles.vieMonstres * vague));
  }

  private nouveauMonstre(type: TypeMonstre, trace: Position[], avancement: number): Monstre {
    return {
      id: this.prochainId++,
      type,
      pv: this.pvMax(type),
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
      sautDebut: -1,
      plongeeFin: -1,
      escorte: [],
      horsSentier: null,
      fleur: null,
      tour: null,
      descenteFin: -1,
      repasFin: -1,
      rassasiee: false,
      rapace: null,
      bouleFin: -1,
      elanFin: -1,
      bouleRecharge: -1,
      // Décalé selon l'id : une file de crapauds ne bondit pas d'un seul bloc.
      prochainSaut: this.pas + Math.round((MONSTRES[type].saut?.cadence ?? 0) * PAS_PAR_SECONDE) + (this.prochainId % 9),
    };
  }

  /** Après une ronce posée ou enlevée : chaque monstre repart par le plus court chemin encore ouvert. */
  private rerouter(): void {
    for (const m of this.monstres) {
      if (this.enLAir(m) || m.horsSentier) continue;
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
    const plongee = MONSTRES[m.type].boss?.plongee;
    if (plongee && this.plonge(m)) return plongee.avance / plongee.duree;
    const saut = MONSTRES[m.type].saut;
    // En plein bond, rien ne le freine.
    if (saut && this.enSaut(m)) return saut.distance / saut.duree;
    const elan = this.pas < m.elanFin ? (MONSTRES[m.type].boule?.elan ?? 1) : 1;
    return MONSTRES[m.type].vitesse * elan * this.facteurVitesse(m);
  }

  /** Le crapaud est-il en l'air ? */
  private enSaut(m: Monstre): boolean {
    return m.sautDebut >= 0 && this.pas < m.sautDebut + dureeSaut(m.type);
  }

  /** Une sangsue dans un gué : sous l'eau. */
  private immerge(m: Monstre): boolean {
    return this.nageSous(m) || this.plonge(m);
  }

  private nageSous(m: Monstre): boolean {
    return !!MONSTRES[m.type].nage && terrainSous(this.ile, m.position) === 'gue';
  }

  /** Le Crapaud-roi en plongée : aucune tour ne l'atteint. */
  private plonge(m: Monstre): boolean {
    return m.plongeeFin >= 0 && this.pas < m.plongeeFin;
  }

  /** Hors d'atteinte d'une tour : boss en plongée, ou nageur sous l'eau pour une tour sans `sousEau`. */
  private horsDAtteinte(m: Monstre, sousEau = false): boolean {
    return this.plonge(m) || this.descend(m) || (!sousEau && this.nageSous(m));
  }

  /** Le plus fort des ralentis en cours (coup de mortier, flaque de glu), multiplié par celui du gué. */
  private facteurVitesse(m: Monstre): number {
    let facteur = this.pas < m.ralentiJusqua ? m.facteurRalenti : 1;
    if (this.enLAir(m)) return facteur;
    for (const f of this.flaques) if (distance(m.position, f.position) <= f.rayon) facteur = Math.min(facteur, f.facteur);
    return terrainSous(this.ile, m.position) === 'gue' && !MONSTRES[m.type].nage ? facteur * FACTEUR_GUE : facteur;
  }

  /** Chaque soigneur, à son rythme, rend de la vie aux autres monstres blessés autour de lui. */
  private soigner(): void {
    for (const s of this.monstres) {
      const soin = MONSTRES[s.type].soin;
      if (!soin || s.pv <= 0 || --s.soinRecharge > 0) continue;
      s.soinRecharge = Math.round(soin.cadence * PAS_PAR_SECONDE);
      const soignes: number[] = [];
      for (const m of this.monstres) {
        const max = this.pvMax(m.type);
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
      if (m.rapace) {
        if (!this.planer(m)) {
          restants.push(m);
          continue;
        }
        // Il atteint la souche : comme tout boss, la partie est perdue.
        const degats = Math.max(this.pvSouche, MONSTRES[m.type].morsure);
        this.pvSouche -= degats;
        this.evenements.push({ type: 'morsure', id: m.id, monstre: m.type, degats, pas: this.pas });
        continue;
      }
      const saut = MONSTRES[m.type].saut;
      if (saut && !this.enSaut(m) && !this.plonge(m) && this.pas >= m.prochainSaut) {
        m.sautDebut = this.pas;
        m.prochainSaut = this.pas + Math.round((saut.cadence + saut.duree) * PAS_PAR_SECONDE);
      }
      if (
        (MONSTRES[m.type].gourmande && !this.gourmandise(m)) ||
        (MONSTRES[m.type].grimpeur && !this.grimper(m)) ||
        this.enBoule(m) ||
        this.descend(m)
      ) {
        restants.push(m);
        continue;
      }
      m.avancement += this.vitesse(m) / PAS_PAR_SECONDE;
      if (m.horsSentier && m.avancement >= m.longueur) {
        this.arriver(m);
        restants.push(m);
        continue;
      }
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

  /** Volant, ou Grand Corbeau qui n'est pas posé : seules les tours `aerien` l'atteignent. */
  private enLAir(m: Monstre): boolean {
    return !!MONSTRES[m.type].volant || (!!m.rapace && m.rapace.etat !== 'sol');
  }

  private centreSouche(): Position {
    const { souche, tailleSouche: t } = this.ile;
    return { x: souche.x + t / 2, y: souche.y + t / 2 };
  }

  /**
   * Un pas du Grand Corbeau : il rejoint son cercle, tourne, pique sur une fleur et s'y pose, puis fond sur la
   * souche. Renvoie true quand il l'atteint.
   */
  private planer(m: Monstre): boolean {
    const r = MONSTRES[m.type].rapace!;
    const e = m.rapace!;
    const centre = this.centreSouche();
    const pas = 1 / PAS_PAR_SECONDE;
    const orbite = (angle: number) => ({ x: centre.x + Math.cos(angle) * r.rayon, y: centre.y + Math.sin(angle) * r.rayon });
    let atteint = false;
    switch (e.etat) {
      case 'rejoindre':
        if (aller(m, orbite(e.angle), r.pique * pas)) {
          e.etat = 'vol';
          e.fin = this.pas + Math.round(r.attente * PAS_PAR_SECONDE);
        }
        break;
      case 'vol':
        e.angle += (MONSTRES[m.type].vitesse * pas) / r.rayon;
        m.position = orbite(e.angle);
        if (this.pas >= e.fin) this.choisirProie(m);
        break;
      case 'pique': {
        const fleur = this.fleurs.find((f) => f.id === e.fleur);
        // Fleur arrachée avant lui : il en cherche une autre, ou fond sur la souche.
        if (!fleur) {
          this.choisirProie(m);
          break;
        }
        if (aller(m, { x: fleur.case.x + 0.5, y: fleur.case.y + 0.5 }, r.pique * pas)) {
          this.fleurs = this.fleurs.filter((f) => f !== fleur);
          this.evenements.push({ type: 'devore', id: m.id, monstre: m.type, fleur: fleur.id, case: { ...fleur.case }, pas: this.pas });
          e.plongees++;
          e.etat = 'sol';
          e.fin = this.pas + Math.round(r.auSol * PAS_PAR_SECONDE);
        }
        break;
      }
      case 'sol':
        if (this.pas >= e.fin) {
          e.etat = 'rejoindre';
          e.angle = Math.atan2(m.position.y - centre.y, m.position.x - centre.x);
        }
        break;
      case 'assaut':
        atteint = aller(m, this.bordSouche(m.position), r.assaut * this.facteurVitesse(m) * pas);
        break;
    }
    // Pour les tours (viser le plus proche de la souche) : il lui reste la distance à la souche.
    m.trace = [{ ...m.position }, centre];
    m.longueur = distance(m.position, centre);
    m.avancement = 0;
    return atteint;
  }

  /** Le corbeau pique sur la fleur la plus proche, ou, après ses plongées (ou sans fleur), sur la souche. */
  private choisirProie(m: Monstre): void {
    const r = MONSTRES[m.type].rapace!;
    const e = m.rapace!;
    let proie: { id: number; case: Case } | null = null;
    let d = Infinity;
    if (e.plongees < r.plongees)
      for (const f of this.fleurs) {
        const df = distance(m.position, { x: f.case.x + 0.5, y: f.case.y + 0.5 });
        if (df < d) [proie, d] = [f, df];
      }
    if (proie) {
      e.etat = 'pique';
      e.fleur = proie.id;
      e.depart = Math.max(d, 0.01);
      this.evenements.push({ type: 'pique', id: m.id, monstre: m.type, cible: { x: proie.case.x + 0.5, y: proie.case.y + 0.5 }, souche: false, pas: this.pas });
      return;
    }
    const bord = this.bordSouche(m.position);
    e.etat = 'assaut';
    e.fleur = null;
    e.depart = Math.max(distance(m.position, bord), 0.01);
    this.evenements.push({ type: 'pique', id: m.id, monstre: m.type, cible: bord, souche: true, pas: this.pas });
  }

  /** Point du bord de la souche le plus proche de `p`. */
  private bordSouche(p: Position): Position {
    const { souche, tailleSouche: t } = this.ile;
    return { x: Math.min(Math.max(p.x, souche.x), souche.x + t), y: Math.min(Math.max(p.y, souche.y), souche.y + t) };
  }

  /** Hauteur de vol du corbeau, de 1 (il tourne) à 0 (posé) ; il descend pendant le piqué. */
  private altitude(m: Monstre): number | null {
    const e = m.rapace;
    if (!e) return null;
    if (e.etat === 'sol') return 0;
    if (e.etat === 'pique' || e.etat === 'assaut') {
      const fleur = this.fleurs.find((f) => f.id === e.fleur);
      const but = e.etat === 'assaut' ? this.bordSouche(m.position) : fleur ? { x: fleur.case.x + 0.5, y: fleur.case.y + 0.5 } : m.position;
      const part = Math.min(1, distance(m.position, but) / e.depart);
      return e.etat === 'assaut' ? 0.25 + 0.75 * part : part;
    }
    return 1;
  }

  /**
   * Chenille, avant d'avancer : flaire une fleur proche, ou finit son repas. Renvoie false si elle reste sur place
   * (elle mange).
   */
  private gourmandise(m: Monstre): boolean {
    const fiche = MONSTRES[m.type].gourmande!;
    if (m.horsSentier === 'repas') {
      if (this.pas < m.repasFin) return false;
      const fleur = this.fleurs.find((f) => f.id === m.fleur);
      if (fleur) {
        this.fleurs = this.fleurs.filter((f) => f !== fleur);
        this.evenements.push({ type: 'devore', id: m.id, monstre: m.type, fleur: fleur.id, case: { ...fleur.case }, pas: this.pas });
      }
      m.rassasiee = true;
      this.rentrer(m);
      return true;
    }
    // Sa fleur a disparu (arrachée, mangée par une autre) : elle rejoint le sentier.
    if (m.horsSentier === 'aller' && !this.fleurs.some((f) => f.id === m.fleur)) {
      this.rentrer(m);
      return true;
    }
    if (m.horsSentier || m.rassasiee || this.fleurs.length === 0) return true;
    let proche: { id: number; case: Case } | null = null;
    let d = fiche.flair;
    for (const f of this.fleurs) {
      const df = distance(m.position, { x: f.case.x + 0.5, y: f.case.y + 0.5 });
      if (df <= d) [proche, d] = [f, df];
    }
    if (!proche) return true;
    m.horsSentier = 'aller';
    m.fleur = proche.id;
    this.suivre(m, [{ ...m.position }, { x: proche.case.x + 0.5, y: proche.case.y + 0.5 }]);
    return true;
  }

  /**
   * Écureuil, avant d'avancer : repère une tour en hauteur libre, ou reste perché. Renvoie false s'il reste sur place
   * (perché).
   */
  private grimper(m: Monstre): boolean {
    const fiche = MONSTRES[m.type].grimpeur!;
    if (m.horsSentier === 'repas') {
      if (this.pas < m.repasFin && this.tours.some((t) => t.id === m.tour)) return false;
      m.rassasiee = true;
      this.rentrer(m);
      return true;
    }
    // Sa tour a été vendue en chemin : il rejoint le sentier.
    if (m.horsSentier === 'aller' && !this.tours.some((t) => t.id === m.tour)) {
      this.rentrer(m);
      return true;
    }
    if (m.horsSentier || m.rassasiee) return true;
    let proche: Tour | null = null;
    let d = fiche.flair;
    for (const t of this.tours) {
      if (!t.haute || this.monstres.some((o) => o !== m && o.tour === t.id)) continue;
      const dt = distance(m.position, t.centre);
      if (dt <= d) [proche, d] = [t, dt];
    }
    if (!proche) return true;
    m.horsSentier = 'aller';
    m.tour = proche.id;
    this.suivre(m, [{ ...m.position }, { ...proche.centre }]);
    return true;
  }

  /**
   * Chenille ou écureuil au bout de sa trace hors du sentier : repas (ou perchée sur sa tour), ou retour sur la route
   * de la souche.
   */
  private arriver(m: Monstre): void {
    if (m.horsSentier === 'aller') {
      const fiche = MONSTRES[m.type];
      m.horsSentier = 'repas';
      m.repasFin = this.pas + Math.round((fiche.gourmande ?? fiche.grimpeur)!.duree * PAS_PAR_SECONDE);
      if (fiche.grimpeur && m.tour !== null) this.evenements.push({ type: 'grimpe', id: m.id, monstre: m.type, tour: m.tour, pas: this.pas });
      return;
    }
    // Retour : la voilà sur le sentier.
    const c = versCase(m.position);
    const chemin = route(this.ile, c, this.ronces);
    m.horsSentier = null;
    m.fleur = null;
    if (chemin) this.suivre(m, tracer(this.ile, chemin));
  }

  /** La chenille repart vers la case de sentier ouverte la plus proche (d'où la souche reste accessible). */
  private rentrer(m: Monstre): void {
    let meilleure: Case | null = null;
    let d = Infinity;
    for (let y = 0; y < this.ile.profondeur; y++)
      for (let x = 0; x < this.ile.largeur; x++) {
        const c = { x, y };
        if (!estSentier(terrainSous(this.ile, { x: x + 0.5, y: y + 0.5 })) || this.ronces.has(cle(c))) continue;
        const dc = distance(m.position, { x: x + 0.5, y: y + 0.5 });
        if (dc < d && route(this.ile, c, this.ronces)) [meilleure, d] = [c, dc];
      }
    m.horsSentier = 'retour';
    m.fleur = null;
    m.tour = null;
    this.suivre(m, meilleure ? [{ ...m.position }, { x: meilleure.x + 0.5, y: meilleure.y + 0.5 }] : [{ ...m.position }, { ...m.position }]);
  }

  private suivre(m: Monstre, trace: Position[]): void {
    m.trace = trace;
    m.longueur = longueur(trace);
    m.avancement = 0;
  }

  /**
   * Le monstre vivant à portée de `centre` que préfère `mode` (à égalité, le plus proche de la souche ; les nageurs
   * sous l'eau : avec `sousEau`).
   */
  private viser(
    centre: Position,
    portee: number,
    aerien: boolean,
    exclus?: Set<Monstre>,
    sousEau = false,
    mode: ModeCible = 'premier',
  ): Monstre | null {
    const valeur = (m: Monstre) => (mode === 'forte' ? m.pv : mode === 'blinde' ? this.armureDe(m) : 0);
    let meilleur: Monstre | null = null;
    let meilleureValeur = 0;
    for (const m of this.monstres) {
      if (m.pv <= 0 || exclus?.has(m) || distance(centre, m.position) > portee) continue;
      if (!aerien && this.enLAir(m)) continue;
      if (this.horsDAtteinte(m, sousEau) || !this.eclaire(m.position)) continue;
      const v = valeur(m);
      if (
        !meilleur ||
        v > meilleureValeur ||
        (v === meilleureValeur && m.longueur - m.avancement < meilleur.longueur - meilleur.avancement)
      ) {
        meilleur = m;
        meilleureValeur = v;
      }
    }
    return meilleur;
  }

  /** Armure du monstre en ce moment (le cloporte en boule en a bien plus). */
  private armureDe(m: Monstre): number {
    const boule = MONSTRES[m.type].boule;
    return boule && this.enBoule(m) ? boule.armure : MONSTRES[m.type].armure;
  }

  private tirer(): void {
    for (const t of this.tours) {
      if (t.recharge > 0) t.recharge--;
      if (this.bloquee(t)) {
        t.cible = null;
        continue;
      }
      const stade = stadeDe(t);
      const cible = this.viser(t.centre, porteeDe(t), TOURS[t.type].aerien ?? false, undefined, TOURS[t.type].sousEau, t.mode);
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
        harpon: null,
      };
      if (fiche.harpon) {
        const vise = this.ouSera(cible, t.centre, base.vitesse);
        const but = prolonger(t.centre, vise, porteeDe(t) + fiche.harpon.allonge);
        const harpon = { largeur: fiche.harpon.largeur, rebonds: capacite?.rebonds ?? 0, saut: capacite?.saut ?? 0, touches: new Set<Monstre>() };
        this.projectiles.push({ ...base, id: this.prochainId++, position: { ...t.centre }, but, cible: cible.id, harpon });
        continue;
      }
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
        const autre = this.viser(t.centre, porteeDe(t), TOURS[t.type].aerien ?? false, touches, TOURS[t.type].sousEau, t.mode);
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
      if (p.harpon) {
        if (this.filer(p, p.harpon)) restants.push(p);
        continue;
      }
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
        // Plongée entre-temps, la sangsue esquive l'abeille.
        const cible = parId.get(p.cible)!;
        if (!this.horsDAtteinte(cible, TOURS[p.type].sousEau)) this.toucher(cible, p);
        continue;
      }
      for (const m of this.monstres) {
        if (m.pv <= 0 || distance(m.position, p.but) > p.rayon) continue;
        if (this.enLAir(m) && !TOURS[p.type].aerien) continue;
        if (this.horsDAtteinte(m, TOURS[p.type].sousEau)) continue;
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

  /**
   * Un pas du harpon : il avance, blesse les monstres frôlés en chemin, puis repart vers un monstre voisin s'il lui
   * reste des rebonds. Renvoie faux quand il a fini sa course.
   */
  private filer(p: Projectile, h: NonNullable<Projectile['harpon']>): boolean {
    const avant = { ...p.position };
    const reste = distance(p.position, p.but);
    const avance = Math.min(p.vitesse / PAS_PAR_SECONDE, reste);
    if (reste > 0) {
      p.position.x += ((p.but.x - p.position.x) / reste) * avance;
      p.position.y += ((p.but.y - p.position.y) / reste) * avance;
    }
    for (const m of this.monstres) {
      if (m.pv <= 0 || h.touches.has(m) || this.enLAir(m) || this.plonge(m)) continue;
      if (distanceAuSegment(m.position, avant, p.position) > h.largeur) continue;
      h.touches.add(m);
      this.toucher(m, p);
    }
    if (avance < reste) return true;
    if (h.rebonds <= 0) return false;
    const suivant = this.viser(p.position, h.saut, false, h.touches, true);
    if (!suivant) return false;
    h.rebonds--;
    p.depart = { ...p.position };
    p.but = prolonger(p.position, suivant.position, distance(p.position, suivant.position) + 1);
    return true;
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
    const boule = MONSTRES[m.type].boule;
    const armure = this.armureDe(m);
    const coup = percant ? degats : Math.max(1, degats - armure);
    this.degats[source] += Math.min(coup, m.pv);
    m.pv -= coup;
    // Le cloporte touché se roule en boule, s'il en a le temps.
    if (boule && m.pv > 0 && !this.enBoule(m) && this.pas >= m.bouleRecharge) {
      m.bouleFin = this.pas + Math.round(boule.duree * PAS_PAR_SECONDE);
      m.elanFin = m.bouleFin + Math.round(boule.elanDuree * PAS_PAR_SECONDE);
      m.bouleRecharge = m.bouleFin + Math.round(boule.recharge * PAS_PAR_SECONDE);
    }
  }

  /** Cloporte roulé en boule. */
  private enBoule(m: Monstre): boolean {
    return this.pas < m.bouleFin;
  }

  /** Les chauves-souris éteignent un moment les champignons-lanternes qu'elles survolent. */
  private souffler(): void {
    for (const m of this.monstres) {
      const souffle = MONSTRES[m.type].souffle;
      if (!souffle || m.pv <= 0) continue;
      for (const l of this.lanternes) {
        if (distance({ x: l.case.x + 0.5, y: l.case.y + 0.5 }, m.position) > souffle.rayon) continue;
        if (this.pas >= l.eteinteJusqua) this.evenements.push({ type: 'extinction', id: l.id, par: m.id, case: { ...l.case }, pas: this.pas });
        l.eteinteJusqua = Math.max(l.eteinteJusqua, this.pas + Math.round(souffle.duree * PAS_PAR_SECONDE));
      }
    }
  }

  /** Le Ver des profondeurs souffle : chaque lanterne s'éteint `duree` secondes (les luisants de la carte restent). */
  private toutEteindre(m: Monstre, duree: number): void {
    this.evenements.push({ type: 'souffle', id: m.id, monstre: m.type, position: { ...m.position }, pas: this.pas });
    for (const l of this.lanternes) {
      if (this.pas >= l.eteinteJusqua) this.evenements.push({ type: 'extinction', id: l.id, par: m.id, case: { ...l.case }, pas: this.pas });
      l.eteinteJusqua = Math.max(l.eteinteJusqua, this.pas + Math.round(duree * PAS_PAR_SECONDE));
    }
  }

  /**
   * Le Colosse d'écorce frappe le sol : la plateforme occupée la plus proche de lui tombe, sa tour est détruite et
   * une part de ce qu'elle a coûté est rendue. Sans plateforme occupée, la frappe ne fait que trembler le sol.
   */
  private abattre(m: Monstre, part: number): void {
    this.evenements.push({ type: 'frappe', id: m.id, monstre: m.type, position: { ...m.position }, pas: this.pas });
    let cible: Tour | null = null;
    for (const t of this.tours) {
      if (t.haute && (!cible || distance(t.centre, m.position) < distance(cible.centre, m.position))) cible = t;
    }
    if (!cible) return;
    const rembourse = Math.floor(cible.depense * part + 1e-9);
    this.spores += rembourse;
    this.tours = this.tours.filter((t) => t !== cible);
    this.tombees.add(cle(cible.case));
    this.evenements.push({ type: 'chute', id: cible.id, tour: cible.type, case: { ...cible.case }, rembourse, pas: this.pas });
  }

  /**
   * Le boss blessé sous un palier pond son escorte juste derrière lui (plusieurs paliers d'un coup : tout). Le
   * Crapaud-roi, lui, plonge d'abord et ne pond qu'en ressortant.
   */
  private pondre(): void {
    const nes: Monstre[] = [];
    const lacher = (m: Monstre, types: TypeMonstre[]) => {
      const petits = types.map((type, rang) => {
        const petit = this.nouveauMonstre(type, m.trace, Math.max(0, m.avancement - 0.3 - 0.35 * rang));
        nes.push(petit);
        return petit.id;
      });
      this.evenements.push({ type: 'ponte', id: m.id, monstre: m.type, position: { ...m.position }, petits, pas: this.pas });
    };
    for (const m of this.monstres) {
      const boss = MONSTRES[m.type].boss;
      if (!boss || m.pv <= 0) continue;
      if (m.plongeeFin >= 0 && this.pas >= m.plongeeFin) {
        m.plongeeFin = -1;
        lacher(m, m.escorte);
        m.escorte = [];
      }
      const escorte: TypeMonstre[] = [];
      const avant = m.paliers;
      while (m.paliers < boss.paliers.length && m.pv <= boss.paliers[m.paliers]!.part * this.pvMax(m.type)) {
        for (const { type, nombre } of boss.paliers[m.paliers]!.escorte) for (let k = 0; k < nombre; k++) escorte.push(type);
        m.paliers++;
      }
      if (boss.noir && m.paliers > avant) this.toutEteindre(m, boss.noir);
      if (boss.abat) for (let k = avant; k < m.paliers; k++) this.abattre(m, boss.abat.rembourse);
      if (escorte.length === 0) continue;
      if (boss.plongee) {
        m.plongeeFin = this.pas + Math.round(boss.plongee.duree * PAS_PAR_SECONDE);
        m.escorte.push(...escorte);
        m.sautDebut = -1;
        this.evenements.push({ type: 'plongee', id: m.id, monstre: m.type, position: { ...m.position }, pas: this.pas });
      } else lacher(m, escorte);
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

/**
 * Là où `tour` peut pousser, hors de la souche : herbe, fleurs ou nénuphar pour les tours de terre, eau libre ou
 * nénuphar pour le héron. Sans `tour` : là où au moins une tour peut pousser.
 */
export function constructible(ile: Ile, c: Case, tour?: TypeTour): boolean {
  if (c.x < 0 || c.y < 0 || c.x >= ile.largeur || c.y >= ile.profondeur) return false;
  const { souche, tailleSouche } = ile;
  if (c.x >= souche.x && c.x < souche.x + tailleSouche && c.y >= souche.y && c.y < souche.y + tailleSouche) return false;
  const terrain = ile.terrain[c.y * ile.largeur + c.x];
  if (terrain === 'nenuphar') return true;
  const surEau = terrain === 'eau';
  const surTerre = terrain === 'herbe' || terrain === 'fleurs' || terrain === 'plateforme';
  if (!tour) return surEau || surTerre;
  return TOURS[tour].surEau ? surEau : surTerre;
}

/** Avance `m` en ligne droite vers `but` d'au plus `pas` cases ; true s'il y est. */
function aller(m: { position: Position }, but: Position, pas: number): boolean {
  const d = distance(m.position, but);
  if (d <= pas) {
    m.position = { ...but };
    return true;
  }
  m.position = { x: m.position.x + ((but.x - m.position.x) / d) * pas, y: m.position.y + ((but.y - m.position.y) / d) * pas };
  return false;
}

/** Point à `longueur` de `depuis`, dans la direction de `vers`. */
function prolonger(depuis: Position, vers: Position, longueur: number): Position {
  const d = distance(depuis, vers);
  if (d === 0) return { ...vers };
  return { x: depuis.x + ((vers.x - depuis.x) / d) * longueur, y: depuis.y + ((vers.y - depuis.y) / d) * longueur };
}

/** Distance d'un point au segment [a, b]. */
function distanceAuSegment(p: Position, a: Position, b: Position): number {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (l2 === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2));
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

/** Durée d'un bond du crapaud, en pas. */
function dureeSaut(type: TypeMonstre): number {
  return Math.round((MONSTRES[type].saut?.duree ?? 0) * PAS_PAR_SECONDE);
}

/** Terrain sous un point (en cases). */
function terrainSous(ile: Ile, p: Position) {
  const x = Math.floor(p.x);
  const y = Math.floor(p.y);
  if (x < 0 || y < 0 || x >= ile.largeur || y >= ile.profondeur) return 'vide';
  return ile.terrain[y * ile.largeur + x];
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
  return t.stade < 3 ? prixPour(TOURS[t.type].stades[t.stade]!.prix, t.haute) : null;
}

/** Portée d'une tour, plus loin depuis une plateforme. */
function porteeDe(t: Tour): number {
  return stadeDe(t).portee + (t.haute ? PLATEFORME.portee : 0);
}

/** La case est-elle une plateforme de la futaie ? */
export function surPlateforme(ile: Ile, c: Case): boolean {
  return ile.terrain[c.y * ile.largeur + c.x] === 'plateforme';
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
