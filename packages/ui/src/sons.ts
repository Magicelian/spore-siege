// Sons synthétisés avec Web Audio, aucun fichier (principe repris de Tiny Shrooms) : bruitages brefs façon 8-bit
// pour les tirs, les explosions, les morts, la souche mordue et l'interface ; ambiance de fond comme Tiny Shrooms
// (vent qui respire, oiseaux de temps en temps ; au marais, grenouilles et grillons ; à la prairie, alouettes, bourdons et grillons ; à la grotte, gouttes et grondements) ; musique de combat pendant les vagues (`musique.ts`).
// Coupé par défaut ; le contexte audio n'est créé qu'une fois le son allumé.
import type { Biome, TypeTour } from '@spore-siege/engine';
import { MusiqueCombat } from './musique';

export type Effet =
  | 'ouvrir'
  | 'fermer'
  | 'poser'
  | 'ameliorer'
  | 'capacite'
  | 'tir-prisme'
  | 'tir-gros'
  | 'vendre'
  | 'ronce'
  | 'refus'
  | 'vague'
  | 'victoire'
  | 'defaite'
  | `tir-${TypeTour}`
  | 'explosion'
  | 'mort'
  | 'morsure'
  | 'soin'
  | 'ponte'
  | 'plongee'
  | 'planter'
  | 'arracher'
  | 'recolte'
  | 'devore'
  | 'pique'
  | 'extinction'
  | 'souffle'
  | 'fil'
  | 'grimpe'
  | 'frappe'
  | 'chute';

const VOLUME = 0.22;
/** Ambiance de fond, basse exprès (même niveau que Tiny Shrooms) ; le vent par-dessus en léger souffle. */
const VOLUME_AMBIANCE = 0.1;
const VENT = 0.18;
/** Musique de combat : sous les effets, pour que les tirs restent lisibles. */
const VOLUME_MUSIQUE = 0.13;
/** Deux effets identiques plus rapprochés que ceci n'en font qu'un (les ruches tirent beaucoup). */
const ECART_MIN_S: Partial<Record<Effet, number>> = { recolte: 0.12, soin: 0.3, 'tir-ruche': 0.14, 'tir-cristal': 0.1, mort: 0.05, explosion: 0.08 };
const ECART_DEFAUT_S = 0.06;

/** Une note : fréquence (Hz), départ et durée (s) relatifs à l'effet, glissement final éventuel. */
interface Note {
  f: number;
  t: number;
  d: number;
  vers?: number;
  onde?: OscillatorType;
  v?: number;
}
/** Bouffée de bruit filtré : départ, durée (s), fréquence de coupure (Hz), volume. */
interface Souffle {
  t: number;
  d: number;
  f: number;
  v: number;
  aigu?: boolean;
}

