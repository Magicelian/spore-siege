// Interface du tower defense, en Preact, dans le style de Tiny Shrooms version guerre : bandeau compact toujours
// visible, bulles au clic sur l'île (construire, tour, ronce).
// Le contrôleur garde l'état de l'interface ; le frontend lui donne les instantanés et lit l'aperçu à dessiner.
import { render } from 'preact';
import type { Biome, Capacite, Case, Difficulte, Commande, FleurVue, Ile, Instantane, LanterneVue, ModeCible, Niveau, StadeTour, TourVue, TypeMonstre, TypeTour } from '@spore-siege/engine';
import { CAPACITES, CAPACITES_DE, etoilesDepensees, etoilesPour, FLEUR, LANTERNE, MODES_CIBLE, MONSTRES, NIVEAU_SANS_FIN, NIVEAUX, niveauOuvert, PART_RONCE_RENDUE, VIE_DIFFICULTE, PRIX_RONCE, SEUIL_BOSS, PLATEFORME, prixPour, surPlateforme, TOURS, TOURS_DE_BASE, TOUTES_CAPACITES } from '@spore-siege/engine';
import { icone, type Icone } from './icones';
import { ecrireAtelier, ecrireDecouverts, ecrireEtoiles, ecrireMusique, ecrireParties, ecrireRecord, ecrireSons, ecrireToursVues, effacerPartie, lireAtelier, lireDecouverts, lireEtoiles, lireMusique, lireParties, lireRecord, lireSons, lireToursVues, type Etoiles, type Sauvegarde } from './sauvegarde';
import { Sons } from './sons';

export type { Effet } from './sons';
import { CAPACITES_TEXTES, ILES_TEXTES, MODES_TEXTES, MONSTRES_TEXTES, nombre, TEXTES, TOURS_TEXTES } from './textes';

/** Ce que l'interface peut demander à la partie. */
export interface Jeu {
  executer(commande: Commande): boolean;
  instantane(): Instantane;
  /** Une tour (de cette sorte, ou de n'importe laquelle) peut-elle être posée sur la case ? */
  libre(c: Case, tour?: TypeTour): boolean;
  ronceLibre(c: Case): boolean;
  /** Une fleur à spores peut-elle être plantée sur la case ? (prairie) */
  fleurLibre(c: Case): boolean;
  /** Un champignon-lanterne peut-il être posé sur la case ? (grotte) */
  lanterneLibre(c: Case): boolean;
  readonly emplacementsRonces: readonly Case[];
  readonly ile: Ile;
  /** Id du niveau joué, pour ranger ses étoiles. */
  readonly niveau: string;
}

/** Réglages de la fenêtre, seulement dans l'application (pas dans un navigateur). */
export interface Fenetre {
  tailles: readonly { cote: number; nom: string }[];
  regler(cote: number): Promise<number>;
  actuelle(): Promise<number>;
  quitter(): void;
  /** Son allumé ou coupé : le menu de l'icône de la barre des menus suit. */
  son(allume: boolean): void;
  /** Musique de combat allumée ou coupée : le menu de l'icône suit. */
  musique(active: boolean): void;
}

export interface OptionsInterface {
  /** Image du modèle ; au stade 4, celui de la capacité. */
  vignette(type: TypeTour | 'ronce' | Plante, stade: number, capacite?: Capacite | null): string;
  vignetteMonstre(type: TypeMonstre): string;
  recommencer(): void;
  fenetre?: Fenetre;
  /** Le canevas doit montrer l'archipel, la carte d'une île (`ile`) ou l'île de la partie. */
  changerEcran(ecran: Ecran, ile?: Biome): void;
  /** Étapes de la carte montrée (îles ou niveaux), avec le dessus de leur îlot à l'écran (pixels de l'interface). */
  positionsCarte(): { cle: string; x: number; y: number }[];
  /** Où tombent ces cases de l'île à l'écran (pixels de l'interface). */
  ecranDe(cases: Case[]): { x: number; y: number }[];
  /** Prépare une partie neuve sur ce niveau. */
  lancer(niveau: Niveau): void;
}

/** Accueil (titre + Jouer), archipel, carte d'une île (ses niveaux), ou partie en cours. */
export type Ecran = 'accueil' | 'parties' | 'carte' | 'niveaux' | 'partie';

/** Ce qui se pose à la place d'une tour : fleur à spores (prairie) ou champignon-lanterne (grotte). */
export type Plante = 'fleur' | 'lanterne';

/** Tour, ronce, fleur ou lanterne fantôme à dessiner sur l'île, avec sa portée (pour la lanterne : sa lumière). */
export interface Apercu {
  type: TypeTour | 'ronce' | Plante;
  case: Case;
  possible: boolean;
  portee: number;
}

/** Ce qu'on peut cliquer sous la souris : case libre (carré au sol) ou tour, ronce (boîte). */
export interface Marque {
  case: Case;
  sorte: 'case' | 'boite';
  hauteur: number;
}

/** 0 : en pause ; 1 ou 2 : vitesse du jeu. */
export type Vitesse = 0 | 1 | 2;

type Bulle = { case: Case; enHaut: boolean };
type Livre = { onglet: 'monstres'; choix: TypeMonstre } | { onglet: 'tours'; choix: TypeTour };

const TYPES = Object.keys(TOURS) as TypeTour[];
const DIFFICULTES: Difficulte[] = ['facile', 'normal', 'difficile'];
const TYPES_MONSTRES = Object.keys(MONSTRES) as TypeMonstre[];
const memeCase = (a: Case, b: Case) => a.x === b.x && a.y === b.y;

export class ControleurInterface {
  vitesse: Vitesse = 1;
  ecran: Ecran = 'accueil';
  /** Île dont on montre (ou joue) les niveaux. */
  private ileChoisie: Biome = 'foret';
  /** Bruitages ; coupés tant que le joueur ne les a pas allumés par le menu de l’icône (choix retenu). */
  readonly sons = new Sons();
  /** Écran de victoire finale ouvert par-dessus l'archipel (après le dernier boss). */
  private finale = false;
  /** Vagues sans fin : meilleure vague atteinte dans la partie, et record battu par la partie en cours. */
  private record = 0;
  private nouveauRecord = false;
  /** Les 3 emplacements de partie (null = vide). */
  private parties = lireParties();
  /** Emplacement joué : sa difficulté et sa progression sont chargées ci-dessous. */
  private emplacement = 0;
  /** Écran des parties : emplacement vide dont on choisit la difficulté, ou partie à supprimer (confirmation). */
  private creation: number | null = null;
  private aSupprimer: number | null = null;
  /** Meilleures étoiles de chaque niveau, pour la partie choisie. */
  private etoiles: Etoiles = {};
  /** Vitesse choisie avant la pause, pour reprendre au même rythme. */
  private vitesseAvantPause: 1 | 2 = 1;
  private bulle: Bulle | null = null;
  private survol: TypeTour | Plante | null = null;
  /** Capacité montrée dans la bulle d'une tour au stade 3 (la première tant qu'on n'a rien survolé). */
  private capaciteVue: Capacite | null = null;
  private instantane: Instantane | null = null;
  private tailleFenetre = 0;
  /** Case sous la souris (null hors de l'île ou pendant un glisser). */
  private caseSurvolee: Case | null = null;
  /** Monstres déjà rencontrés (fiche lue ou vague jouée), gardés d'une partie à l'autre. */
  private decouverts = new Set<TypeMonstre>();
  /** Tours découvertes (grimoire, Atelier) : celles de base et celles qu'on a déjà pu construire. */
  private toursVues = new Set<TypeTour>(TOURS_DE_BASE);
  /** Fiche d'un nouveau monstre, ouverte depuis son médaillon. */
  private fiche: TypeMonstre | null = null;
  private pauseMenu = false;
  private livre: Livre | null = null;
  /** Capacités du stade 4 ouvertes avec les étoiles, gardées d'une partie à l'autre. */
  private atelier: Capacite[] = [];
  /** Atelier ouvert sur cette capacité (null = fermé). */
  private atelierVu: Capacite | null = null;
  /** Vitesse à rétablir en refermant la fiche ou le grimoire (qui mettent le jeu en pause). */
  private reprendreA: 1 | 2 | null = null;
  /** Vague qu'on est en train de jouer : ses monstres comptent comme rencontrés quand elle s'achève. */
  private vagueJouee: { n: number; types: TypeMonstre[] } | null = null;

  constructor(
    private readonly element: HTMLElement,
    public jeu: Jeu,
    private readonly options: OptionsInterface,
  ) {
    this.sons.activerMusique(lireMusique());
    if (lireSons()) {
      this.sons.activer(true);
      // Le navigateur ne laisse jouer qu'après un geste du joueur.
      addEventListener('pointerdown', () => this.sons.activer(this.sons.actif), { once: true });
    }
    options.fenetre?.son(this.sons.actif);
    options.fenetre?.musique(this.sons.musiqueAllumee);
    void options.fenetre?.actuelle().then((t) => {
      this.tailleFenetre = t;
      this.dessiner();
    });
  }

