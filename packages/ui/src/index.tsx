// Interface du tower defense, en Preact, dans le style de Tiny Shrooms version guerre : bandeau compact toujours
// visible, bulles au clic sur l'île (construire, tour, ronce), menu des réglages.
// Le contrôleur garde l'état de l'interface ; le frontend lui donne les instantanés et lit l'aperçu à dessiner.
import { render } from 'preact';
import type { Case, Commande, Ile, Instantane, TourVue, TypeTour } from '@spore-siege/engine';
import { PART_RONCE_RENDUE, PRIX_RONCE, TOURS } from '@spore-siege/engine';
import { icone, type Icone } from './icones';
import { nombre, TEXTES, TOURS_TEXTES } from './textes';

/** Ce que l'interface peut demander à la partie. */
export interface Jeu {
  executer(commande: Commande): boolean;
  instantane(): Instantane;
  libre(c: Case): boolean;
  ronceLibre(c: Case): boolean;
  readonly emplacementsRonces: readonly Case[];
  readonly ile: Ile;
}

/** Réglages de la fenêtre, seulement dans l'application (pas dans un navigateur). */
export interface Fenetre {
  tailles: readonly { cote: number; nom: string }[];
  regler(cote: number): Promise<number>;
  actuelle(): Promise<number>;
  quitter(): void;
}

export interface OptionsInterface {
  vignette(type: TypeTour | 'ronce', stade: number): string;
  recommencer(): void;
  fenetre?: Fenetre;
}

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

const TYPES = Object.keys(TOURS) as TypeTour[];
const memeCase = (a: Case, b: Case) => a.x === b.x && a.y === b.y;

export class ControleurInterface {
  vitesse: Vitesse = 1;
  /** Vitesse choisie avant la pause, pour reprendre au même rythme. */
  private vitesseAvantPause: 1 | 2 = 1;
  private bulle: Bulle | null = null;
  private menu = false;
  private survol: TypeTour | null = null;
  private instantane: Instantane | null = null;
  private tailleFenetre = 0;
  /** Case sous la souris (null hors de l'île ou pendant un glisser). */
  private caseSurvolee: Case | null = null;

  constructor(
    private readonly element: HTMLElement,
    public jeu: Jeu,
    private readonly options: OptionsInterface,
  ) {
    void options.fenetre?.actuelle().then((t) => {
      this.tailleFenetre = t;
      this.dessiner();
    });
  }

  /** Nouvel instantané de la partie. */
  maj(instantane: Instantane): void {
    this.instantane = instantane;
    if (instantane.phase === 'victoire' || instantane.phase === 'defaite') this.bulle = null;
    this.dessiner();
  }

  /**
   * Clic sur une case de l'île : ouvre la bulle qui lui correspond (construire, tour, ronce) ; `enHaut` place la
   * bulle en haut de la fenêtre (clic dans la moitié basse). Ferme tout si la case n'offre rien.
   */
  cliquer(c: Case | null, enHaut: boolean): void {
    this.menu = false;
    this.survol = null;
    this.bulle = c && this.natureCase(c) ? { case: c, enHaut } : null;
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
    if (!i || this.menu) return null;
    const c = this.bulle ? this.bulle.case : this.caseSurvolee;
    if (!c) return null;
    const nature = this.natureCase(c);
    const tour = this.tourDe(c);
    if (tour) return { case: c, sorte: 'boite', hauteur: 0.35 + tour.stade * 0.25 };
    const ronce = i.ronces.some((r) => memeCase(r, c));
    if (ronce) return { case: c, sorte: 'boite', hauteur: 0.6 };
    // Bulle ouverte sur une case vide : le fantôme suffit.
    if (this.bulle) return null;
    if (nature === 'construire' || (nature === 'ronce' && this.jeu.ronceLibre(c))) return { case: c, sorte: 'case', hauteur: 0 };
    return null;
  }

  fermer(): void {
    this.bulle = null;
    this.menu = false;
    this.survol = null;
    this.dessiner();
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
    if (this.jeu.emplacementsRonces.some((e) => memeCase(e, c))) return 'ronce';
    if (this.jeu.libre(c)) return 'construire';
    return null;
  }

  private executer(commande: Commande): boolean {
    const fait = this.jeu.executer(commande);
    if (fait) this.maj(this.jeu.instantane());
    return fait;
  }

  /** Pause, ou reprise à la vitesse d'avant (barre d'espace). */
  basculerPause(): void {
    this.changerVitesse(this.vitesse === 0 ? this.vitesseAvantPause : 0);
  }

  private changerVitesse(v: Vitesse): void {
    if (v !== 0) this.vitesseAvantPause = v;
    this.vitesse = v;
    this.dessiner();
  }