const EFFETS: Record<Effet, { notes: Note[]; souffles?: Souffle[] }> = {
  ouvrir: { notes: [{ f: 660, t: 0, d: 0.05, v: 0.4 }, { f: 990, t: 0.04, d: 0.06, v: 0.3 }] },
  fermer: { notes: [{ f: 880, t: 0, d: 0.05, v: 0.3 }, { f: 587, t: 0.04, d: 0.06, v: 0.28 }] },
  poser: {
    notes: [{ f: 180, t: 0, d: 0.06, vers: 90, onde: 'triangle' }, { f: 220, t: 0.1, d: 0.08, vers: 110, onde: 'triangle' }],
    souffles: [{ t: 0, d: 0.12, f: 900, v: 0.5 }],
  },
  // Stade 4 : arpège montant plus long, puis un accord tenu.
  capacite: {
    notes: [
      { f: 392, t: 0, d: 0.06, v: 0.35 },
      { f: 523, t: 0.06, d: 0.06, v: 0.35 },
      { f: 659, t: 0.12, d: 0.06, v: 0.35 },
      { f: 784, t: 0.18, d: 0.06, v: 0.35 },
      { f: 1047, t: 0.26, d: 0.35, v: 0.3 },
      { f: 523, t: 0.26, d: 0.35, onde: 'triangle', v: 0.5 },
    ],
    souffles: [{ t: 0.26, d: 0.2, f: 3000, v: 0.2, aigu: true }],
  },
  // Rayon du Prisme : note aiguë qui descend lentement, plus pleine que l'éclair.
  'tir-prisme': {
    notes: [{ f: 2400, t: 0, d: 0.22, vers: 600, onde: 'sawtooth', v: 0.14 }, { f: 1200, t: 0, d: 0.22, vers: 300, onde: 'sine', v: 0.3 }],
    souffles: [{ t: 0, d: 0.12, f: 4000, v: 0.2, aigu: true }],
  },
  // Gros calibre : détonation grave.
  'tir-gros': { notes: [{ f: 160, t: 0, d: 0.25, vers: 45, onde: 'triangle', v: 0.7 }], souffles: [{ t: 0, d: 0.22, f: 900, v: 0.55 }] },
  ameliorer: {
    notes: [
      { f: 392, t: 0, d: 0.07, v: 0.35 },
      { f: 523, t: 0.07, d: 0.07, v: 0.35 },
      { f: 784, t: 0.14, d: 0.14, v: 0.35 },
    ],
    souffles: [{ t: 0, d: 0.1, f: 900, v: 0.4 }],
  },
  vendre: {
    notes: [{ f: 988, t: 0, d: 0.06, onde: 'triangle' }, { f: 1319, t: 0.06, d: 0.1, onde: 'triangle' }],
    souffles: [{ t: 0, d: 0.15, f: 600, v: 0.45 }],
  },
  ronce: { notes: [{ f: 300, t: 0, d: 0.12, vers: 140, onde: 'sawtooth', v: 0.25 }], souffles: [{ t: 0, d: 0.14, f: 1400, v: 0.35 }] },
  refus: { notes: [{ f: 150, t: 0, d: 0.14, vers: 110, onde: 'sawtooth', v: 0.35 }] },
  // Cor de guerre : deux notes graves, la seconde tenue.
  vague: {
    notes: [
      { f: 147, t: 0, d: 0.18, onde: 'sawtooth', v: 0.3 },
      { f: 196, t: 0.2, d: 0.45, vers: 185, onde: 'sawtooth', v: 0.3 },
      { f: 98, t: 0.2, d: 0.45, onde: 'triangle', v: 0.5 },
    ],
  },
  victoire: {
    notes: [
      { f: 523, t: 0, d: 0.1, v: 0.35 },
      { f: 659, t: 0.1, d: 0.1, v: 0.35 },
      { f: 784, t: 0.2, d: 0.1, v: 0.35 },
      { f: 1047, t: 0.3, d: 0.4, v: 0.35 },
      { f: 523, t: 0.3, d: 0.4, onde: 'triangle', v: 0.5 },
    ],
  },
  defaite: {
    notes: [
      { f: 392, t: 0, d: 0.18, onde: 'triangle', v: 0.5 },
      { f: 330, t: 0.18, d: 0.18, onde: 'triangle', v: 0.5 },
      { f: 262, t: 0.36, d: 0.5, vers: 196, onde: 'triangle', v: 0.5 },
    ],
  },
  'tir-ruche': { notes: [{ f: 230, t: 0, d: 0.07, vers: 280, onde: 'sawtooth', v: 0.12 }] },
  'tir-cristal': {
    notes: [{ f: 1800, t: 0, d: 0.09, vers: 300, onde: 'square', v: 0.16 }],
    souffles: [{ t: 0, d: 0.08, f: 5000, v: 0.25, aigu: true }],
  },
  'tir-mortier': { notes: [{ f: 140, t: 0, d: 0.12, vers: 60, onde: 'triangle', v: 0.6 }], souffles: [{ t: 0, d: 0.1, f: 500, v: 0.4 }] },
  'tir-canon': { notes: [{ f: 320, t: 0, d: 0.07, vers: 120, onde: 'square', v: 0.22 }], souffles: [{ t: 0, d: 0.08, f: 1500, v: 0.35 }] },
  // Héron : corde de baliste qui claque, puis le sifflement du harpon.
  'tir-heron': { notes: [{ f: 520, t: 0, d: 0.1, vers: 240, onde: 'triangle', v: 0.35 }], souffles: [{ t: 0.02, d: 0.14, f: 2600, v: 0.25 }] },
  explosion: { notes: [{ f: 90, t: 0, d: 0.2, vers: 40, onde: 'triangle', v: 0.6 }], souffles: [{ t: 0, d: 0.25, f: 700, v: 0.55 }] },
  // Floc : une note qui tombe, puis un petit plop.
  mort: { notes: [{ f: 620, t: 0, d: 0.08, vers: 160, onde: 'sine', v: 0.45 }, { f: 900, t: 0.05, d: 0.04, onde: 'square', v: 0.15 }] },
  // Ponte de la Limace-mère : grondement grave et éclatement mouillé.
  ponte: {
    notes: [{ f: 70, t: 0, d: 0.45, vers: 45, onde: 'sawtooth', v: 0.45 }, { f: 300, t: 0.12, d: 0.12, vers: 120, onde: 'sine', v: 0.3 }],
    souffles: [{ t: 0.1, d: 0.25, f: 600, v: 0.45 }],
  },
  // Plongée du Crapaud-roi : gros plouf, une note grave qui s'enfonce.
  // Fleur à spores : petit « pop » montant quand on plante, descendant quand on arrache ; récolte = deux notes claires.
  planter: { notes: [{ f: 440, t: 0, d: 0.08, vers: 660, onde: 'triangle', v: 0.3 }, { f: 880, t: 0.07, d: 0.09, onde: 'sine', v: 0.18 }], souffles: [{ t: 0, d: 0.1, f: 2200, v: 0.2 }] },
  arracher: { notes: [{ f: 520, t: 0, d: 0.12, vers: 260, onde: 'triangle', v: 0.3 }], souffles: [{ t: 0, d: 0.12, f: 1600, v: 0.3 }] },
  // Cri du Grand Corbeau qui pique : deux croassements rauques.
  pique: {
    notes: [{ f: 620, t: 0, d: 0.16, vers: 380, onde: 'sawtooth', v: 0.35 }, { f: 560, t: 0.22, d: 0.2, vers: 320, onde: 'sawtooth', v: 0.35 }],
    souffles: [{ t: 0, d: 0.16, f: 1800, v: 0.25 }, { t: 0.22, d: 0.2, f: 1600, v: 0.25 }],
  },
  // Chenille qui finit une fleur : trois croques sèches.
  // Lanterne soufflée par une chauve-souris : un « pff » et une note qui retombe.
  // Fil de soie qui se déroule (sifflement qui descend), puis la chute légère de l'araignée.
  fil: { notes: [{ f: 1400, t: 0, d: 0.35, vers: 500, onde: 'sine', v: 0.06 }, { f: 160, t: 0.34, d: 0.06, vers: 110, onde: 'triangle', v: 0.12 }], souffles: [{ t: 0, d: 0.3, f: 4200, v: 0.12 }] },
  // Griffes qui grattent l'écorce en montant, petit cri aigu en haut.
  grimpe: { notes: [{ f: 1800, t: 0.24, d: 0.07, vers: 2400, onde: 'square', v: 0.05 }], souffles: [{ t: 0, d: 0.04, f: 3000, v: 0.3 }, { t: 0.07, d: 0.04, f: 3300, v: 0.3 }, { t: 0.14, d: 0.04, f: 3600, v: 0.3 }] },
  extinction: { notes: [{ f: 520, t: 0.02, d: 0.22, vers: 180, onde: 'triangle', v: 0.14 }], souffles: [{ t: 0, d: 0.16, f: 900, v: 0.4 }] },
  devore: { notes: [{ f: 220, t: 0.18, d: 0.08, vers: 150, onde: 'square', v: 0.15 }], souffles: [{ t: 0, d: 0.05, f: 2600, v: 0.35 }, { t: 0.09, d: 0.05, f: 2300, v: 0.35 }, { t: 0.18, d: 0.07, f: 2000, v: 0.4 }] },
  recolte: { notes: [{ f: 1175, t: 0, d: 0.06, onde: 'sine', v: 0.16 }, { f: 1568, t: 0.06, d: 0.1, onde: 'sine', v: 0.14 }] },
  // Ver des profondeurs qui souffle les lanternes : grondement grave et long souffle.
  souffle: {
    notes: [{ f: 70, t: 0, d: 0.7, vers: 45, onde: 'sawtooth', v: 0.45 }, { f: 140, t: 0.05, d: 0.5, vers: 90, onde: 'triangle', v: 0.25 }],
    souffles: [{ t: 0.05, d: 0.8, f: 500, v: 0.55 }],
  },
  // Colosse d'écorce qui frappe le sol : coup sourd très grave, terre qui retombe.
  frappe: {
    notes: [{ f: 55, t: 0, d: 0.6, vers: 30, onde: 'sine', v: 0.7 }, { f: 110, t: 0, d: 0.25, vers: 50, onde: 'triangle', v: 0.35 }],
    souffles: [{ t: 0, d: 0.15, f: 700, v: 0.6 }, { t: 0.15, d: 0.5, f: 350, v: 0.3 }],
  },
  // Plateforme qui s'effondre : craquement de bois, puis fracas des planches au sol.
  chute: {
    notes: [{ f: 300, t: 0, d: 0.08, vers: 180, onde: 'square', v: 0.12 }, { f: 90, t: 0.55, d: 0.4, vers: 45, onde: 'triangle', v: 0.5 }],
    souffles: [{ t: 0, d: 0.05, f: 2600, v: 0.4 }, { t: 0.1, d: 0.05, f: 2200, v: 0.35 }, { t: 0.55, d: 0.35, f: 1200, v: 0.55 }],
  },
  plongee: {
    notes: [{ f: 180, t: 0, d: 0.35, vers: 60, onde: 'sine', v: 0.5 }],
    souffles: [{ t: 0, d: 0.3, f: 900, v: 0.5 }],
  },
  // Soin du prêtre champignon : deux notes douces qui montent.
  soin: { notes: [{ f: 520, t: 0, d: 0.09, vers: 700, onde: 'sine', v: 0.16 }, { f: 780, t: 0.07, d: 0.1, vers: 1040, onde: 'sine', v: 0.12 }] },
  // Craquement grave, puis une alerte brève.
  morsure: {
    notes: [{ f: 110, t: 0, d: 0.16, vers: 70, onde: 'sawtooth', v: 0.4 }, { f: 440, t: 0.14, d: 0.1, onde: 'square', v: 0.22 }],
    souffles: [{ t: 0, d: 0.15, f: 400, v: 0.5 }],
  },
};