  /** Nouvel instantané de la partie. */
  maj(instantane: Instantane): void {
    this.instantane = instantane;
    if (instantane.phase === 'victoire' || instantane.phase === 'defaite') this.bulle = null;
    // Une partie en cours (Rejouer compris) n'a pas encore battu de record.
    if (instantane.phase !== 'victoire' && instantane.phase !== 'defaite') this.nouveauRecord = false;
    if (instantane.phase === 'defaite' && instantane.regles.sansFin && instantane.vague > this.record) {
      this.record = instantane.vague;
      this.nouveauRecord = true;
      ecrireRecord(this.emplacement, this.record);
    }
    if (instantane.phase === 'victoire' && instantane.etoiles > (this.etoiles[this.jeu.niveau] ?? 0)) {
      this.etoiles[this.jeu.niveau] = instantane.etoiles;
      ecrireEtoiles(this.emplacement, this.etoiles);
    }
    const v = this.vagueJouee;
    if (v && (instantane.phase !== 'vague' || instantane.vague !== v.n)) {
      this.decouvrir(v.types);
      this.vagueJouee = null;
    }
    if (instantane.phase === 'vague' && !this.vagueJouee) this.vagueJouee = { n: instantane.vague, types: instantane.monstresVague };
    this.dessiner();
  }

  /**
   * Clic sur une case de l'île : ouvre la bulle qui lui correspond (construire, tour, ronce) ; `enHaut` place la
   * bulle en haut de la fenêtre (clic dans la moitié basse). Ferme tout si la case n'offre rien.
   */
  cliquer(c: Case | null, enHaut: boolean): void {
    if (this.fiche || this.livre || this.pauseMenu) return this.fermer();
    this.survol = null;
    this.capaciteVue = null;
    if (this.vitesse === 0) {
      this.bulle = null;
      return this.dessiner();
    }
    const avant = this.bulle;
    this.bulle = c && this.natureCase(c) ? { case: c, enHaut } : null;
    if (this.bulle && !(avant && memeCase(avant.case, this.bulle.case))) this.sons.jouer('ouvrir');
    else if (avant && !this.bulle) this.sons.jouer('fermer');
    this.dessiner();
  }

  /** La souris passe sur cette case de l'île. */
  survoler(c: Case | null): void {
    this.caseSurvolee = c;
  }

  /**
   * Ce qu'il faut marquer sur l'île : ce que vise la bulle ouverte (tour, ronce), sinon ce qu'on pourrait cliquer
   * sous la souris. Une case d'herbe libre ou une entrée de branche où la ronce peut pousser : carré au sol.
   */
  get marque(): Marque | null {
    const i = this.instantane;
    if (!i || this.fiche || this.livre || this.pauseMenu || this.vitesse === 0) return null;
    const c = this.bulle ? this.bulle.case : this.caseSurvolee;
    if (!c) return null;
    const nature = this.natureCase(c);
    const tour = this.tourDe(c);
    if (tour) return { case: c, sorte: 'boite', hauteur: 0.45 + tour.stade * 0.4 };
    const ronce = i.ronces.some((r) => memeCase(r, c));
    if (ronce) return { case: c, sorte: 'boite', hauteur: 0.6 };
    if (this.fleurDe(c)) return { case: c, sorte: 'boite', hauteur: 1.45 };
    if (this.lanterneDe(c)) return { case: c, sorte: 'boite', hauteur: 1.3 };
    // Bulle ouverte sur une case vide : le fantôme suffit.
    if (this.bulle) return null;
    if (nature === 'construire' || (nature === 'ronce' && this.jeu.ronceLibre(c))) return { case: c, sorte: 'case', hauteur: 0 };
    return null;
  }

  /** Son allumé ou coupé (dans le menu de l’icône) : choix retenu. */
  signalerSon(allume: boolean): void {
    this.sons.activer(allume);
    ecrireSons(allume);
    this.dessiner();
  }

  /** Musique allumée ou coupée depuis le menu de l'icône. */
  signalerMusique(active: boolean): void {
    this.sons.activerMusique(active);
    ecrireMusique(active);
  }

  /** Taille de la fenêtre changée depuis le menu de l'icône. */
  signalerTaille(cote: number): void {
    this.tailleFenetre = cote;
    this.dessiner();
  }

  fermer(): void {
    this.bulle = null;
    this.survol = null;
    this.capaciteVue = null;
    this.fiche = null;
    this.livre = null;
    this.atelierVu = null;
    this.pauseMenu = false;
    if (this.reprendreA !== null) this.vitesse = this.reprendreA;
    this.reprendreA = null;
    this.dessiner();
  }

  /** Quitte la partie : la carte de l'île, ou l'archipel pour les vagues sans fin. */
  private quitterPartie(): void {
    this.aller(this.jeu.niveau === NIVEAU_SANS_FIN.id ? 'carte' : 'niveaux');
  }

  /** Le Colosse d'écorce battu ouvre les vagues sans fin. */
  private get sansFinOuvert(): boolean {
    return !!DERNIER_NIVEAU && (this.etoiles[DERNIER_NIVEAU] ?? 0) >= 1;
  }

  /** Dernier boss battu : retour à l'archipel, avec l'écran de victoire finale par-dessus. */
  finirJeu(): void {
    this.aller('carte');
    this.finale = true;
    this.sons.jouer('victoire');
    this.dessiner();
  }

  /** Change d'écran : accueil, parties, carte des îles ou partie. */
  aller(ecran: Ecran): void {
    this.fermer();
    this.creation = null;
    this.aSupprimer = null;
    this.finale = false;
    this.ecran = ecran;
    this.options.changerEcran(ecran, ecran === 'niveaux' ? this.ileChoisie : undefined);
    this.dessiner();
  }

  /** Difficulté de la partie choisie (vie des monstres). */
  get difficulte(): Difficulte {
    return this.parties[this.emplacement]?.difficulte ?? 'normal';
  }

  /** Charge la partie de l'emplacement `n` et ouvre l'archipel. */
  private reprendre(n: number): void {
    this.emplacement = n;
    this.etoiles = lireEtoiles(n);
    this.decouverts = lireDecouverts(n);
    this.toursVues = lireToursVues(n);
    this.atelier = lireAtelier(n);
    this.record = lireRecord(n);
    this.ileChoisie = 'foret';
    this.aller('carte');
  }

  private creer(n: number, difficulte: Difficulte): void {
    effacerPartie(n);
    this.parties = this.parties.map((p, i) => (i === n ? { difficulte } : p));
    ecrireParties(this.parties);
    this.creation = null;
    this.sons.jouer('capacite');
    this.reprendre(n);
  }

  private supprimer(n: number): void {
    effacerPartie(n);
    this.parties = this.parties.map((p, i) => (i === n ? null : p));
    ecrireParties(this.parties);
    this.aSupprimer = null;
    this.sons.jouer('arracher');
    this.dessiner();
  }

  /** Ouvre la carte d'une île : ses niveaux. */
  choisirIle(biome: Biome): void {
    this.ileChoisie = biome;
    this.aller('niveaux');
  }

  /** Lance une partie neuve sur ce niveau. */
  jouer(niveau: Niveau): void {
    this.nouveauRecord = false;
    this.options.lancer(niveau);
    this.vitesse = 1;
    this.aller('partie');
  }

  /** Étoiles gagnées sur les niveaux d'une île. */
  private etoilesIle(biome: Biome): number {
    return (NIVEAUX[biome] ?? []).reduce((n, x) => n + (this.etoiles[x.id] ?? 0), 0);
  }

  /** Capacités ouvertes dans l'Atelier, pour la prochaine partie. */
  get capacitesOuvertes(): Capacite[] {
    return [...this.atelier];
  }

  /** Étoiles gagnées (meilleures de chaque niveau) moins celles dépensées dans l'Atelier. */
  private soldeEtoiles(): number {
    const gagnees = Object.values(this.etoiles).reduce((n, e) => n + e, 0);
    return Math.max(0, gagnees - etoilesDepensees(this.atelier));
  }

  /** Atelier : on y ouvre les capacités du stade 4 avec les étoiles. */
  ouvrirAtelier(): void {
    this.fermer();
    this.atelierVu = CAPACITES_DE.ruche[0];
    this.dessiner();
  }

  private ouvrirCapacite(c: Capacite): void {
    const prix = etoilesPour(c, this.atelier);
    if (prix === 0 || prix > this.soldeEtoiles()) return;
    this.atelier = TOUTES_CAPACITES.filter((x) => x === c || this.atelier.includes(x));
    ecrireAtelier(this.emplacement, this.atelier);
    this.sons.jouer('capacite');
    this.dessiner();
  }

  private rembourser(): void {
    this.atelier = [];
    ecrireAtelier(this.emplacement, this.atelier);
    this.dessiner();
  }

  /** À rappeler quand la fenêtre change de taille (les îlots de la carte bougent à l'écran). */
  rafraichir(): void {
    this.dessiner();
  }

  /** Grimoire des monstres et des tours ; met le jeu en pause le temps de le lire. */
  ouvrirLivre(): void {
    this.fermer();
    this.livre = { onglet: 'monstres', choix: TYPES_MONSTRES[0]! };
    this.suspendre();
    this.dessiner();
  }

  /** Menu de la partie (bouton ✕ du bandeau) : recommencer ou retourner à la carte ; pause le temps de choisir. */
  private ouvrirPause(): void {
    const ouvert = this.pauseMenu;
    this.fermer();
    if (ouvert) return this.dessiner();
    this.pauseMenu = true;
    this.suspendre();
    this.dessiner();
  }

  private dessinerPause() {
    return (
      <section class="bulle haut menu">
        <header>
          <h2>{TEXTES.partie}</h2>
          <button class="bouton fermer" title={TEXTES.fermer} onClick={() => this.fermer()}>
            ✕
          </button>
        </header>
        <div class="corps">
          <button
            class="bouton large"
            onClick={() => {
              this.fermer();
              this.options.recommencer();
            }}
          >
            {TEXTES.recommencer}
          </button>
          <button class="bouton large" onClick={() => this.quitterPartie()}>
            {TEXTES.retourCarte}
          </button>
        </div>
      </section>
    );
  }

