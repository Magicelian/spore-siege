// Interface du tower defense, en Preact, dans le style de Tiny Shrooms version guerre : bandeau compact toujours
// visible, bulles au clic sur l'île (construire, tour, ronce).
// Le contrôleur garde l'état de l'interface ; le frontend lui donne les instantanés et lit l'aperçu à dessiner.
import { render } from 'preact';
import type { Biome, Capacite, Case, Commande, Ile, Instantane, Niveau, StadeTour, TourVue, TypeMonstre, TypeTour } from '@spore-siege/engine';
import { CAPACITES, CAPACITES_DE, MONSTRES, NIVEAUX, niveauOuvert, PART_RONCE_RENDUE, PRIX_RONCE, SEUIL_BOSS, TOURS } from '@spore-siege/engine';
import { icone, type Icone } from './icones';
import { ecrireDecouverts, ecrireEtoiles, ecrireMusique, ecrireSons, lireDecouverts, lireEtoiles, lireMusique, lireSons } from './sauvegarde';
import { Sons } from './sons';

export type { Effet } from './sons';
import { CAPACITES_TEXTES, ILES_TEXTES, MONSTRES_TEXTES, nombre, TEXTES, TOURS_TEXTES } from './textes';

/** Ce que l'interface peut demander à la partie. */
export interface Jeu {
  executer(commande: Commande): boolean;
  instantane(): Instantane;
  libre(c: Case): boolean;
  ronceLibre(c: Case): boolean;
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
  vignette(type: TypeTour | 'ronce', stade: number, capacite?: Capacite | null): string;
  vignetteMonstre(type: TypeMonstre): string;
  recommencer(): void;
  fenetre?: Fenetre;
  /** Le canevas doit montrer l'archipel, la carte d'une île (`ile`) ou l'île de la partie. */
  changerEcran(ecran: Ecran, ile?: Biome): void;
  /** Étapes de la carte montrée (îles ou niveaux), avec le dessus de leur îlot à l'écran (pixels de l'interface). */
  positionsCarte(): { cle: string; x: number; y: number }[];
  /** Prépare une partie neuve sur ce niveau. */
  lancer(niveau: Niveau): void;
}

/** Accueil (titre + Jouer), archipel, carte d'une île (ses niveaux), ou partie en cours. */
export type Ecran = 'accueil' | 'carte' | 'niveaux' | 'partie';

/** Tour ou ronce fantôme à dessiner sur l'île, avec sa portée. */
export interface Apercu {
  type: TypeTour | 'ronce';
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
const TYPES_MONSTRES = Object.keys(MONSTRES) as TypeMonstre[];
const memeCase = (a: Case, b: Case) => a.x === b.x && a.y === b.y;

export class ControleurInterface {
  vitesse: Vitesse = 1;
  ecran: Ecran = 'accueil';
  /** Île dont on montre (ou joue) les niveaux. */
  private ileChoisie: Biome = 'foret';
  /** Bruitages ; coupés tant que le joueur ne les a pas allumés par le menu de l’icône (choix retenu). */
  readonly sons = new Sons();
  /** Meilleures étoiles de chaque île, gardées d'une partie à l'autre. */
  private readonly etoiles = lireEtoiles();
  /** Vitesse choisie avant la pause, pour reprendre au même rythme. */
  private vitesseAvantPause: 1 | 2 = 1;
  private bulle: Bulle | null = null;
  private survol: TypeTour | null = null;
  /** Capacité montrée dans la bulle d'une tour au stade 3 (la première tant qu'on n'a rien survolé). */
  private capaciteVue: Capacite | null = null;
  private instantane: Instantane | null = null;
  private tailleFenetre = 0;
  /** Case sous la souris (null hors de l'île ou pendant un glisser). */
  private caseSurvolee: Case | null = null;
  /** Monstres déjà rencontrés (fiche lue ou vague jouée), gardés d'une partie à l'autre. */
  private readonly decouverts = lireDecouverts();
  /** Fiche d'un nouveau monstre, ouverte depuis son médaillon. */
  private fiche: TypeMonstre | null = null;
  private pauseMenu = false;
  private livre: Livre | null = null;
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
    if (instantane.phase === 'victoire' && instantane.etoiles > (this.etoiles[this.jeu.niveau] ?? 0)) {
      this.etoiles[this.jeu.niveau] = instantane.etoiles;
      ecrireEtoiles(this.etoiles);
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
    this.pauseMenu = false;
    if (this.reprendreA !== null) this.vitesse = this.reprendreA;
    this.reprendreA = null;
    this.dessiner();
  }

  /** Change d'écran : accueil, carte des îles ou partie. */
  aller(ecran: Ecran): void {
    this.fermer();
    this.ecran = ecran;
    this.options.changerEcran(ecran, ecran === 'niveaux' ? this.ileChoisie : undefined);
    this.dessiner();
  }