export class Sons {
  private contexte: AudioContext | null = null;
  private maitre: GainNode | null = null;
  private effets: GainNode | null = null;
  private bruit: AudioBuffer | null = null;
  private ambiance: GainNode | null = null;
  /** Île jouée : au marais, grenouilles et grillons au lieu des oiseaux ; à la prairie, alouettes, bourdons et grillons. */
  private biome: Biome = 'foret';
  private minuterie: ReturnType<typeof setTimeout> | null = null;
  private allume = false;
  /** Fenêtre cachée : silence, sans changer le réglage Son. */
  private cache = false;
  private musique: MusiqueCombat | null = null;
  /** Réglage Musique (menu de l'icône) ; ne joue que si le son est allumé aussi. */
  private musiqueActive = true;
  /** Une vague est en cours à l'écran. */
  private combat = false;
  private readonly derniers = new Map<Effet, number>();

  get actif(): boolean {
    return this.allume;
  }

  /** Allume ou coupe tout le son (menu ⚙). À appeler depuis un clic pour que le navigateur laisse jouer. */
  activer(allume: boolean): void {
    this.allume = allume;
    if (allume) this.preparer();
    if (!this.contexte || !this.maitre) return;
    const t = this.contexte.currentTime;
    this.maitre.gain.cancelScheduledValues(t);
    this.maitre.gain.setTargetAtTime(allume && !this.cache ? 1 : 0, t, 0.05);
    if (allume && !this.cache) void this.contexte.resume();
    this.reglerMusique();
  }

