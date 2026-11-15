// Joueurs scriptés pour l'équilibrage : ils jouent une île entière sans aide, avec trois niveaux de jeu.
// Ce fichier ne sert qu'aux tests (il n'est pas exporté par le paquet).
//  - naïf : ne pose que des ruches, au meilleur endroit, sans jamais les améliorer ;
//  - simple : deux ruches, puis varie les quatre tours, puis alterne construction et amélioration ; pas de ronces ;
//  - bon : ferme des branches avec des ronces pour allonger le chemin, choisit ses tours selon les monstres à venir,
//    améliore ses meilleures tours avant d'en poser d'autres ;
//  - seul:<tour ou capacité> : une seule sorte de tour, six au meilleur endroit, puis améliore la plus faible, puis
//    (si une capacité est donnée) passe chacune au stade 4 avec cette capacité. Aucune tour ne doit suffire seule.
// Les joueurs simple et bon prennent aussi le stade 4 quand ils ont une tour au stade 3, et plantent des fleurs à
// spores là où le niveau le permet (prairie), loin du sentier, tant qu'il reste assez de vagues pour les rentabiliser.
// Dans la grotte, tous sauf le naïf posent un champignon-lanterne là où il éclaire le plus de chemin noir à portée
// de leurs tours (au moins 3 cases).
import type { Capacite, Case, Ile, Instantane, Phase, Regles, TourVue, TypeMonstre, TypeTour } from './contrat';
import { CAPACITES, CAPACITES_DE, FLEUR, LANTERNE, MONSTRES, PAS_PAR_SECONDE, PLATEFORME, TOURS, type Vague } from './contenu';
import { Partie, surPlateforme } from './partie';
import { cle, route } from './sentier';

export type Style = 'naif' | 'simple' | 'bon' | `seul:${TypeTour | Capacite}`;

export interface Bilan {
  style: Style;
  phase: Phase;
  /** Dernière vague jouée (celle de la défaite, ou la dernière en cas de victoire). */
  vague: number;
  pv: number;
  etoiles: number;
  /** Durée de la partie à vitesse ×1, sans lancer de vague en avance. */
  minutes: number;
  /** Vie perdue par la souche à chaque vague. */
  pertes: number[];
  /** Tours en fin de partie, « type:stade ». */
  tours: string[];
}

/** Le joueur réfléchit une fois par seconde de jeu. */
const PAS_ENTRE_DECISIONS = PAS_PAR_SECONDE;
const CYCLE_SIMPLE: TypeTour[] = ['ruche', 'ruche', 'cristal', 'canon', 'mortier'];
const CYCLE_SIMPLE_EAU: TypeTour[] = ['ruche', 'heron', 'ruche', 'cristal', 'heron', 'canon', 'mortier'];

/** `observer` : appelé à chaque pas avec l'instantané (pour enquêter sur une partie). */
export function jouer(style: Style, ile: Ile, vagues: readonly Vague[], regles: Partial<Regles> = {}, observer?: (i: Instantane) => void): Bilan {
  const partie = new Partie(ile, vagues, 1, regles);
  const joueur = new Joueur(style, partie);
  const pertes: number[] = vagues.map(() => 0);
  let pas = 0;
  let i = partie.instantane();
  while (i.phase !== 'victoire' && i.phase !== 'defaite' && pas < 60 * 60 * PAS_PAR_SECONDE) {
    if (pas % PAS_ENTRE_DECISIONS === 0) joueur.agir();
    const pv = i.souche.pv;
    partie.avancer();
    pas++;
    const suivant = partie.instantane();
    observer?.(suivant);
    pertes[i.vague - 1]! += pv - suivant.souche.pv;
    i = suivant;
  }
  return {
    style,
    phase: i.phase,
    vague: i.vague,
    pv: i.souche.pv,
    etoiles: i.etoiles,
    minutes: Math.round((pas / PAS_PAR_SECONDE / 60) * 10) / 10,
    pertes,
    tours: i.tours.map((t) => `${t.type}:${t.stade}`),
  };
}

class Joueur {
  /** Ronces que le bon joueur compte poser, dans l'ordre. */
  private readonly plan: Case[];
  /**
   * Ronces avant les deux premières ruches quand le chemin qu'elles imposent a peu en commun avec le chemin libre :
   * sinon les ruches, posées sur le chemin prévu, ne voient pas passer la première vague.
   */
  private readonly ronceDabord: boolean;
  /** Une case d'eau libre voit au moins 6 cases des chemins prévus : le héron y vaut la peine. */
  private readonly eauUtile: boolean;

