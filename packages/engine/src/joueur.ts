// Joueurs scriptés pour l'équilibrage : ils jouent une île entière sans aide, avec trois niveaux de jeu.
// Ce fichier ne sert qu'aux tests (il n'est pas exporté par le paquet).
//  - naïf : ne pose que des ruches, au meilleur endroit, sans jamais les améliorer ;
//  - simple : deux ruches, puis varie les quatre tours, puis alterne construction et amélioration ; pas de ronces ;
//  - bon : ferme des branches avec des ronces pour allonger le chemin, choisit ses tours selon les monstres à venir,
//    améliore ses meilleures tours avant d'en poser d'autres ;
//  - seul:<tour ou capacité> : une seule sorte de tour, six au meilleur endroit, puis améliore la plus faible, puis
//    (si une capacité est donnée) passe chacune au stade 4 avec cette capacité. Aucune tour ne doit suffire seule.
// Les joueurs simple et bon prennent aussi le stade 4 quand ils ont une tour au stade 3.
import type { Capacite, Case, Ile, Phase, TourVue, TypeMonstre, TypeTour } from './contrat';
import { CAPACITES, CAPACITES_DE, PAS_PAR_SECONDE, TOURS, type Vague } from './contenu';
import { Partie } from './partie';
import { cle, route } from './sentier';

export type Niveau = 'naif' | 'simple' | 'bon' | `seul:${TypeTour | Capacite}`;

export interface Bilan {
  niveau: Niveau;
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

export function jouer(niveau: Niveau, ile: Ile, vagues: readonly Vague[]): Bilan {
  const partie = new Partie(ile, vagues, 1);
  const joueur = new Joueur(niveau, partie);
  const pertes: number[] = vagues.map(() => 0);
  let pas = 0;
  let i = partie.instantane();
  while (i.phase !== 'victoire' && i.phase !== 'defaite' && pas < 60 * 60 * PAS_PAR_SECONDE) {
    if (pas % PAS_ENTRE_DECISIONS === 0) joueur.agir();
    const pv = i.souche.pv;
    partie.avancer();
    pas++;
    const suivant = partie.instantane();
    pertes[i.vague - 1]! += pv - suivant.souche.pv;
    i = suivant;
  }
  return {
    niveau,
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

  constructor(
    private readonly niveau: Niveau,
    private readonly partie: Partie,
  ) {
    this.plan = niveau === 'bon' ? this.meilleuresRonces() : [];
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
    const poser = (type: TypeTour) => () => {
      const c = this.meilleureCase(type);
      return c ? this.partie.executer({ type: 'poserTour', tour: type, case: c }) : false;
    };

    /** Passe une tour du stade 3 au stade 4 ; `choix` donne la capacité. */
    const auStade3 = tours.find((t) => t.prixCapacites !== null);
    const specialiser = (choix: (t: TourVue) => Capacite) => () =>
      auStade3 ? this.partie.executer({ type: 'choisirCapacite', id: auStade3.id, capacite: choix(auStade3) }) : false;

    if (this.niveau === 'naif') return poser('ruche');

    if (this.niveau.startsWith('seul:')) {
      const nom = this.niveau.slice('seul:'.length) as TypeTour | Capacite;
      const capacite = nom in CAPACITES ? (nom as Capacite) : null;
      const type = capacite ? CAPACITES[capacite].tour : (nom as TypeTour);
      if (tours.length < 6) return poser(type);
      if (plusFaible) return ameliorer;
      return capacite && auStade3 ? specialiser(() => capacite) : poser(type);
    }

    if (this.niveau === 'simple') {
      const ameliorees = tours.reduce((n, t) => n + t.stade - 1, 0);
      if (tours.length >= 4 && ameliorees < tours.length - 3) {
        if (plusFaible) return ameliorer;
        // Pas de réflexion : une capacité sur deux, selon la tour.
        if (auStade3) return specialiser((t) => CAPACITES_DE[t.type][t.id % 2]!);
      }
      return poser(CYCLE_SIMPLE[tours.length % CYCLE_SIMPLE.length]!);
    }

    // Bon joueur.
    const ronce = this.plan.find((c) => !i.ronces.some((r) => r.x === c.x && r.y === c.y));
    if (ronce && tours.length >= 2) return () => this.partie.executer({ type: 'poserRonce', case: ronce });
    if (tours.length < 3) return poser(this.typeVoulu());
    if (tours.some((t) => t.stade < 2)) return ameliorer;
    if (tours.length < 7) return poser(this.typeVoulu());
    if (plusFaible) return ameliorer;
    if (auStade3) return specialiser((t) => this.capaciteVoulue(t.type));
    return poser(this.typeVoulu());
  }

  /** Bon joueur : la capacité contre les gros monstres si les deux prochaines vagues en ont, sinon contre les groupes. */
  private capaciteVoulue(type: TypeTour): Capacite {
    const i = this.partie.instantane();
    const gros = this.partie.vagues.slice(i.vague - 1, i.vague + 1).some((v) => v.some((g) => g.type === 'scarabee' || g.type === 'amas'));
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
    const compte = (t: TypeTour) => i.tours.filter((x) => x.type === t).length;
    return [...besoins].sort((a, b) => compte(a) - compte(b))[0]!;
  }

  /** Case libre d'où la tour couvre le plus de cases des routes (une case empruntée par deux routes compte double). */
  private meilleureCase(type: TypeTour): Case | null {
    const portee = TOURS[type].stades[0].portee;
    const routes = this.routes();
    const { ile } = this.partie;
    let meilleure: Case | null = null;
    let score = 0;
    for (let y = 0; y < ile.profondeur; y++) {
      for (let x = 0; x < ile.largeur; x++) {
        const c = { x, y };
        if (!this.partie.libre(c)) continue;
        let s = 0;
        for (const r of routes) for (const p of r) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= portee * portee) s++;
        if (s > score) {
          score = s;
          meilleure = c;
        }
      }
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