  /** L'île à l'écran, pour l'ambiance. */
  paysage(biome: Biome): void {
    this.biome = biome;
  }

  /** Fenêtre cachée ou montrée : coupe tout (effets, ambiance, musique) puis le rend, réglage Son inchangé. */
  masquer(cache: boolean): void {
    this.cache = cache;
    if (!this.contexte || !this.maitre) return;
    const t = this.contexte.currentTime;
    this.maitre.gain.cancelScheduledValues(t);
    this.maitre.gain.setTargetAtTime(this.allume && !cache ? 1 : 0, t, 0.05);
    if (cache) void this.contexte.suspend();
    else if (this.allume) void this.contexte.resume();
    this.reglerMusique();
  }

  get musiqueAllumee(): boolean {
    return this.musiqueActive;
  }

  /** Allume ou coupe la musique de combat (le son doit être allumé aussi). */
  activerMusique(active: boolean): void {
    this.musiqueActive = active;
    this.reglerMusique();
  }

  /** Vague en cours à l'écran ou non : la musique démarre ou s'éteint en fondu. */
  combattre(combat: boolean): void {
    if (combat === this.combat) return;
    this.combat = combat;
    this.reglerMusique();
  }

  private reglerMusique(): void {
    const jouer = this.allume && !this.cache && this.musiqueActive && this.combat;
    if (jouer && !this.musique && this.contexte && this.maitre && this.bruit) {
      const sortie = this.contexte.createGain();
      sortie.gain.value = VOLUME_MUSIQUE;
      sortie.connect(this.maitre);
      this.musique = new MusiqueCombat(this.contexte, sortie, this.bruit);
    }
    if (jouer) this.musique?.demarrer();
    else this.musique?.arreter();
  }

