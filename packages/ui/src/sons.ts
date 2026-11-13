// Sons synthétisés avec Web Audio, aucun fichier (principe repris de Tiny Shrooms) : bruitages brefs façon 8-bit
// pour les tirs, les explosions, les morts, la souche mordue et l'interface ; ambiance de fond comme Tiny Shrooms
// (vent qui respire, oiseaux de temps en temps) ; musique de combat pendant les vagues (`musique.ts`).
// Coupé par défaut ; le contexte audio n'est créé qu'une fois le son allumé.
import type { TypeTour } from '@spore-siege/engine';
import { MusiqueCombat } from './musique';

export type Effet =
  | 'ouvrir'
  | 'fermer'
  | 'poser'
  | 'ameliorer'
  | 'vendre'
  | 'ronce'
  | 'refus'
  | 'vague'
  | 'victoire'
  | 'defaite'
  | `tir-${TypeTour}`
  | 'explosion'
  | 'mort'
  | 'morsure';

const VOLUME = 0.22;
/** Ambiance de fond, basse exprès (même niveau que Tiny Shrooms) ; le vent par-dessus en léger souffle. */
const VOLUME_AMBIANCE = 0.1;
const VENT = 0.18;
/** Musique de combat : sous les effets, pour que les tirs restent lisibles. */
const VOLUME_MUSIQUE = 0.13;
/** Deux effets identiques plus rapprochés que ceci n'en font qu'un (les ruches tirent beaucoup). */
const ECART_MIN_S: Partial<Record<Effet, number>> = { 'tir-ruche': 0.14, 'tir-cristal': 0.1, mort: 0.05, explosion: 0.08 };
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
  explosion: { notes: [{ f: 90, t: 0, d: 0.2, vers: 40, onde: 'triangle', v: 0.6 }], souffles: [{ t: 0, d: 0.25, f: 700, v: 0.55 }] },
  // Floc : une note qui tombe, puis un petit plop.
  mort: { notes: [{ f: 620, t: 0, d: 0.08, vers: 160, onde: 'sine', v: 0.45 }, { f: 900, t: 0.05, d: 0.04, onde: 'square', v: 0.15 }] },
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
  private minuterie: ReturnType<typeof setTimeout> | null = null;
  private allume = false;
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
    this.maitre.gain.setTargetAtTime(allume ? 1 : 0, t, 0.05);
    if (allume) void this.contexte.resume();
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
    const jouer = this.allume && this.musiqueActive && this.combat;
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
    if (!this.allume || !ctx || !this.effets) return;
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
      if (this.allume && ctx.state === 'running') this.oiseau(ctx.currentTime);
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