  private ouvrirFiche(type: TypeMonstre): void {
    this.fermer();
    this.decouvrir([type]);
    this.fiche = type;
    this.suspendre();
    this.dessiner();
  }

  /** Pause le temps d'une lecture, sans toucher à une pause demandée par le joueur. */
  private suspendre(): void {
    if (this.vitesse === 0) return;
    this.reprendreA = this.vitesse;
    this.vitesse = 0;
  }

  private decouvrir(types: readonly TypeMonstre[]): void {
    const avant = this.decouverts.size;
    for (const t of types) this.decouverts.add(t);
    if (this.decouverts.size !== avant) ecrireDecouverts(this.emplacement, this.decouverts);
  }

  /** Tour ou ronce à dessiner en fantôme : la carte survolée dans la bulle « Construire ». */
  get apercu(): Apercu | null {
    const b = this.bulle;
    if (!b || !this.instantane) return null;
    // Bulle de ronce encore à poser : la ronce en fantôme, cercle blanc ou rouge.
    if (this.natureCase(b.case) === 'ronce' && !this.instantane.ronces.some((r) => memeCase(r, b.case)))
      return { type: 'ronce', case: b.case, possible: this.jeu.ronceLibre(b.case), portee: 0.5 };
    if (!this.survol) return null;
    if (this.survol === 'fleur') return { type: 'fleur', case: b.case, possible: this.instantane.spores >= FLEUR.prix, portee: 0 };
    if (this.survol === 'lanterne')
      return { type: 'lanterne', case: b.case, possible: this.instantane.spores >= LANTERNE.prix, portee: LANTERNE.rayon };
    const haute = surPlateforme(this.jeu.ile, b.case);
    const prix = prixPour(TOURS[this.survol].stades[0].prix, haute);
    const portee = TOURS[this.survol].stades[0].portee + (haute ? PLATEFORME.portee : 0);
    return { type: this.survol, case: b.case, possible: this.instantane.spores >= prix, portee };
  }

  /** Tour dont on montre la portée : celle de la bulle ouverte. */
  get selection(): number | null {
    return this.tourDe(this.bulle?.case)?.id ?? null;
  }

  /** Case visée par la bulle ouverte (pour la marquer sur l'île). */
  get caseChoisie(): Case | null {
    return this.bulle?.case ?? null;
  }

  private tourDe(c: Case | undefined): TourVue | undefined {
    return c ? this.instantane?.tours.find((t) => memeCase(t.case, c)) : undefined;
  }

  private fleurDe(c: Case | undefined): FleurVue | undefined {
    return c ? this.instantane?.fleurs.find((f) => memeCase(f.case, c)) : undefined;
  }

  private lanterneDe(c: Case | undefined): LanterneVue | undefined {
    return c ? this.instantane?.lanternes.find((l) => memeCase(l.case, c)) : undefined;
  }

  private natureCase(c: Case): 'tour' | 'fleur' | 'lanterne' | 'ronce' | 'construire' | null {
    if (this.tourDe(c)) return 'tour';
    if (this.fleurDe(c)) return 'fleur';
    if (this.lanterneDe(c)) return 'lanterne';
    if (this.instantane?.regles.ronces !== false && this.jeu.emplacementsRonces.some((e) => memeCase(e, c))) return 'ronce';
    if (this.typesVisibles(c).length > 0 || this.jeu.fleurLibre(c) || this.jeu.lanterneLibre(c)) return 'construire';
    return null;
  }

  /** Tours à montrer dans la bulle de cette case : celles qui y vont, permises ici ou déjà découvertes. */
  private typesVisibles(c: Case): TypeTour[] {
    const permises = this.instantane?.regles.tours ?? [];
    return TYPES.filter((t) => this.jeu.libre(c, t) && (permises.includes(t) || this.toursVues.has(t)));
  }

  /** Une tour qu'on peut construire pour la première fois entre dans le grimoire et l'Atelier. */
  private decouvrirTours(types: readonly TypeTour[]): void {
    const avant = this.toursVues.size;
    for (const t of types) this.toursVues.add(t);
    if (this.toursVues.size !== avant) ecrireToursVues(this.emplacement, this.toursVues);
  }

  private executer(commande: Commande): boolean {
    // En pause, on ne construit rien (ni ne lance la vague).
    if (this.vitesse === 0) return false;
    const fait = this.jeu.executer(commande);
    if (fait) this.maj(this.jeu.instantane());
    return fait;
  }

  /** Pause, ou reprise à la vitesse d'avant (barre d'espace). */
  basculerPause(): void {
    this.changerVitesse(this.vitesse === 0 ? this.vitesseAvantPause : 0);
  }

  private changerVitesse(v: Vitesse): void {
    this.reprendreA = null;
    if (v !== 0) this.vitesseAvantPause = v;
    else this.bulle = null;
    this.vitesse = v;
    this.dessiner();
  }

  private dessiner(): void {
    if (this.ecran === 'accueil') return render(this.dessinerAccueil(), this.element);
    if (this.ecran === 'parties') return render(this.dessinerParties(), this.element);
    if (this.ecran === 'carte') return render(this.dessinerCarte(), this.element);
    if (this.ecran === 'niveaux') return render(this.dessinerNiveaux(), this.element);
    const i = this.instantane;
    if (!i) return;
    render(
      <div class="interface">
        <Bandeau
          i={i}
          vitesse={this.vitesse}
          lancer={() => this.executer({ type: 'lancerVague' })}
          pause={() => this.basculerPause()}
          rapide={() => this.changerVitesse(this.vitesse === 2 ? 1 : 2)}
          livre={() => this.ouvrirLivre()}
          carte={() => this.ouvrirPause()}
        />
        {(i.phase === 'victoire' || i.phase === 'defaite') && (
          <EcranFin
            i={i}
            rejouer={this.options.recommencer}
            carte={() => this.quitterPartie()}
            record={i.regles.sansFin ? { vague: this.record, nouveau: this.nouveauRecord } : undefined}
            suite={i.phase === 'victoire' && this.jeu.niveau === DERNIER_NIVEAU ? () => this.finirJeu() : undefined}
            vignette={(t) => this.options.vignette(t, 3)}
          />
        )}
        {this.dessinerArrivees(i)}
        {this.dessinerMedaillons(i)}
        {!this.livre && !this.fiche && !this.pauseMenu && <BarreBoss i={i} />}
        {this.bulle && this.dessinerBulle(i, this.bulle)}
        {this.fiche && (
          <section class="bulle haut fiche">
            <Entete
              titre={MONSTRES_TEXTES[this.fiche].nom}
              sous={TEXTES.nouveauMonstre}
              vignette={this.options.vignetteMonstre(this.fiche)}
              fermer={() => this.fermer()}
            />
            <div class="corps">
              <FicheMonstre type={this.fiche} />
            </div>
          </section>
        )}
        {this.livre && this.dessinerLivre(this.livre)}
        {this.pauseMenu && this.dessinerPause()}
      </div>,
      this.element,
    );
  }