  jouer(effet: Effet): void {
    const ctx = this.contexte;
    if (!this.allume || this.cache || !ctx || !this.effets) return;
    if (ctx.state === 'suspended') void ctx.resume();
    const maintenant = ctx.currentTime;
    if (maintenant - (this.derniers.get(effet) ?? -1) < (ECART_MIN_S[effet] ?? ECART_DEFAUT_S)) return;
    this.derniers.set(effet, maintenant);
    const { notes, souffles = [] } = EFFETS[effet];
    for (const n of notes) this.note(n, maintenant);
    for (const s of souffles) this.souffle(s, maintenant);
  }

  private preparer(): void {
    if (this.contexte) return;
    const Contexte = globalThis.AudioContext;
    if (!Contexte) return;
    const ctx = new Contexte();
    this.contexte = ctx;
    this.maitre = ctx.createGain();
    this.maitre.gain.value = 0;
    this.maitre.connect(ctx.destination);
    this.effets = ctx.createGain();
    this.effets.gain.value = VOLUME;
    this.effets.connect(this.maitre);
    // Une seconde de bruit blanc, lue à partir d'un endroit au hasard.
    this.bruit = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const donnees = this.bruit.getChannelData(0);
    for (let i = 0; i < donnees.length; i++) donnees[i] = Math.random() * 2 - 1;
    this.preparerAmbiance();
  }