  /** Ouvre la carte d'une île : ses niveaux. */
  choisirIle(biome: Biome): void {
    this.ileChoisie = biome;
    this.aller('niveaux');
  }

  /** Lance une partie neuve sur ce niveau. */
  jouer(niveau: Niveau): void {
    this.options.lancer(niveau);
    this.vitesse = 1;
    this.aller('partie');
  }

  /** Étoiles gagnées sur les niveaux d'une île. */
  private etoilesIle(biome: Biome): number {
    return (NIVEAUX[biome] ?? []).reduce((n, x) => n + (this.etoiles[x.id] ?? 0), 0);
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
          <button class="bouton large" onClick={() => this.aller('niveaux')}>
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
    if (this.decouverts.size !== avant) ecrireDecouverts(this.decouverts);
  }

  /** Tour ou ronce à dessiner en fantôme : la carte survolée dans la bulle « Construire ». */
  get apercu(): Apercu | null {
    const b = this.bulle;
    if (!b || !this.instantane) return null;
    // Bulle de ronce encore à poser : la ronce en fantôme, cercle blanc ou rouge.
    if (this.natureCase(b.case) === 'ronce' && !this.instantane.ronces.some((r) => memeCase(r, b.case)))
      return { type: 'ronce', case: b.case, possible: this.jeu.ronceLibre(b.case), portee: 0.5 };
    if (!this.survol) return null;
    const prix = TOURS[this.survol].stades[0].prix;
    return { type: this.survol, case: b.case, possible: this.instantane.spores >= prix, portee: TOURS[this.survol].stades[0].portee };
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

  private natureCase(c: Case): 'tour' | 'ronce' | 'construire' | null {
    if (this.tourDe(c)) return 'tour';
    if (this.instantane?.regles.ronces !== false && this.jeu.emplacementsRonces.some((e) => memeCase(e, c))) return 'ronce';
    if (this.jeu.libre(c)) return 'construire';
    return null;
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
        {(i.phase === 'victoire' || i.phase === 'defaite') && <EcranFin i={i} rejouer={this.options.recommencer} carte={() => this.aller('niveaux')} />}
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
            <button class="bouton valider principal" onClick={() => this.aller('carte')}>
              ▶ {TEXTES.jouer}
            </button>
            <div class="rangee-boutons">
              <button class="bouton" onClick={() => this.ouvrirLivre()}>
                <Ico nom="livre" /> {TEXTES.grimoire}
              </button>
              {f && (
                <button class="bouton danger" onClick={() => f.quitter()}>
                  {TEXTES.quitter}
                </button>
              )}
            </div>
          </div>
        </div>
        {this.livre && this.dessinerLivre(this.livre)}
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
          <span class="planche" title={TEXTES.etoilesTotal}>
            <Ico nom="etoile" />
            {`${total}/${maximum}`}
          </span>
          <span class="planche">{TEXTES.archipel}</span>
          <span class="espace" />
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
      </div>
    );
  }