  private dessiner(): void {
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
          menu={() => {
            this.menu = !this.menu;
            this.bulle = null;
            this.dessiner();
          }}
          recommencer={this.options.recommencer}
        />
        {this.bulle && this.dessinerBulle(i, this.bulle)}
        {this.menu && this.dessinerMenu()}
      </div>,
      this.element,
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
          vignette={this.options.vignette(t.type, t.stade)}
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

  private dessinerMenu() {
    const f = this.options.fenetre;
    return (
      <section class="bulle haut menu">
        <header>
          <Ico nom="reglages" />
          <h2>{TEXTES.reglages}</h2>
          <button class="bouton fermer" title={TEXTES.fermer} onClick={() => this.fermer()}>
            ✕
          </button>
        </header>
        <div class="corps">
          {f && (
            <>
              <h3>{TEXTES.fenetre}</h3>
              <div class="rang">
                {f.tailles.map(({ cote, nom }) => (
                  <button
                    class={`bouton${this.tailleFenetre === cote ? ' actif' : ''}`}
                    onClick={async () => {
                      this.tailleFenetre = await f.regler(cote);
                      this.dessiner();
                    }}
                  >
                    {nom}
                  </button>
                ))}
              </div>
            </>
          )}
          <h3>{TEXTES.partie}</h3>
          <button
            class="bouton large"
            onClick={() => {
              this.fermer();
              this.options.recommencer();
            }}
          >
            {TEXTES.recommencer}
          </button>
          {f && (
            <button class="bouton large danger" onClick={() => f.quitter()}>
              {TEXTES.quitter}
            </button>
          )}
        </div>
      </section>
    );
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

function Bandeau(p: {
  i: Instantane;
  vitesse: Vitesse;
  lancer: () => void;
  pause: () => void;
  rapide: () => void;
  menu: () => void;
  recommencer: () => void;
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
      {fin && (
        <>
          <span class="planche resultat">
            {i.phase === 'victoire' ? `${TEXTES.victoire} ${'★'.repeat(i.etoiles)}${'☆'.repeat(3 - i.etoiles)}` : TEXTES.defaite}
          </span>
          <button class="bouton valider" onClick={p.recommencer}>
            {TEXTES.rejouer}
          </button>
        </>
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
      <button class="bouton carre" title={TEXTES.reglages} onClick={p.menu}>
        <Ico nom="reglages" />
      </button>
    </div>
  );
}

/** Dégâts, portée et recharge d'un stade de tour ; `suivant` montre l'amélioration. */
function Stats({ type, stade, suivant }: { type: TypeTour; stade: number; suivant?: number }) {
  const fiche = TOURS[type];
  const a = fiche.stades[stade - 1]!;
  const b = suivant ? fiche.stades[suivant - 1] : undefined;
  const fleche = (x: number, y: number | undefined, f: (n: number) => string = nombre) =>
    y === undefined || f(y) === f(x) ? f(x) : (
      <>
        {f(x)} <span class="mieux">→ {f(y)}</span>
      </>
    );
  const extras = [
    a.rebonds ? TEXTES.rebonds(b?.rebonds ?? a.rebonds) : null,
    fiche.projectile && fiche.projectile.rayon > 0 ? TEXTES.zone : null,
    fiche.ralenti ? TEXTES.ralentit : null,
  ].filter(Boolean);
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
  const detail = p.survol ?? TYPES[0]!;
  return (
    <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
      <Entete titre={TEXTES.construire} fermer={p.fermer} />
      <div class="corps">
        <ul class="catalogue" onMouseLeave={() => p.survoler(null)}>
          {TYPES.map((t) => {
            const prix = TOURS[t].stades[0].prix;
            const manque = p.i.spores < prix;
            return (
              <li>
                <button
                  class={`carte${manque ? ' manque' : ''}${p.survol === t ? ' choisie' : ''}`}
                  disabled={manque}
                  onMouseEnter={() => p.survoler(t)}
                  onClick={() => p.poser(t)}
                >
                  <img class="vignette" src={p.vignette(t)} alt="" />
                  <span class="nom">{TOURS_TEXTES[t].nom}</span>
                  <Prix n={prix} manque={manque} />
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
  fermer: () => void;
  ameliorer: () => void;
  vendre: () => void;
}) {
  const { t } = p;
  const prix = t.prixAmelioration;
  const manque = prix !== null && p.i.spores < prix;
  return (
    <section class={`bulle ${p.enHaut ? 'haut' : 'bas'}`}>
      <Entete titre={TOURS_TEXTES[t.type].nom} sous={prix === null ? TEXTES.stadeMax : TEXTES.stade(t.stade)} vignette={p.vignette} fermer={p.fermer} />
      <div class="corps">
        <Stats type={t.type} stade={t.stade} suivant={prix === null ? undefined : t.stade + 1} />
        <div class="rang">
          {prix !== null && (
            <button class={`bouton valider${manque ? ' manque' : ''}`} disabled={manque} onClick={p.ameliorer}>
              {TEXTES.ameliorer} <Prix n={prix} manque={manque} />
            </button>
          )}
          <button class="bouton danger" onClick={p.vendre}>
            {TEXTES.vendre} +{t.revente}
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