  /** Ambiance copiée de Tiny Shrooms : nappe de vent qui respire lentement, et des oiseaux de temps en temps. */
  private preparerAmbiance(): void {
    const ctx = this.contexte!;
    this.ambiance = ctx.createGain();
    this.ambiance.gain.value = VOLUME_AMBIANCE;
    this.ambiance.connect(this.maitre!);

    // Six secondes de bruit rose approché, bouclées.
    const longueur = ctx.sampleRate * 6;
    const rose = ctx.createBuffer(1, longueur, ctx.sampleRate);
    const donnees = rose.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < longueur; i++) {
      const blanc = Math.random() * 2 - 1;
      b0 = 0.997 * b0 + blanc * 0.029;
      b1 = 0.985 * b1 + blanc * 0.032;
      b2 = 0.95 * b2 + blanc * 0.048;
      donnees[i] = (b0 + b1 + b2 + blanc * 0.02) * 0.9;
    }
    const source = ctx.createBufferSource();
    source.buffer = rose;
    source.loop = true;
    const filtre = ctx.createBiquadFilter();
    filtre.type = 'bandpass';
    filtre.frequency.value = 400;
    filtre.Q.value = 0.8;
    const vent = ctx.createGain();
    vent.gain.value = VENT;
    source.connect(filtre).connect(vent).connect(this.ambiance);
    source.start(0, Math.random() * rose.duration);
    // Le vent respire : un oscillateur lent module sa fréquence.
    const respiration = ctx.createOscillator();
    const ampleur = ctx.createGain();
    respiration.frequency.value = 0.09;
    ampleur.gain.value = 220;
    respiration.connect(ampleur).connect(filtre.frequency);
    respiration.start();