  /** Médaillons des monstres jamais vus qui arrivent avec la vague en cours ou à venir. */
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
              {TEXTES.ongletTours}
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
                {TYPES.map((t) => (
                  <li>
                    <button class={`carte${livre.choix === t ? ' choisie' : ''}`} onClick={() => choisir({ onglet: 'tours', choix: t })}>
                      <img class="vignette" src={this.options.vignette(t, 3)} alt="" />
                      <span class="nom">{TOURS_TEXTES[t].nom}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div class="detail">
                <h3>{TOURS_TEXTES[livre.choix].nom}</h3>
                <p>{TOURS_TEXTES[livre.choix].role}</p>
                <TableTour type={livre.choix} />
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
          capaciteVue={this.capaciteVue ?? CAPACITES_DE[t.type][0]}
          voirCapacite={(c) => {
            this.capaciteVue = c;
            this.dessiner();
          }}
          choisirCapacite={(c) => this.executer({ type: 'choisirCapacite', id: t.id, capacite: c })}
          fermer={fermer}
          ameliorer={() => this.executer({ type: 'ameliorerTour', id: t.id })}
          vendre={() => this.executer({ type: 'vendreTour', id: t.id }) && fermer()}
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
    if (nature === 'construire')
      return (
        <BulleConstruire
          i={i}
          enHaut={b.enHaut}
          survol={this.survol}
          vignette={(t) => this.options.vignette(t, 1)}
          fermer={fermer}
          survoler={(t) => {
            this.survol = t;
            this.dessiner();
          }}
          poser={(t) => this.executer({ type: 'poserTour', tour: t, case: b.case }) && fermer()}
        />
      );
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
        {TEXTES.vague(i.vague, i.vagues)}
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
function Stats({ type, stade, capacite = null, vers }: { type: TypeTour; stade: number; capacite?: Capacite | null; vers?: { stade: number; capacite?: Capacite } }) {
  const a = stadeVu(type, stade, capacite);
  const b = vers ? stadeVu(type, vers.stade, vers.capacite ?? null) : undefined;
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

/** Fin de partie : titre, étoiles qui tombent une à une, vie restante, Rejouer (la carte viendra en 4c). */
function EcranFin({ i, rejouer, carte }: { i: Instantane; rejouer: () => void; carte: () => void }) {
  const victoire = i.phase === 'victoire';
  return (
    <div class="voile">
      <section class={`bulle fin ${victoire ? 'gagne' : 'perdu'}`}>
        <header>
          <h2>{victoire ? TEXTES.victoire : TEXTES.defaite}</h2>
        </header>
        <div class="corps">
          <div class="etoiles" title={TEXTES.etoilesAide}>
            {[1, 2, 3].map((n) => (
              <img class={`etoile${n <= i.etoiles ? ' gagnee' : ''}`} style={{ animationDelay: `${0.25 + n * 0.3}s` }} src={icone(n <= i.etoiles ? 'etoile' : 'etoileVide')} alt="" />
            ))}
          </div>
          <p class="sous-titre">{victoire ? TEXTES.victoireSous : TEXTES.defaiteSous(i.vague, i.vagues)}</p>
          <p class="vie">
            <Ico nom="vie" />
            {TEXTES.vieRestante(i.souche.pv, i.souche.pvMax)}
          </p>
          {victoire && <p class="discret">{TEXTES.etoileSuivante(i.etoiles)}</p>}
          <div class="rang choix">
            <button class="bouton" onClick={carte}>
              {TEXTES.carte}
            </button>
            <button class="bouton valider" onClick={rejouer}>
              {TEXTES.rejouer}
            </button>
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
  enHaut: boolean;
  survol: TypeTour | null;
  vignette: (t: TypeTour) => string;
  fermer: () => void;
  survoler: (t: TypeTour | null) => void;
  poser: (t: TypeTour) => void;
}) {
  const permises = p.i.regles.tours;
  const detail = p.survol ?? permises[0] ?? TYPES[0]!;
  return (
    <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
      <Entete titre={TEXTES.construire} fermer={p.fermer} />
      <div class="corps">
        <ul class="catalogue" onMouseLeave={() => p.survoler(null)}>
          {TYPES.map((t) => {
            const prix = TOURS[t].stades[0].prix;
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
        </ul>
        <div class="detail">
          <p>{TOURS_TEXTES[detail].role}</p>
          <Stats type={detail} stade={1} />
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
}) {
  const { t } = p;
  const prix = t.prixAmelioration;
  const manque = prix !== null && p.i.spores < prix;
  const sous = t.capacite ? CAPACITES_TEXTES[t.capacite].nom : TEXTES.stade(t.stade);
  const vente = (
    <button class="bouton danger" onClick={p.vendre}>
      {TEXTES.vendre} +{t.revente}
    </button>
  );
  if (t.prixCapacites) {
    // Stade 3 : deux cartes de capacité ; la carte vue montre ses chiffres, « Choisir » l'achète pour de bon.
    const deux = CAPACITES_DE[t.type];
    const vue = p.capaciteVue;
    const prixVue = t.prixCapacites[deux.indexOf(vue)]!;
    const manqueVue = p.i.spores < prixVue;
    return (
      <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
        <Entete titre={TOURS_TEXTES[t.type].nom} sous={sous} vignette={p.vignette} fermer={p.fermer} />
        <div class="corps">
          <p class="discret">{TEXTES.capaciteTitre}</p>
          <ul class="catalogue">
            {deux.map((c, n) => {
              const prixC = t.prixCapacites![n]!;
              return (
                <li>
                  <button
                    class={`carte${p.i.spores < prixC ? ' manque' : ''}${vue === c ? ' choisie' : ''}`}
                    onMouseEnter={() => p.voirCapacite(c)}
                    onClick={() => p.voirCapacite(c)}
                  >
                    <img class="vignette" src={p.vignetteCapacite(c)} alt="" />
                    <span class="nom">{CAPACITES_TEXTES[c].nom}</span>
                    <Prix n={prixC} manque={p.i.spores < prixC} />
                  </button>
                </li>
              );
            })}
          </ul>
          <div class="detail">
            <p>{CAPACITES_TEXTES[vue].role}</p>
            <Stats type={t.type} stade={3} vers={{ stade: 4, capacite: vue }} />
            <p class="discret">{TEXTES.capaciteDefinitif}</p>
          </div>
          <div class="rang">
            <button class={`bouton valider${manqueVue ? ' manque' : ''}`} disabled={manqueVue} onClick={() => p.choisirCapacite(vue)}>
              {TEXTES.choisir} {CAPACITES_TEXTES[vue].nom} <Prix n={prixVue} manque={manqueVue} />
            </button>
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
        <Stats type={t.type} stade={t.stade} capacite={t.capacite} vers={prix === null ? undefined : { stade: t.stade + 1 }} />
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