  constructor(
    private readonly style: Style,
    private readonly partie: Partie,
  ) {
    this.plan = style === 'bon' && partie.regles.ronces ? this.meilleuresRonces() : [];
    const { ile, sentier } = partie;
    const prevues = this.routes();
    this.ronceDabord = sentier.plages.some((p, n) => {
      const libre = new Set((route(ile, p.depart) ?? []).map(cle));
      const prevue = prevues[n] ?? [];
      return prevue.filter((c) => libre.has(cle(c))).length < prevue.length / 2;
    });
    const portee = TOURS.heron.stades[0].portee;
    const chemins = prevues.flat();
    // Le joueur simple ne pense au héron qu'au marais (les repères de la forêt ont été réglés sans lui).
    this.eauUtile =
      (style === 'bon' || (style === 'simple' && ile.biome === 'marais')) &&
      partie.regles.tours.includes('heron') &&
      ile.terrain.some((_, k) => {
        const c = { x: k % ile.largeur, y: Math.floor(k / ile.largeur) };
        if (!partie.libre(c, 'heron')) return false;
        return chemins.filter((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 <= portee * portee).length >= 6;
      });
  }

  /** Dépense ce qu'il peut, action après action, tant que la suivante est payable. */
  agir(): void {
    for (let n = 0; n < 20; n++) {
      const action = this.prochaineAction();
      if (!action || !action()) return;
    }
  }

  private prochaineAction(): (() => boolean) | null {
    const i = this.partie.instantane();
    const tours = i.tours;
    const plusFaible = [...tours].filter((t) => t.prixAmelioration !== null).sort((a, b) => a.stade - b.stade || b.id - a.id)[0];
    const ameliorer = () => (plusFaible ? this.partie.executer({ type: 'ameliorerTour', id: plusFaible.id }) : false);
    const permises = this.partie.regles.tours;
    const poser = (voulu: TypeTour) => () => {
      const type = permises.includes(voulu) ? voulu : permises[tours.length % permises.length]!;
      const c = this.meilleureCase(type);
      return c ? this.partie.executer({ type: 'poserTour', tour: type, case: c }) : false;
    };

    /** Passe une tour du stade 3 au stade 4 ; `choix` donne la capacité. */
    const auStade3 = tours.find((t) => t.prixCapacites !== null);
    const specialiser = (choix: (t: TourVue) => Capacite) => () =>
      auStade3 ? this.partie.executer({ type: 'choisirCapacite', id: auStade3.id, capacite: choix(auStade3) }) : false;

    if (this.style === 'naif') return poser('ruche');

    if (this.partie.regles.noir && tours.length > 0) {
      const c = this.caseLanterne(i);
      if (c) return () => this.partie.executer({ type: 'poserLanterne', case: c });
    }

    // Les chauves-souris volent tout droit vers la souche, dans le noir : simple et bon gardent deux ruches (le bon :
    // plus un cristal) collées à elle, là où toutes finissent par passer.
    if ((this.style === 'simple' || this.style === 'bon') && this.prochaines('chauveSouris') && tours.length >= 2) {
      const centre = { x: this.partie.ile.souche.x + 1, y: this.partie.ile.souche.y + 1 };
      const pres = (type: TypeTour) => tours.filter((t) => t.type === type && Math.hypot(t.case.x + 0.5 - centre.x, t.case.y + 0.5 - centre.y) <= 2.5).length;
      const voulues: [TypeTour, number][] = this.style === 'bon' ? [['ruche', 2], ['cristal', 1]] : [['ruche', 2]];
      for (const [type, nombre] of voulues) {
        if (!permises.includes(type) || pres(type) >= nombre) continue;
        // Autour de la souche, la case la plus éloignée des tours de garde déjà posées : un côté chacune.
        const gardes = tours.filter((t) => Math.hypot(t.case.x + 0.5 - centre.x, t.case.y + 0.5 - centre.y) <= 2.5);
        const c = this.caseProcheSouche(type, gardes.map((t) => t.case));
        if (c) return () => this.partie.executer({ type: 'poserTour', tour: type, case: c });
      }
    }

    if (this.style.startsWith('seul:')) {
      const nom = this.style.slice('seul:'.length) as TypeTour | Capacite;
      const capacite = nom in CAPACITES ? (nom as Capacite) : null;
      const type = capacite ? CAPACITES[capacite].tour : (nom as TypeTour);
      if (tours.length < 6) return poser(type);
      if (plusFaible) return ameliorer;
      return capacite && auStade3 ? specialiser(() => capacite) : poser(type);
    }

    // Fleurs à spores : une fleur rapporte son prix en un peu plus de trois vagues.
    const restantes = i.vagues - i.vague + (i.phase === 'pause' ? 1 : 0);
    const voulues =
      !this.partie.regles.fleurs || restantes < Math.ceil(FLEUR.prix / FLEUR.rapport) + 1
        ? 0
        : this.style === 'simple'
          ? Math.min(3, Math.floor((tours.length - 2) / 2))
          : this.style === 'bon'
            ? Math.min(5, tours.length - 3)
            : 0;
    if (i.fleurs.length < voulues) {
      const c = this.caseFleur();
      if (c) return () => this.partie.executer({ type: 'planterFleur', case: c });
    }

    if (this.style === 'simple') {
      const ameliorees = tours.reduce((n, t) => n + t.stade - 1, 0);
      if (tours.length >= 4 && ameliorees < tours.length - 3) {
        if (plusFaible) return ameliorer;
        // Pas de réflexion : une capacité sur deux, selon la tour.
        if (auStade3) return specialiser((t) => CAPACITES_DE[t.type][t.id % 2]!);
      }
      // Avec de l'eau près du chemin, le héron entre dans le cycle.
      const cycle = this.eauUtile ? CYCLE_SIMPLE_EAU : CYCLE_SIMPLE;
      return poser(cycle[tours.length % cycle.length]!);
    }

    // Bon joueur.
    const ronce = this.plan.find((c) => !i.ronces.some((r) => r.x === c.x && r.y === c.y));
    // Ouverture : deux ruches (elles touchent tout, phalènes comprises), puis les ronces, puis selon les monstres.
    if (tours.length < 2 && !(ronce && this.ronceDabord)) return poser('ruche');
    if (ronce) return () => this.partie.executer({ type: 'poserRonce', case: ronce });
    if (tours.length < 3) return poser(this.typeVoulu());
    // Le Grand Corbeau arrive : deux cristaux près de la souche, là où il finira par fondre.
    if (this.corbeauProche() && permises.includes('cristal')) {
      const s = this.partie.ile.souche;
      const pres = tours.filter((t) => t.type === 'cristal' && Math.hypot(t.case.x - s.x, t.case.y - s.y) <= 3).length;
      if (pres < 2) {
        const c = this.caseProcheSouche('cristal');
        if (c) return () => this.partie.executer({ type: 'poserTour', tour: 'cristal', case: c });
      }
    }
    if (tours.some((t) => t.stade < 2)) return ameliorer;
    if (tours.length < 7) return poser(this.typeVoulu());
    if (plusFaible) return ameliorer;
    if (auStade3) return specialiser((t) => this.capaciteVoulue(t.type));
    return poser(this.typeVoulu());
  }

  /** Le Grand Corbeau est-il dans la vague en cours ou la suivante ? */
  private corbeauProche(): boolean {
    const i = this.partie.instantane();
    return this.partie.vagues.slice(i.vague - 1, i.vague + 1).some((v) => v.some((g) => g.type === 'corbeau'));
  }

  /** Des monstres de cette sorte dans la vague en cours ou la suivante ? */
  private prochaines(type: TypeMonstre): boolean {
    const i = this.partie.instantane();
    return this.partie.vagues.slice(i.vague - 1, i.vague + 1).some((v) => v.some((g) => g.type === type));
  }

  /**
   * Case libre la plus proche de la souche ; avec `eviter`, parmi celles qui la bordent (à 2,5 cases au plus), la plus
   * éloignée de ces cases-là.
   */
  private caseProcheSouche(type: TypeTour, eviter: readonly Case[] = []): Case | null {
    const { ile } = this.partie;
    const centre = { x: ile.souche.x + ile.tailleSouche / 2 - 0.5, y: ile.souche.y + ile.tailleSouche / 2 - 0.5 };
    let meilleure: Case | null = null;
    let score = Infinity;
    for (let y = 0; y < ile.profondeur; y++)
      for (let x = 0; x < ile.largeur; x++) {
        const c = { x, y };
        const dc = Math.hypot(x - centre.x, y - centre.y);
        if (!this.partie.libre(c, type) || (eviter.length > 0 && dc > 2.5)) continue;
        const s = eviter.length === 0 ? dc : -Math.min(...eviter.map((e) => Math.hypot(e.x - x, e.y - y)));
        if (s < score) [meilleure, score] = [c, s];
      }
    return meilleure ?? (eviter.length > 0 ? this.caseProcheSouche(type) : null);
  }

  /** Bon joueur : la capacité contre les gros monstres si les deux prochaines vagues en ont, sinon contre les groupes. */
  private capaciteVoulue(type: TypeTour): Capacite {
    const i = this.partie.instantane();
    const gros = this.partie.vagues.slice(i.vague - 1, i.vague + 1).some((v) => v.some((g) => g.type === 'scarabee' || g.type === 'amas' || g.type === 'limaceMere'));
    return CAPACITES_DE[type][gros ? 1 : 0]!;
  }

  /** Bon joueur : la tour qui répond aux monstres des deux prochaines vagues et manque le plus. */
  private typeVoulu(): TypeTour {
    const i = this.partie.instantane();
    const proches = new Set<TypeMonstre>();
    for (const v of this.partie.vagues.slice(i.vague - 1, i.vague + 1)) for (const g of v) proches.add(g.type);
    const besoins: TypeTour[] = ['ruche'];
    if (proches.has('scarabee')) besoins.push('cristal', 'cristal');
    if (proches.has('amas')) besoins.push('canon', 'mortier');
    if (proches.has('moucheron')) besoins.push('ruche', 'mortier');
    if (proches.has('volant') || proches.has('chauveSouris')) besoins.push('ruche', 'cristal');
    if (proches.has('cloporte')) besoins.push('cristal');
    if (proches.has('ver')) besoins.push('cristal', 'cristal');
    if (proches.has('soigneur')) besoins.push('cristal');
    // Sangsue : le héron la touche sous l'eau ; sans eau utile, les tours de terre l'attendent sur le sentier sec.
    if (proches.has('sangsue')) besoins.push(this.eauUtile ? 'heron' : 'ruche', this.eauUtile ? 'heron' : 'cristal');
    // Crapaud : il bondit, mieux vaut des tours qui couvrent large ou ralentissent.
    if (proches.has('crapaud')) besoins.push('mortier', 'cristal');
    if (proches.has('limaceMere')) besoins.push('cristal', 'canon');
    // Prairie : les essaims de sauterelles appellent les tours de zone ; le corbeau, celles qui touchent en l'air.
    if (proches.has('sauterelle')) besoins.push('canon', 'mortier');
    if (proches.has('chenille')) besoins.push('cristal');
    if (proches.has('corbeau')) besoins.push('cristal', 'ruche', 'cristal');
    // Héron : contre les files de marcheurs, s'il a une case d'eau qui voit assez de chemin.
    if (this.eauUtile && (proches.has('limace') || proches.has('amas') || proches.has('scarabee'))) besoins.push('heron');
    const compte = (t: TypeTour) => i.tours.filter((x) => x.type === t).length;
    return [...besoins].sort((a, b) => compte(a) - compte(b))[0]!;
  }

  /**
   * Case libre d'où la tour couvre le plus de cases des routes (une case empruntée par deux routes compte double).
   * Une route déjà bien couverte par les tours posées compte moins : chaque plage finit par être défendue.
   */
  private meilleureCase(type: TypeTour): Case | null {
    const portee = TOURS[type].stades[0].portee;
    const routes = this.routes();
    const { ile } = this.partie;
    const tours = this.partie.instantane().tours;
    const dedans = (p: Case, x: number, y: number, r: number) => (p.x - x) ** 2 + (p.y - y) ** 2 <= r * r;
    // Grotte : une case de chemin noire compte moitié (il faudra une lanterne pour y tirer).
    const lumieres = this.partie.instantane().lumieres.filter((l) => l.allumee);
    const eclaire = (p: Case) =>
      lumieres.length === 0 || lumieres.some((l) => Math.hypot(l.position.x - p.x - 0.5, l.position.y - p.y - 0.5) <= l.rayon);
    // Couverture actuelle de chaque route : cases à portée d'une tour, comptées par tour, rapportées à sa longueur.
    const poids = routes.map((r) => {
      let couvert = 0;
      for (const t of tours) for (const p of r) if (dedans(p, t.case.x, t.case.y, t.portee)) couvert++;
      return 1 / (1 + (2 * couvert) / Math.max(1, r.length));
    });
    let meilleure: Case | null = null;
    let score = 0;
    for (let y = 0; y < ile.profondeur; y++) {
      for (let x = 0; x < ile.largeur; x++) {
        const c = { x, y };
        if (!this.partie.libre(c, type)) continue;
        // Futaie : d'une plateforme on voit plus loin, mais on paie plus (score rapporté au prix).
        const haute = surPlateforme(ile, c);
        const r0 = portee + (haute ? PLATEFORME.portee : 0);
        let s = 0;
        routes.forEach((r, i) => {
          for (const p of r) if (dedans(p, x, y, r0)) s += poids[i]! * (eclaire(p) ? 1 : 0.9);
        });
        if (haute) s /= PLATEFORME.surcout;
        if (s > score) {
          score = s;
          meilleure = c;
        }
      }
    }
    return meilleure;
  }

  /** Case libre d'où une lanterne éclaire le plus de cases de chemin noires et à portée d'une tour (au moins 2). */
  private caseLanterne(i: Instantane): Case | null {
    const { ile } = this.partie;
    const allumees = i.lumieres.filter((l) => l.allumee);
    const noires = [...new Map(this.routes().flat().map((p) => [cle(p), p])).values()].filter((p) => {
      const centre = { x: p.x + 0.5, y: p.y + 0.5 };
      if (allumees.some((l) => Math.hypot(l.position.x - centre.x, l.position.y - centre.y) <= l.rayon)) return false;
      return i.tours.some((t) => (p.x - t.case.x) ** 2 + (p.y - t.case.y) ** 2 <= t.portee * t.portee);
    });
    let meilleure: Case | null = null;
    let score = 1;
    for (let y = 0; y < ile.profondeur; y++)
      for (let x = 0; x < ile.largeur; x++) {
        const c = { x, y };
        if (!this.partie.lanterneLibre(c)) continue;
        const s = noires.filter((p) => Math.hypot(p.x - x, p.y - y) <= LANTERNE.rayon).length;
        if (s > score) [meilleure, score] = [c, s];
      }
    return meilleure;
  }

  /**
   * Où planter une fleur : hors de portée des chenilles (au-delà de leur flair, avec une marge) si possible.
   * Le simple prend la case la plus éloignée des chemins ; le bon, parmi les cases sûres, la plus proche de ses tours
   * (le Grand Corbeau qui s'y pose sera à portée).
   */
  private caseFleur(): Case | null {
    const { ile } = this.partie;
    const chemins = this.routes().flat();
    const tours = this.partie.instantane().tours;
    const sur = MONSTRES.chenille.gourmande!.flair + 0.7;
    let meilleure: Case | null = null;
    let score = -Infinity;
    for (let y = 0; y < ile.profondeur; y++)
      for (let x = 0; x < ile.largeur; x++) {
        const c = { x, y };
        if (!this.partie.fleurLibre(c)) continue;
        const loin = Math.min(...chemins.map((p) => Math.hypot(p.x - x, p.y - y)));
        let s: number;
        if (this.style === 'bon' && loin >= sur) s = 100 - Math.min(...tours.map((t) => Math.hypot(t.case.x - x, t.case.y - y)));
        else s = Math.min(loin, sur) - (loin >= sur ? 0 : 50);
        if (s > score) [meilleure, score] = [c, s];
      }
    return meilleure;
  }

  /** Routes des plages vers la souche, avec les ronces posées et celles prévues. */
  private routes(): Case[][] {
    const bloquees = new Set([...this.partie.instantane().ronces, ...this.plan].map(cle));
    return this.partie.sentier.plages.map((p) => route(this.partie.ile, p.depart, bloquees) ?? []);
  }

  /** Une ou deux ronces qui allongent le plus le chemin total, en laissant chaque plage reliée à la souche. */
  private meilleuresRonces(): Case[] {
    const { ile, sentier, emplacementsRonces: places } = this.partie;
    const longueur = (bloquees: Case[]) => {
      const b = new Set(bloquees.map(cle));
      let total = 0;
      for (const p of sentier.plages) {
        const r = route(ile, p.depart, b);
        if (!r) return -1;
        total += r.length;
      }
      return total;
    };
    let meilleur: Case[] = [];
    let record = longueur([]);
    for (let a = 0; a < places.length; a++) {
      for (let b = a; b < places.length; b++) {
        const essai = a === b ? [places[a]!] : [places[a]!, places[b]!];
        const l = longueur(essai);
        if (l > record || (l === record && essai.length < meilleur.length)) {
          record = l;
          meilleur = essai;
        }
      }
    }
    return meilleur;
  }
}