    // WebKit crée parfois le contexte suspendu : le premier appui le réveille.
    addEventListener('pointerdown', () => void ctx.resume(), { once: true });
    const suivant = () => {
      if (this.allume && ctx.state === 'running') {
        const r = Math.random();
        if (this.biome === 'marais') {
          if (r < 0.7) this.grenouille(ctx.currentTime);
          else this.grillon(ctx.currentTime);
        } else if (this.biome === 'prairie') {
          // Prairie : alouette, bourdon qui passe, stridulation dans l'herbe.
          if (r < 0.45) this.alouette(ctx.currentTime);
          else if (r < 0.75) this.bourdon(ctx.currentTime);
          else this.grillon(ctx.currentTime);
        } else if (this.biome === 'grotte') {
          // Grotte : gouttes qui tombent et résonnent, parfois un grondement lointain dans la roche.
          if (r < 0.8) this.goutte(ctx.currentTime);
          else this.grondement(ctx.currentTime);
        } else this.oiseau(ctx.currentTime);
      }
      this.minuterie = setTimeout(suivant, 4000 + Math.random() * 6000);
    };
    if (this.minuterie) clearTimeout(this.minuterie);
    this.minuterie = setTimeout(suivant, 2000);
  }

  private oiseau(debut: number): void {
    const base = 2200 + Math.random() * 1400;
    const cris = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < cris; i++) {
      const t = i * (0.11 + Math.random() * 0.05);
      this.note({ f: base, t, d: 0.07, vers: base * (1.2 + Math.random() * 0.3), onde: 'sine', v: 0.35 }, debut, this.ambiance!);
    }
  }

  /** Alouette : un long gazouillis aigu de notes très rapides, qui sautent de haut en bas. */
  private alouette(debut: number): void {
    const base = 2600 + Math.random() * 800;
    const n = 10 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      const f = base * (0.85 + Math.random() * 0.45);
      this.note({ f, t: i * 0.06, d: 0.045, vers: f * (0.9 + Math.random() * 0.3), onde: 'sine', v: 0.22 }, debut, this.ambiance!);
    }
  }

  /** Bourdon qui passe : un vrombissement grave qui enfle puis s'éloigne, en tremblant un peu. */
  private bourdon(debut: number): void {
    const ctx = this.contexte!;
    const duree = 1.2 + Math.random() * 0.8;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(170 + Math.random() * 40, debut);
    const vibrato = ctx.createOscillator();
    vibrato.frequency.value = 18;
    const ampleur = ctx.createGain();
    ampleur.gain.value = 6;
    vibrato.connect(ampleur).connect(osc.frequency);
    const filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = 700;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, debut);
    gain.gain.linearRampToValueAtTime(0.12, debut + duree * 0.45);
    gain.gain.linearRampToValueAtTime(0, debut + duree);
    osc.connect(filtre).connect(gain).connect(this.ambiance!);
    osc.start(debut);
    vibrato.start(debut);
    osc.stop(debut + duree + 0.05);
    vibrato.stop(debut + duree + 0.05);
  }

  /** Coassement : deux ou trois « crôa » graves, rauques, qui montent un peu. */
  private grenouille(debut: number): void {
    const base = 120 + Math.random() * 70;
    const cris = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < cris; i++) {
      const t = i * (0.2 + Math.random() * 0.06);
      this.note({ f: base, t, d: 0.12, vers: base * 1.35, onde: 'square', v: 0.22 }, debut, this.ambiance!);
      this.note({ f: base * 2, t, d: 0.08, vers: base * 2.4, onde: 'triangle', v: 0.12 }, debut, this.ambiance!);
    }
  }

  /** Goutte qui tombe dans une flaque : un « plic » qui descend, répété par l'écho de plus en plus bas. */
  private goutte(debut: number): void {
    const gouttes = Math.random() < 0.35 ? 2 : 1;
    for (let g = 0; g < gouttes; g++) {
      const f = 900 + Math.random() * 700;
      const t = g * (0.5 + Math.random() * 0.6);
      for (let e = 0; e < 3; e++)
        this.note({ f, t: t + e * 0.22, d: 0.09, vers: f * 0.55, onde: 'sine', v: 0.3 * 0.4 ** e }, debut, this.ambiance!);
    }
  }

  /** Grondement lointain : un souffle très grave qui enfle et retombe, comme la roche qui bouge. */
  private grondement(debut: number): void {
    this.note({ f: 55 + Math.random() * 15, t: 0, d: 1.4, vers: 40, onde: 'triangle', v: 0.28 }, debut, this.ambiance!);
    this.note({ f: 90, t: 0.1, d: 0.9, vers: 60, onde: 'sine', v: 0.12 }, debut, this.ambiance!);
  }

  /** Grillon : une rafale de petits cris aigus. */
  private grillon(debut: number): void {
    const base = 4200 + Math.random() * 800;
    for (let i = 0; i < 6; i++) this.note({ f: base, t: i * 0.045, d: 0.025, vers: base, onde: 'sine', v: 0.12 }, debut, this.ambiance!);
  }

  private note(n: Note, debut: number, sortie: AudioNode = this.effets!): void {
    const ctx = this.contexte!;
    const t0 = debut + n.t;
    const t1 = t0 + n.d;
    const osc = ctx.createOscillator();
    osc.type = n.onde ?? 'square';
    osc.frequency.setValueAtTime(n.f, t0);
    if (n.vers) osc.frequency.exponentialRampToValueAtTime(n.vers, t1);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(n.v ?? 0.5, t0 + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, t1);
    osc.connect(gain).connect(sortie);
    osc.start(t0);
    osc.stop(t1 + 0.02);
  }

  private souffle(s: Souffle, debut: number): void {
    const ctx = this.contexte!;
    const t0 = debut + s.t;
    const source = ctx.createBufferSource();
    source.buffer = this.bruit;
    const filtre = ctx.createBiquadFilter();
    filtre.type = s.aigu ? 'highpass' : 'lowpass';
    filtre.frequency.value = s.f;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(s.v, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + s.d);
    source.connect(filtre).connect(gain).connect(this.effets!);
    source.start(t0, Math.random() * 0.7);
    source.stop(t0 + s.d + 0.02);
  }
}