  private dessinerAccueil() {
    const f = this.options.fenetre;
    return (
      <div class="interface">
        <div class="accueil">
          <div class="titre-jeu">
            <span class="surtitre">{TEXTES.surtitre}</span>
            <div class="ligne-titre">
              <img class="vignette" src={this.options.vignette('canon', 3)} alt="" />
              <h1>
                <span>Spore</span>
                <span class="rouge">Siege</span>
              </h1>
              <img class="vignette" src={this.options.vignetteMonstre('limace')} alt="" />
            </div>
            <p class="accroche">{TEXTES.accroche}</p>
          </div>
          <div class="panneau-accueil">
            <button class="bouton valider principal" onClick={() => this.aller('parties')}>
              ▶ {TEXTES.jouer}
            </button>
            {f && (
              <button class="bouton danger" onClick={() => f.quitter()}>
                {TEXTES.quitter}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  /** Les 3 emplacements de partie, sur l'archipel. */
  private dessinerParties() {
    return (
      <div class="interface">
        <div class="bandeau">
          <button class="bouton carre" title={TEXTES.retourAccueil} onClick={() => this.aller('accueil')}>
            ←
          </button>
          <span class="planche">{TEXTES.parties}</span>
        </div>
        <div class="emplacements">{this.parties.map((p, n) => this.dessinerEmplacement(n, p))}</div>
      </div>
    );
  }

  private dessinerEmplacement(n: number, p: Sauvegarde | null) {
    const numero = <span class="numero">{n + 1}</span>;
    if (!p) {
      if (this.creation !== n) {
        return (
          <button class="emplacement vide" onClick={() => ((this.creation = n), (this.aSupprimer = null), this.dessiner())}>
            {numero}
            <span class="plus">+</span>
            <span class="nouvelle">{TEXTES.nouvellePartie}</span>
          </button>
        );
      }
      return (
        <div class="emplacement">
          <header>
            {numero}
            <span class="titre-emplacement">{TEXTES.choisirDifficulte}</span>
            <button class="bouton fermer" title={TEXTES.annuler} onClick={() => ((this.creation = null), this.dessiner())}>
              ✕
            </button>
          </header>
          <div class="corps difficultes">
            {DIFFICULTES.map((d) => (
              <button class={`bouton choix-difficulte ${d}`} title={TEXTES.difficulteAide[d]} onClick={() => this.creer(n, d)}>
                <span class="nom">{TEXTES.difficulte[d]}</span>
                <span class="vie-monstres">
                  <Ico nom="vie" />
                  {Math.round(VIE_DIFFICULTE[d] * 100)} %
                </span>
              </button>
            ))}
          </div>
        </div>
      );
    }
    const etoiles = lireEtoiles(n);
    const biomes = Object.keys(NIVEAUX) as Biome[];
    const toutes = Object.keys(ILES_TEXTES) as Biome[];
    const gagnees = Object.values(etoiles).reduce((t, e) => t + e, 0);
    // Comme le bandeau de l'archipel : les îles à venir comptent 5 niveaux.
    const maximum = toutes.reduce((t, b) => t + 3 * (NIVEAUX[b]?.length ?? 5), 0);
    // Île atteinte : la dernière ouverte (le boss de la précédente battu).
    let atteinte = 0;
    for (let k = 1; k < biomes.length; k++) {
      const prec = NIVEAUX[biomes[k - 1]!]!;
      if ((etoiles[prec[prec.length - 1]!.id] ?? 0) < 1) break;
      atteinte = k;
    }
    const ile = biomes[atteinte]!;
    if (this.aSupprimer === n) {
      return (
        <div class="emplacement alerte">
          <header>
            {numero}
            <span class="titre-emplacement">{TEXTES.supprimerQuestion}</span>
          </header>
          <div class="corps">
            <p class="perte">
              {ILES_TEXTES[ile]} · <Ico nom="etoile" />
              {`${gagnees}/${maximum}`} · {TEXTES.perdue}
            </p>
            <div class="actions">
              <button class="bouton" onClick={() => ((this.aSupprimer = null), this.dessiner())}>
                {TEXTES.annuler}
              </button>
              <button class="bouton danger" onClick={() => this.supprimer(n)}>
                {TEXTES.supprimer}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div class="emplacement">
        <header>
          {numero}
          <span class="titre-emplacement">{ILES_TEXTES[ile]}</span>
          <span class={`difficulte ${p.difficulte}`}>{TEXTES.difficulte[p.difficulte]}</span>
          <button class="bouton fermer" title={TEXTES.supprimer} onClick={() => ((this.aSupprimer = n), (this.creation = null), this.dessiner())}>
            ✕
          </button>
        </header>
        <div class="corps">
          <div class="progres">
            <span class="etoiles-emplacement">
              <Ico nom="etoile" />
              {gagnees}
              <span class="sur">/{maximum}</span>
            </span>
            <span class="piste" title={ILES_TEXTES[ile]}>
              {toutes.map((b, k) => (
                <span class={`ilot-piste ${b}${k < atteinte ? ' faite' : k === atteinte ? ' ici' : ''}`} title={ILES_TEXTES[b]} />
              ))}
            </span>
          </div>
          <button class="bouton valider continuer" title={TEXTES.continuer} onClick={() => this.reprendre(n)}>
            {TEXTES.jouer} <span class="fleche">▶</span>
          </button>
        </div>
      </div>
    );
  }

  private dessinerCarte() {
    const iles = this.options.positionsCarte();
    const biomes = iles.map(({ cle }) => cle as Biome);
    const total = biomes.reduce((n, b) => n + this.etoilesIle(b), 0);
    const maximum = biomes.reduce((n, b) => n + 3 * (NIVEAUX[b]?.length ?? 5), 0);
    return (
      <div class="interface">
        <div class="bandeau">
          <button class="bouton carre" title={TEXTES.retourParties} onClick={() => this.aller('parties')}>
            ←
          </button>
          <span class="planche" title={TEXTES.etoilesTotal}>
            <Ico nom="etoile" />
            {`${total}/${maximum}`}
          </span>
          <span class="planche">{TEXTES.archipel}</span>
          <span class="espace" />
          {this.sansFinOuvert && (
            <button class="bouton carre sans-fin" title={TEXTES.sansFinAide(this.record)} onClick={() => this.jouer(NIVEAU_SANS_FIN)}>
              <Ico nom="infini" />
            </button>
          )}
          <button class="bouton carre" title={TEXTES.atelierAide} onClick={() => (this.atelierVu ? this.fermer() : this.ouvrirAtelier())}>
            <Ico nom="enclume" />
          </button>
          <button class="bouton carre" title={TEXTES.grimoire} onClick={() => (this.livre ? this.fermer() : this.ouvrirLivre())}>
            <Ico nom="livre" />
          </button>
        </div>
        {iles.map(({ cle, x, y }, n) => {
          const biome = cle as Biome;
          const precedente = NIVEAUX[biomes[n - 1]!];
          // Une île s'ouvre quand le boss (dernier niveau) de la précédente est battu.
          const ouverte = n === 0 || (!!precedente && (this.etoiles[precedente[precedente.length - 1]!.id] ?? 0) >= 1);
          const jouable = ouverte && !!NIVEAUX[biome];
          return (
            <button
              class={`repere${jouable ? '' : ' ferme'}`}
              style={{ left: `${x}px`, top: `${y}px` }}
              title={jouable ? TEXTES.jouerIle(ILES_TEXTES[biome]) : ouverte ? TEXTES.pasEncore : TEXTES.verrouillee}
              disabled={!jouable}
              onClick={() => this.choisirIle(biome)}
            >
              <span class="etiquette">
                {jouable ? (
                  <span class="planche petite">
                    <Ico nom="etoile" />
                    {`${this.etoilesIle(biome)}/${3 * NIVEAUX[biome]!.length}`}
                  </span>
                ) : (
                  <Ico nom="cadenas" />
                )}
                <span class="planche">{jouable ? ILES_TEXTES[biome] : `${ILES_TEXTES[biome]} · ${TEXTES.bientot}`}</span>
              </span>
            </button>
          );
        })}
        {this.livre && this.dessinerLivre(this.livre)}
        {this.atelierVu && this.dessinerAtelier(this.atelierVu)}
        {this.finale && this.dessinerFinale()}
      </div>
    );
  }

  /** Victoire finale : la Rouille recule, étoiles de chaque île, total, merci. */
  private dessinerFinale() {
    const iles = (Object.keys(NIVEAUX) as Biome[]).filter((b) => NIVEAUX[b]);
    const total = iles.reduce((n, b) => n + this.etoilesIle(b), 0);
    const maximum = iles.reduce((n, b) => n + 3 * NIVEAUX[b]!.length, 0);
    return (
      <div class="voile finale">
        {SPORES_FINALE.map(([x, retard, duree]) => (
          <span class="spore-finale" style={{ left: `${x}%`, animationDelay: `${retard}s`, animationDuration: `${duree}s` }} />
        ))}
        <section class="bulle fin gagne finale">
          <header>
            <h2>{TEXTES.finTitre}</h2>
          </header>
          <div class="corps">
            <p class="recit">{TEXTES.finRecit}</p>
            <ul class="iles-finale">
              {iles.map((b, k) => (
                <li style={{ animationDelay: `${0.4 + k * 0.25}s` }}>
                  <span class={`ilot-piste ${b} faite`} />
                  <span class="nom">{ILES_TEXTES[b]}</span>
                  <span class="qte">
                    <Ico nom="etoile" />
                    {`${this.etoilesIle(b)}/${3 * NIVEAUX[b]!.length}`}
                  </span>
                </li>
              ))}
            </ul>
            <p class="total" title={TEXTES.finTotal}>
              <Ico nom="etoile" />
              {total}
              <span class="sur">/{maximum}</span>
              <span class={`difficulte ${this.difficulte}`}>{TEXTES.difficulte[this.difficulte]}</span>
            </p>
            <p class="merci">{TEXTES.merci}</p>
            <p class="annonce">
              <Ico nom="infini" />
              {TEXTES.sansFinNouveau}
            </p>
            <button class="bouton valider large" onClick={() => ((this.finale = false), this.dessiner())}>
              {TEXTES.retourArchipelLong}
            </button>
          </div>
        </section>
      </div>
    );
  }

  /** Carte d'une île : ses niveaux, leurs étoiles, les verrous (dont le seuil du boss). */
  private dessinerNiveaux() {
    const niveaux = NIVEAUX[this.ileChoisie] ?? [];
    const places = new Map(this.options.positionsCarte().map((p) => [p.cle, p]));
    return (
      <div class="interface">
        <div class="bandeau">
          <button class="bouton carre" title={TEXTES.retourArchipel} onClick={() => this.aller('carte')}>
            ←
          </button>
          <span class="planche" title={TEXTES.ileEtoiles}>
            <Ico nom="etoile" />
            {`${this.etoilesIle(this.ileChoisie)}/${3 * niveaux.length}`}
          </span>
          <span class="planche">{ILES_TEXTES[this.ileChoisie]}</span>
          <span class="espace" />
          <button class="bouton carre" title={TEXTES.atelierAide} onClick={() => (this.atelierVu ? this.fermer() : this.ouvrirAtelier())}>
            <Ico nom="enclume" />
          </button>
          <button class="bouton carre" title={TEXTES.grimoire} onClick={() => (this.livre ? this.fermer() : this.ouvrirLivre())}>
            <Ico nom="livre" />
          </button>
        </div>
        {niveaux.map((niveau, rang) => {
          const place = places.get(niveau.id);
          if (!place) return null;
          const ouvert = niveauOuvert(niveaux, rang, this.etoiles);
          const precedentGagne = rang === 0 || (this.etoiles[niveaux[rang - 1]!.id] ?? 0) >= 1;
          const etoiles = this.etoiles[niveau.id] ?? 0;
          return (
            <button
              class={`repere${ouvert ? '' : ' ferme'}${niveau.boss ? ' boss' : ''}`}
              style={{ left: `${place.x}px`, top: `${place.y}px` }}
              title={ouvert ? TEXTES.jouerNiveau(niveau.nom) : niveau.boss && precedentGagne ? TEXTES.bossFerme(SEUIL_BOSS) : TEXTES.niveauFerme}
              disabled={!ouvert}
              onClick={() => this.jouer(niveau)}
            >
              <span class="etiquette">
                {ouvert ? (
                  <span class="petites-etoiles">
                    {[1, 2, 3].map((k) => (
                      <img src={icone(k <= etoiles ? 'etoile' : 'etoileVide')} alt="" />
                    ))}
                  </span>
                ) : niveau.boss && precedentGagne ? (
                  <span class="planche petite">
                    <Ico nom="cadenas" />
                    {`${this.etoilesIle(this.ileChoisie) - (this.etoiles[niveau.id] ?? 0)}/${SEUIL_BOSS}`}
                    <Ico nom="etoile" />
                  </span>
                ) : (
                  <Ico nom="cadenas" />
                )}
                <span class="planche">
                  {niveau.boss ? `${TEXTES.boss} · ` : `${rang + 1}. `}
                  {niveau.nom}
                </span>
              </span>
            </button>
          );
        })}
        {this.livre && this.dessinerLivre(this.livre)}
        {this.atelierVu && this.dessinerAtelier(this.atelierVu)}
      </div>
    );
  }

  /** Médaillons des monstres jamais vus qui arrivent avec la vague en cours ou à venir. */
  /** Pendant la préparation : un panneau au-dessus de chaque plage d'où viendra la vague, avec ses monstres. */
  private dessinerArrivees(i: Instantane) {
    if (i.phase !== 'pause' || i.arrivees.length === 0) return null;
    if (this.fiche || this.livre || this.pauseMenu) return null;
    const places = this.options.ecranDe(i.arrivees.map((a) => a.depart));
    return i.arrivees.map((a, k) => {
      const place = places[k];
      if (!place) return null;
      const noms = a.types.map((t) => MONSTRES_TEXTES[t].nom).join(', ');
      return (
        <div class="arrivee" style={{ left: `${place.x}px`, top: `${place.y}px` }} title={TEXTES.arriveeAide(noms)}>
          <span class="panneau">
            {a.types.slice(0, 3).map((t) => (
              <img class="vignette" src={this.options.vignetteMonstre(t)} alt="" />
            ))}
            {a.types.length > 3 && <span class="plus">+{a.types.length - 3}</span>}
          </span>
          <span class="fleche" />
        </div>
      );
    });
  }

  private dessinerMedaillons(i: Instantane) {
    if (i.phase !== 'pause' && i.phase !== 'vague') return null;
    if (this.bulle || this.fiche || this.livre || this.pauseMenu) return null;
    const nouveaux = i.monstresVague.filter((t) => !this.decouverts.has(t));
    if (nouveaux.length === 0) return null;
    return (
      <div class="medaillons">
        {nouveaux.map((t) => (
          <button class="medaillon" title={TEXTES.nouveauAide(MONSTRES_TEXTES[t].nom)} onClick={() => this.ouvrirFiche(t)}>
            <img class="vignette" src={this.options.vignetteMonstre(t)} alt="" />
            <span class="nouveau">!</span>
          </button>
        ))}
      </div>
    );
  }

  private dessinerAtelier(vue: Capacite) {
    const solde = this.soldeEtoiles();
    const prixVue = etoilesPour(vue, this.atelier);
    const manqueVue = prixVue > solde;
    const choisir = (c: Capacite) => {
      this.atelierVu = c;
      this.dessiner();
    };
    return (
      <section class="bulle haut livre atelier">
        <Entete titre={TEXTES.atelier} sous={TEXTES.solde(solde)} fermer={() => this.fermer()} />
        <div class="corps">
          <div class="colonnes">
            {TYPES.map((t) => {
              const tourVue = this.toursVues.has(t);
              return (
                <div class="colonne">
                  <span class="tete">{tourVue ? TOURS_TEXTES[t].nom : TEXTES.inconnu}</span>
                  {CAPACITES_DE[t].map((c) => {
                    const ouverte = this.atelier.includes(c);
                    const prix = etoilesPour(c, this.atelier);
                    if (!tourVue)
                      return (
                        <button class="carte manque" disabled>
                          <img class="vignette silhouette" src={this.options.vignette(t, 4, c)} alt="" />
                          <span class="nom">{TEXTES.inconnu}</span>
                          <span class="qte manque">
                            <Ico nom="cadenas" />
                          </span>
                        </button>
                      );
                    return (
                      <button class={`carte${ouverte ? ' ouverte' : prix > solde ? ' manque' : ''}${vue === c ? ' choisie' : ''}`} onClick={() => choisir(c)}>
                        <img class={`vignette${ouverte ? '' : ' fermee'}`} src={this.options.vignette(t, 4, c)} alt="" />
                        <span class="nom">{CAPACITES_TEXTES[c].nom}</span>
                        <span class={`qte${!ouverte && prix > solde ? ' manque' : ''}`}>
                          {ouverte ? '✓' : <>{prix}<Ico nom="etoile" /></>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <div class="detail">
            <h3>{CAPACITES_TEXTES[vue].nom}</h3>
            <p>{CAPACITES_TEXTES[vue].role}</p>
            <p class="discret">{TEXTES.atelierExplication}</p>
          </div>
          <div class="rang">
            {this.atelier.includes(vue) ? (
              <button class="bouton valider" disabled>
                {TEXTES.ouverte}
              </button>
            ) : (
              <button class={`bouton valider${manqueVue ? ' manque' : ''}`} disabled={manqueVue} onClick={() => this.ouvrirCapacite(vue)}>
                {TEXTES.ouvrir} · {prixVue} <Ico nom="etoile" />
              </button>
            )}
            <button class="bouton danger" disabled={this.atelier.length === 0} onClick={() => this.rembourser()}>
              {TEXTES.toutRembourser}
            </button>
          </div>
        </div>
      </section>
    );
  }

  private dessinerLivre(livre: Livre) {
    const choisir = (l: Livre) => {
      this.livre = l;
      this.dessiner();
    };
    const vus = TYPES_MONSTRES.filter((t) => this.decouverts.has(t)).length;
    return (
      <section class="bulle haut livre">
        <Entete titre={TEXTES.grimoire} fermer={() => this.fermer()} />
        <div class="corps">
          <div class="rang onglets">
            <button
              class={`bouton${livre.onglet === 'monstres' ? ' actif' : ''}`}
              onClick={() => choisir({ onglet: 'monstres', choix: TYPES_MONSTRES[0]! })}
            >
              {TEXTES.ongletMonstres(vus, TYPES_MONSTRES.length)}
            </button>
            <button class={`bouton${livre.onglet === 'tours' ? ' actif' : ''}`} onClick={() => choisir({ onglet: 'tours', choix: TYPES[0]! })}>
              {TEXTES.ongletTours(TYPES.filter((t) => this.toursVues.has(t)).length, TYPES.length)}
            </button>
          </div>
          {livre.onglet === 'monstres' ? (
            <>
              <ul class="collection">
                {TYPES_MONSTRES.map((t) => {
                  const vu = this.decouverts.has(t);
                  return (
                    <li>
                      <button class={`carte${livre.choix === t ? ' choisie' : ''}`} onClick={() => choisir({ onglet: 'monstres', choix: t })}>
                        <img class={`vignette${vu ? '' : ' silhouette'}`} src={this.options.vignetteMonstre(t)} alt="" />
                        <span class="nom">{vu ? MONSTRES_TEXTES[t].nom : TEXTES.inconnu}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div class="detail">
                {this.decouverts.has(livre.choix) ? (
                  <>
                    <h3>{MONSTRES_TEXTES[livre.choix].nom}</h3>
                    <FicheMonstre type={livre.choix} />
                  </>
                ) : (
                  <>
                    <h3>{TEXTES.inconnu}</h3>
                    <p class="discret">{TEXTES.inconnuDetail}</p>
                  </>
                )}
              </div>
            </>
          ) : (
            <>
              <ul class="catalogue">
                {TYPES.map((t) => {
                  const vue = this.toursVues.has(t);
                  return (
                    <li>
                      <button class={`carte${livre.choix === t ? ' choisie' : ''}`} onClick={() => choisir({ onglet: 'tours', choix: t })}>
                        <img class={`vignette${vue ? '' : ' silhouette'}`} src={this.options.vignette(t, 3)} alt="" />
                        <span class="nom">{vue ? TOURS_TEXTES[t].nom : TEXTES.inconnu}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div class="detail">
                {this.toursVues.has(livre.choix) ? (
                  <>
                    <h3>{TOURS_TEXTES[livre.choix].nom}</h3>
                    <p>{TOURS_TEXTES[livre.choix].role}</p>
                    <TableTour type={livre.choix} />
                  </>
                ) : (
                  <>
                    <h3>{TEXTES.inconnu}</h3>
                    <p class="discret">{TEXTES.inconnuTour}</p>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  private dessinerBulle(i: Instantane, b: Bulle) {
    const nature = this.natureCase(b.case);
    const fermer = () => this.fermer();
    if (nature === 'tour') {
      const t = this.tourDe(b.case)!;
      return (
        <BulleTour
          t={t}
          i={i}
          enHaut={b.enHaut}
          vignette={this.options.vignette(t.type, t.stade, t.capacite)}
          vignetteCapacite={(c) => this.options.vignette(t.type, 4, c)}
          capaciteVue={this.capaciteVue ?? CAPACITES_DE[t.type].find((c) => i.regles.capacites.includes(c)) ?? CAPACITES_DE[t.type][0]}
          voirCapacite={(c) => {
            this.capaciteVue = c;
            this.dessiner();
          }}
          choisirCapacite={(c) => this.executer({ type: 'choisirCapacite', id: t.id, capacite: c })}
          fermer={fermer}
          ameliorer={() => this.executer({ type: 'ameliorerTour', id: t.id })}
          vendre={() => this.executer({ type: 'vendreTour', id: t.id }) && fermer()}
          cibler={(mode) => this.executer({ type: 'ciblerTour', id: t.id, mode })}
        />
      );
    }
    if (nature === 'fleur') {
      const f = this.fleurDe(b.case)!;
      return (
        <BullePlante
          titre={TEXTES.fleur}
          role={TEXTES.fleurRoleArracher(FLEUR.rapport)}
          action={TEXTES.arracher}
          revente={f.revente}
          enHaut={b.enHaut}
          vignette={this.options.vignette('fleur', 1)}
          fermer={fermer}
          enlever={() => this.executer({ type: 'arracherFleur', id: f.id }) && fermer()}
        />
      );
    }
    if (nature === 'lanterne') {
      const l = this.lanterneDe(b.case)!;
      return (
        <BullePlante
          titre={TEXTES.lanterne}
          role={TEXTES.lanterneRoleEnlever}
          action={TEXTES.enlever}
          revente={l.revente}
          enHaut={b.enHaut}
          vignette={this.options.vignette('lanterne', 1)}
          fermer={fermer}
          enlever={() => this.executer({ type: 'enleverLanterne', id: l.id }) && fermer()}
        />
      );
    }
    if (nature === 'ronce') {
      const posee = i.ronces.some((r) => memeCase(r, b.case));
      return (
        <BulleRonce
          i={i}
          enHaut={b.enHaut}
          posee={posee}
          possible={posee || this.jeu.ronceLibre(b.case)}
          vignette={this.options.vignette('ronce', 1)}
          fermer={fermer}
          agir={() =>
            this.executer(posee ? { type: 'enleverRonce', case: b.case } : { type: 'poserRonce', case: b.case }) && fermer()
          }
        />
      );
    }
    if (nature === 'construire') {
      const types = this.typesVisibles(b.case);
      this.decouvrirTours(types.filter((t) => i.regles.tours.includes(t)));
      return (
        <BulleConstruire
          i={i}
          types={types}
          haute={surPlateforme(this.jeu.ile, b.case)}
          plante={this.jeu.fleurLibre(b.case) ? 'fleur' : this.jeu.lanterneLibre(b.case) ? 'lanterne' : null}
          enHaut={b.enHaut}
          survol={this.survol}
          vignette={(t) => this.options.vignette(t, 1)}
          fermer={fermer}
          survoler={(t) => {
            this.survol = t;
            this.dessiner();
          }}
          poser={(t) =>
            this.executer(
              t === 'fleur'
                ? { type: 'planterFleur', case: b.case }
                : t === 'lanterne'
                  ? { type: 'poserLanterne', case: b.case }
                  : { type: 'poserTour', tour: t, case: b.case },
            ) && fermer()
          }
        />
      );
    }
    return null;
  }

}

// ─── Composants ────────────────────────────────────────────────────────────────────────────────

function Ico({ nom }: { nom: Icone }) {
  return <img class="icone" src={icone(nom)} alt="" />;
}

function Prix({ n, manque }: { n: number; manque?: boolean }) {
  return (
    <span class={`qte${manque ? ' manque' : ''}`}>
      <Ico nom="spore" />
      {n}
    </span>
  );
}

/** Grande barre de vie du boss, sous le bandeau, tant qu'il est là ; encoches aux paliers où il pond. */
function BarreBoss({ i }: { i: Instantane }) {
  const boss = i.phase === 'vague' ? i.monstres.find((m) => MONSTRES[m.type].boss) : undefined;
  if (!boss) return null;
  const part = Math.max(0, boss.pv / boss.pvMax);
  return (
    <div class="barre-boss">
      <span class="nom">{MONSTRES_TEXTES[boss.type].nom}</span>
      <div class="jauge">
        <div class="vie" style={{ width: `${part * 100}%` }} />
        {MONSTRES[boss.type].boss!.paliers.map((p) => (
          <span class={`encoche${part <= p.part ? ' passee' : ''}`} style={{ left: `${p.part * 100}%` }} />
        ))}
      </div>
    </div>
  );
}

function Bandeau(p: {
  i: Instantane;
  vitesse: Vitesse;
  lancer: () => void;
  pause: () => void;
  rapide: () => void;
  livre: () => void;
  carte: () => void;
}) {
  const { i } = p;
  const fin = i.phase === 'victoire' || i.phase === 'defaite';
  return (
    <div class="bandeau">
      <span class="planche" title={TEXTES.vagueAide}>
        <Ico nom="vague" />
        {i.regles.sansFin ? TEXTES.vagueSansFin(i.vague) : TEXTES.vague(i.vague, i.vagues)}
        {i.phase === 'pause' && <span class="discret">{` · ${i.pauseRestante} s`}</span>}
      </span>
      <span class={`planche${i.souche.pv <= i.souche.pvMax / 4 ? ' alerte' : ''}`} title={TEXTES.vieAide}>
        <Ico nom="vie" />
        {i.souche.pv}
      </span>
      <span class="planche" title={TEXTES.sporesAide}>
        <Ico nom="spore" />
        {i.spores}
      </span>
      <span class="espace" />
      {i.phase === 'pause' && (
        <button class="bouton valider" title={TEXTES.lancerAide(i.bonusLancer)} onClick={p.lancer}>
          {TEXTES.lancer} <span class="bonus">+{i.bonusLancer}</span>
        </button>
      )}
      {!fin && (
        <>
          <button
            class={`bouton carre${p.vitesse === 0 ? ' actif' : ''}`}
            title={p.vitesse === 0 ? TEXTES.reprendre : TEXTES.pause}
            onClick={p.pause}
          >
            <Ico nom={p.vitesse === 0 ? 'lecture' : 'pause'} />
          </button>
          <button class={`bouton carre${p.vitesse === 2 ? ' actif' : ''}`} title={TEXTES.rapide} onClick={p.rapide}>
            <Ico nom="rapide" />
          </button>
        </>
      )}
      <button class="bouton carre" title={TEXTES.grimoire} onClick={p.livre}>
        <Ico nom="livre" />
      </button>
      <button class="bouton carre" title={TEXTES.partie} onClick={p.carte}>
        ✕
      </button>
    </div>
  );
}

/** Dégâts, portée et recharge d'un stade de tour ; `suivant` montre l'amélioration. */
/** Chiffres d'une tour à un stade ; au stade 4, ceux de sa capacité. */
function stadeVu(type: TypeTour, stade: number, capacite: Capacite | null = null): StadeTour {
  return capacite ? CAPACITES[capacite] : TOURS[type].stades[stade - 1]!;
}

/** Ce que les trois chiffres ne disent pas : rebonds, zone, ralenti, et l'effet de la capacité. */
function extrasDe(type: TypeTour, s: StadeTour, capacite: Capacite | null): string[] {
  const fiche = TOURS[type];
  const c = capacite ? CAPACITES[capacite] : null;
  const rayon = c?.rayon ?? fiche.projectile?.rayon ?? 0;
  return [
    c?.tirs ? TEXTES.tirs(c.tirs) : null,
    s.rebonds ? TEXTES.rebonds(s.rebonds) : null,
    rayon > 0 ? TEXTES.zone : null,
    fiche.ralenti ? TEXTES.ralentit : null,
    c?.percant ? TEXTES.perce : null,
    c?.poison ? TEXTES.poison(c.poison.degatsParSeconde, c.poison.duree) : null,
    c?.flaque ? TEXTES.flaque(c.flaque.duree) : null,
  ].filter((x): x is string => x !== null);
}

/** Les trois chiffres d'un stade, et la flèche vers le suivant (stade ou capacité) s'il y en a un. */
function Stats({
  type,
  stade,
  capacite = null,
  vers,
  bonusPortee = 0,
}: {
  type: TypeTour;
  stade: number;
  capacite?: Capacite | null;
  vers?: { stade: number; capacite?: Capacite };
  /** Portée en plus (tour sur une plateforme). */
  bonusPortee?: number;
}) {
  const plus = <T extends { portee: number }>(s: T): T => ({ ...s, portee: s.portee + bonusPortee });
  const a = plus(stadeVu(type, stade, capacite));
  const b = vers ? plus(stadeVu(type, vers.stade, vers.capacite ?? null)) : undefined;
  const fleche = (x: number, y: number | undefined, f: (n: number) => string = nombre) =>
    y === undefined || f(y) === f(x) ? f(x) : (
      <>
        {f(x)} <span class="mieux">→ {f(y)}</span>
      </>
    );
  const extras = vers ? extrasDe(type, b!, vers.capacite ?? null) : extrasDe(type, a, capacite);
  return (
    <>
      <ul class="stats">
        <li title={TEXTES.degats}>
          <Ico nom="degats" />
          {fleche(a.degats, b?.degats)}
        </li>
        <li title={TEXTES.portee}>
          <Ico nom="portee" />
          {fleche(a.portee, b?.portee)}
        </li>
        <li title={TEXTES.cadence}>
          <Ico nom="cadence" />
          {fleche(a.cadence, b?.cadence, TEXTES.secondes)}
        </li>
      </ul>
      {extras.length > 0 && <p class="discret">{extras.join(' · ')}</p>}
    </>
  );
}

/** Dernier niveau du parcours : le battre ouvre l'écran de victoire finale. */
const DERNIER_NIVEAU = NIVEAUX.futaie?.[NIVEAUX.futaie.length - 1]?.id;
/** Spores dorées qui montent derrière la victoire finale : position (%), retard et durée (s). */
const SPORES_FINALE: [number, number, number][] = Array.from({ length: 14 }, (_, k) => [(k * 37 + 11) % 96 + 2, (k * 0.53) % 3, 3 + ((k * 7) % 5) * 0.4]);

/** Fin de partie : titre, étoiles qui tombent une à une, vie restante, Rejouer (la carte viendra en 4c). */
function EcranFin({
  i,
  rejouer,
  carte,
  suite,
  record,
  vignette,
}: {
  i: Instantane;
  rejouer: () => void;
  carte: () => void;
  suite?: () => void;
  /** Vagues sans fin : record de la partie (déjà mis à jour) et s'il vient d'être battu. */
  record?: { vague: number; nouveau: boolean };
  vignette: (t: TypeTour) => string;
}) {
  const victoire = i.phase === 'victoire';
  // Bilan : dégâts de chaque sorte de tour, de la plus utile à la moins utile (celles qui n'ont rien fait, absentes).
  const bilan = TYPES.map((t) => ({ t, n: Math.round(i.degats[t]) }))
    .filter((b) => b.n > 0)
    .sort((a, b) => b.n - a.n);
  const plus = bilan[0]?.n ?? 1;
  return (
    <div class="voile">
      <section class={`bulle fin ${victoire ? 'gagne' : 'perdu'}`}>
        <header>
          <h2>{victoire ? TEXTES.victoire : TEXTES.defaite}</h2>
        </header>
        <div class="corps">
          {record ? (
            <p class={`record${record.nouveau ? ' nouveau' : ''}`}>
              <Ico nom="infini" />
              {record.nouveau ? TEXTES.nouveauRecord : TEXTES.record(record.vague)}
            </p>
          ) : (
            <div class="etoiles" title={TEXTES.etoilesAide}>
              {[1, 2, 3].map((n) => (
                <img class={`etoile${n <= i.etoiles ? ' gagnee' : ''}`} style={{ animationDelay: `${0.25 + n * 0.3}s` }} src={icone(n <= i.etoiles ? 'etoile' : 'etoileVide')} alt="" />
              ))}
            </div>
          )}
          <p class="sous-titre">{victoire ? TEXTES.victoireSous : record ? TEXTES.sansFinSous(i.vague) : TEXTES.defaiteSous(i.vague, i.vagues)}</p>
          <p class="vie">
            <Ico nom="vie" />
            {TEXTES.vieRestante(i.souche.pv, i.souche.pvMax)}
          </p>
          {victoire && <p class="discret">{TEXTES.etoileSuivante(i.etoiles)}</p>}
          {bilan.length > 0 && (
            <ul class="bilan" title={TEXTES.bilanAide}>
              {bilan.map(({ t, n }) => (
                <li>
                  <img class="vignette" src={vignette(t)} alt="" />
                  <span class="nom">{TOURS_TEXTES[t].nom}</span>
                  <span class="barre">
                    <span style={{ width: `${(100 * n) / plus}%` }} />
                  </span>
                  <span class="qte">{n}</span>
                </li>
              ))}
            </ul>
          )}
          <div class="rang choix">
            {suite ? (
              <>
                <button class="bouton" onClick={rejouer}>
                  {TEXTES.rejouer}
                </button>
                <button class="bouton valider" title={TEXTES.suiteAide} onClick={suite}>
                  {TEXTES.suite} <span class="fleche">▶</span>
                </button>
              </>
            ) : (
              <>
                <button class="bouton" onClick={carte}>
                  {TEXTES.carte}
                </button>
                <button class="bouton valider" onClick={rejouer}>
                  {TEXTES.rejouer}
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Description, chiffres et conseil d'un monstre (fiche « nouveau monstre » et grimoire). */
function FicheMonstre({ type }: { type: TypeMonstre }) {
  const f = MONSTRES[type];
  const t = MONSTRES_TEXTES[type];
  const chiffres: [Icone, string, string, string][] = [
    ['vie', TEXTES.pvCourt, TEXTES.pv, String(f.pv)],
    ['rapide', TEXTES.vitesseCourt, TEXTES.vitesse, nombre(f.vitesse)],
    ['armure', TEXTES.armureCourt, TEXTES.armure, String(f.armure)],
    ['degats', TEXTES.morsureCourt, TEXTES.morsure, String(f.morsure)],
    ['spore', TEXTES.butinCourt, TEXTES.butin, String(f.butin)],
  ];
  return (
    <>
      <p>{t.description}</p>
      <ul class="chiffres">
        {chiffres.map(([ico, court, long, valeur]) => (
          <li title={long}>
            <Ico nom={ico} />
            <span class="libelle">{court}</span>
            <b>{valeur}</b>
          </li>
        ))}
      </ul>
      <p class="conseil">{t.conseil}</p>
    </>
  );
}

/** Les trois stades d'une tour côte à côte : prix, dégâts, portée, recharge. */
function TableTour({ type }: { type: TypeTour }) {
  const fiche = TOURS[type];
  const extras = [
    fiche.projectile && fiche.projectile.rayon > 0 ? TEXTES.zone : null,
    fiche.ralenti ? TEXTES.ralentit : null,
    fiche.stades.some((s) => s.rebonds) ? TEXTES.rebondsStades(fiche.stades.map((s) => s.rebonds ?? 0)) : null,
  ].filter(Boolean);
  const colonnes: [Icone, string][] = [
    ['spore', TEXTES.prix],
    ['degats', TEXTES.degats],
    ['portee', TEXTES.portee],
    ['cadence', TEXTES.cadence],
  ];
  return (
    <>
      <table class="stades">
        <thead>
          <tr>
            <th />
            {colonnes.map(([ico, nom]) => (
              <th title={nom}>
                <Ico nom={ico} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {fiche.stades.map((s, n) => (
            <tr>
              <th>{TEXTES.stadeCourt(n + 1)}</th>
              <td>{s.prix}</td>
              <td>{nombre(s.degats)}</td>
              <td>{nombre(s.portee)}</td>
              <td>{TEXTES.secondes(s.cadence)}</td>
            </tr>
          ))}
          {CAPACITES_DE[type].map((c) => {
            const s = CAPACITES[c];
            return (
              <tr class="capacite" title={`${CAPACITES_TEXTES[c].role} ${extrasDe(type, s, c).join(' · ')}`}>
                <th>{CAPACITES_TEXTES[c].nom}</th>
                <td>{s.prix}</td>
                <td>{nombre(s.degats)}</td>
                <td>{nombre(s.portee)}</td>
                <td>{TEXTES.secondes(s.cadence)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {extras.length > 0 && <p class="discret">{extras.join(' · ')}</p>}
    </>
  );
}

function Entete({ titre, vignette, fermer, sous }: { titre: string; vignette?: string; fermer: () => void; sous?: string }) {
  return (
    <header>
      {vignette && <img class="vignette" src={vignette} alt="" />}
      <div class="titres">
        <h2>{titre}</h2>
        {sous && <span class="sous">{sous}</span>}
      </div>
      <button class="bouton fermer" title={TEXTES.fermer} onClick={fermer}>
        ✕
      </button>
    </header>
  );
}

function BulleConstruire(p: {
  i: Instantane;
  /** Tours qui vont sur cette case : celles de terre, le héron sur l'eau, les cinq sur un nénuphar. */
  types: TypeTour[];
  /** Plateforme de la futaie : prix +30 %, portée +1. */
  haute: boolean;
  /** Fleur à spores (prairie) ou champignon-lanterne (grotte) possible ici : sa carte vient après les tours. */
  plante: Plante | null;
  enHaut: boolean;
  survol: TypeTour | Plante | null;
  vignette: (t: TypeTour | Plante) => string;
  fermer: () => void;
  survoler: (t: TypeTour | Plante | null) => void;
  poser: (t: TypeTour | Plante) => void;
}) {
  const permises = p.i.regles.tours;
  const detail = p.survol ?? p.types.find((t) => permises.includes(t)) ?? p.types[0] ?? TYPES[0]!;
  const prixPlante = p.plante === 'lanterne' ? LANTERNE.prix : FLEUR.prix;
  const sansPlante = p.i.spores < prixPlante;
  return (
    <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
      <Entete titre={TEXTES.construire} fermer={p.fermer} />
      <div class="corps">
        <ul class="catalogue" onMouseLeave={() => p.survoler(null)}>
          {p.types.map((t) => {
            const prix = prixPour(TOURS[t].stades[0].prix, p.haute);
            const interdite = !permises.includes(t);
            const manque = interdite || p.i.spores < prix;
            return (
              <li>
                <button
                  class={`carte${manque ? ' manque' : ''}${interdite ? ' interdite' : ''}${p.survol === t ? ' choisie' : ''}`}
                  disabled={manque}
                  title={interdite ? TEXTES.tourInterdite : undefined}
                  onMouseEnter={() => p.survoler(interdite ? null : t)}
                  onClick={() => p.poser(t)}
                >
                  <img class="vignette" src={p.vignette(t)} alt="" />
                  <span class="nom">{TOURS_TEXTES[t].nom}</span>
                  {interdite ? (
                    <span class="qte manque">
                      <Ico nom="cadenas" />
                    </span>
                  ) : (
                    <Prix n={prix} manque={manque} />
                  )}
                </button>
              </li>
            );
          })}
          {p.plante && (
            <li>
              <button
                class={`carte${sansPlante ? ' manque' : ''}${p.survol === p.plante ? ' choisie' : ''}`}
                disabled={sansPlante}
                onMouseEnter={() => p.survoler(p.plante)}
                onClick={() => p.plante && p.poser(p.plante)}
              >
                <img class="vignette" src={p.vignette(p.plante)} alt="" />
                <span class="nom">{p.plante === 'lanterne' ? TEXTES.lanterne : TEXTES.fleur}</span>
                <Prix n={prixPlante} manque={sansPlante} />
              </button>
            </li>
          )}
        </ul>
        <div class="detail">
          {detail === 'lanterne' ? (
            <>
              <p>{TEXTES.lanterneRole}</p>
              <ul class="stats">
                <li title={TEXTES.lanterneRayonAide}>
                  <Ico nom="portee" />
                  {TEXTES.lanterneRayon(LANTERNE.rayon)}
                </li>
              </ul>
            </>
          ) : detail === 'fleur' ? (
            <>
              <p>{TEXTES.fleurRole}</p>
              <ul class="stats">
                <li title={TEXTES.fleurRapportAide}>
                  <Ico nom="spore" />
                  {TEXTES.fleurRapport(FLEUR.rapport)}
                </li>
              </ul>
            </>
          ) : (
            <>
              <p>{TOURS_TEXTES[detail].role}</p>
              <Stats type={detail} stade={1} bonusPortee={p.haute ? PLATEFORME.portee : 0} />
              {p.haute && <p class="discret">{TEXTES.plateforme(PLATEFORME.portee, Math.round((PLATEFORME.surcout - 1) * 100))}</p>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function BulleTour(p: {
  t: TourVue;
  i: Instantane;
  enHaut: boolean;
  vignette: string;
  vignetteCapacite: (c: Capacite) => string;
  capaciteVue: Capacite;
  voirCapacite: (c: Capacite) => void;
  choisirCapacite: (c: Capacite) => void;
  fermer: () => void;
  ameliorer: () => void;
  vendre: () => void;
  cibler: (mode: ModeCible) => void;
}) {
  const { t } = p;
  const prix = t.prixAmelioration;
  const manque = prix !== null && p.i.spores < prix;
  const sous = t.capacite ? CAPACITES_TEXTES[t.capacite].nom : TEXTES.stade(t.stade);
  const cible = <RangCible mode={t.mode} cibler={p.cibler} />;
  const vente = (
    <button class="bouton danger" onClick={p.vendre}>
      {TEXTES.vendre} +{t.revente}
    </button>
  );
  if (t.prixCapacites) {
    // Stade 3 : deux cartes de capacité ; la carte vue montre ses chiffres, « Choisir » l'achète pour de bon.
    const deux = CAPACITES_DE[t.type];
    // Capacités ouvertes dans l'Atelier ; une fermée reste visible, grisée, avec un cadenas.
    const ouvertes = p.i.regles.capacites;
    const vue = p.capaciteVue;
    const prixVue = t.prixCapacites[deux.indexOf(vue)]!;
    const fermeeVue = !ouvertes.includes(vue);
    const manqueVue = fermeeVue || p.i.spores < prixVue;
    return (
      <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
        <Entete titre={TOURS_TEXTES[t.type].nom} sous={sous} vignette={p.vignette} fermer={p.fermer} />
        <div class="corps">
          <p class="discret">{TEXTES.capaciteTitre}</p>
          <ul class="catalogue">
            {deux.map((c, n) => {
              const prixC = t.prixCapacites![n]!;
              const fermee = !ouvertes.includes(c);
              return (
                <li>
                  <button
                    class={`carte${fermee || p.i.spores < prixC ? ' manque' : ''}${fermee ? ' interdite' : ''}${vue === c ? ' choisie' : ''}`}
                    title={fermee ? TEXTES.capaciteFermee : undefined}
                    onMouseEnter={() => p.voirCapacite(c)}
                    onClick={() => p.voirCapacite(c)}
                  >
                    <img class="vignette" src={p.vignetteCapacite(c)} alt="" />
                    <span class="nom">{CAPACITES_TEXTES[c].nom}</span>
                    {fermee ? (
                      <span class="qte manque">
                        <Ico nom="cadenas" />
                      </span>
                    ) : (
                      <Prix n={prixC} manque={p.i.spores < prixC} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <div class="detail">
            <p>{CAPACITES_TEXTES[vue].role}</p>
            <Stats type={t.type} stade={3} vers={{ stade: 4, capacite: vue }} bonusPortee={t.haute ? PLATEFORME.portee : 0} />
            <p class="discret">{TEXTES.capaciteDefinitif}</p>
          </div>
          {cible}
          <div class="rang">
            {fermeeVue ? (
              <button class="bouton valider manque" disabled>
                <Ico nom="cadenas" /> {TEXTES.capaciteFermee}
              </button>
            ) : (
              <button class={`bouton valider${manqueVue ? ' manque' : ''}`} disabled={manqueVue} onClick={() => p.choisirCapacite(vue)}>
                {TEXTES.choisir} {CAPACITES_TEXTES[vue].nom} <Prix n={prixVue} manque={manqueVue} />
              </button>
            )}
            {vente}
          </div>
        </div>
      </section>
    );
  }
  return (
    <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
      <Entete titre={TOURS_TEXTES[t.type].nom} sous={sous} vignette={p.vignette} fermer={p.fermer} />
      <div class="corps">
        {t.capacite && <p>{CAPACITES_TEXTES[t.capacite].role}</p>}
        {cible}
        <Stats type={t.type} stade={t.stade} capacite={t.capacite} vers={prix === null ? undefined : { stade: t.stade + 1 }} bonusPortee={t.haute ? PLATEFORME.portee : 0} />
        <div class="rang">
          {prix !== null && (
            <button class={`bouton valider${manque ? ' manque' : ''}`} disabled={manque} onClick={p.ameliorer}>
              {TEXTES.ameliorer} <Prix n={prix} manque={manque} />
            </button>
          )}
          {vente}
        </div>
      </div>
    </section>
  );
}

const ICONES_MODES: Record<ModeCible, Icone> = { premier: 'premier', forte: 'vie', blinde: 'armure' };

/** Rangée « Cible » d'une tour : trois icônes, celle du mode choisi allumée ; le survol donne le nom et l'aide. */
function RangCible(p: { mode: ModeCible; cibler: (mode: ModeCible) => void }) {
  return (
    <div class="rang-cible">
      <span class="discret">
        {TEXTES.cible} · {MODES_TEXTES[p.mode].nom}
      </span>
      {MODES_CIBLE.map((m) => (
        <button
          class={`bouton carre${m === p.mode ? ' actif' : ''}`}
          title={`${MODES_TEXTES[m].nom} : ${MODES_TEXTES[m].aide}`}
          aria-label={MODES_TEXTES[m].nom}
          aria-pressed={m === p.mode}
          onClick={() => m !== p.mode && p.cibler(m)}
        >
          <Ico nom={ICONES_MODES[m]} />
        </button>
      ))}
    </div>
  );
}

/** Bulle d'une fleur à spores ou d'un champignon-lanterne posé : à quoi il sert, et l'enlever. */
function BullePlante(p: {
  titre: string;
  role: string;
  action: string;
  revente: number;
  enHaut: boolean;
  vignette: string;
  fermer: () => void;
  enlever: () => void;
}) {
  return (
    <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
      <Entete titre={p.titre} vignette={p.vignette} fermer={p.fermer} />
      <div class="corps">
        <p>{p.role}</p>
        <div class="rang">
          <button class="bouton danger" onClick={p.enlever}>
            {p.action} +{p.revente}
          </button>
        </div>
      </div>
    </section>
  );
}

function BulleRonce(p: {
  i: Instantane;
  enHaut: boolean;
  posee: boolean;
  possible: boolean;
  vignette: string;
  fermer: () => void;
  agir: () => void;
}) {
  const manque = !p.posee && p.i.spores < PRIX_RONCE;
  return (
    <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
      <Entete titre={TEXTES.ronce} vignette={p.vignette} fermer={p.fermer} />
      <div class="corps">
        <p>{p.posee ? TEXTES.ronceRoleArracher : TEXTES.ronceRole}</p>
        {!p.possible && <p class="manque">{TEXTES.ronceImpossible}</p>}
        <div class="rang">
          {p.posee ? (
            <button class="bouton danger" onClick={p.agir}>
              {TEXTES.ronceArracher} +{Math.floor(PRIX_RONCE * PART_RONCE_RENDUE)}
            </button>
          ) : (
            <button class={`bouton valider${manque ? ' manque' : ''}`} disabled={manque || !p.possible} onClick={p.agir}>
              {TEXTES.faire} <Prix n={PRIX_RONCE} manque={manque} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
