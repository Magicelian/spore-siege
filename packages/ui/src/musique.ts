// Musique de combat synthétisée (Web Audio, aucun fichier) : tambours de guerre, basse sombre en ré mineur et,
// une phrase sur deux, un cor grave qui enfle. Ne joue que pendant les vagues ; entre deux vagues, seule
// l'ambiance (vent, oiseaux) reste. Les notes sont planifiées un peu à l'avance pour un tempo stable.

const TEMPO = 96;
/** Durée d'une double croche, en secondes. */
const PAS = 60 / TEMPO / 4;
/** Une mesure = 16 doubles croches ; le motif fait 2 mesures, la phrase 8. */
const PAS_PAR_MESURE = 16;
const AVANCE_S = 0.25;
const INTERVALLE_MS = 80;

// Fréquences (Hz).
const LA1 = 55;
const SIB1 = 58.27;
const DO2 = 65.41;
const RE2 = 73.42;
const FA2 = 87.31;
const SOL2 = 98;

/** Gros tambour, tom grave et frappe sèche sur les 2 mesures du motif (indices de doubles croches). */
const GROS = [0, 6, 8, 16, 22, 24, 27, 28];
const TOM = [3, 11, 14, 19, 30];
const FRAPPE = [4, 12, 20, 28];
/** Basse en croches sur les 2 mesures. */
const BASSE = [RE2, RE2, FA2, RE2, RE2, RE2, SIB1, DO2, RE2, RE2, FA2, SOL2, FA2, RE2, DO2, LA1];
/** Cor : une note tenue par mesure, sur les mesures 4 à 7 de la phrase. */
const COR = [RE2 * 2, FA2 * 2, DO2 * 2, RE2 * 2];

export class MusiqueCombat {
  private readonly sortie: GainNode;
  private minuterie: ReturnType<typeof setInterval> | null = null;
  /** Prochaine double croche à planifier, et son heure dans le contexte audio. */
  private pas = 0;
  private heure = 0;

  constructor(
    private readonly ctx: AudioContext,
    destination: AudioNode,
    private readonly bruit: AudioBuffer,
  ) {
    this.sortie = ctx.createGain();
    this.sortie.gain.value = 0;
    this.sortie.connect(destination);
  }

  get enCours(): boolean {
    return this.minuterie !== null;
  }

  /** Démarre en fondu sur une mesure, depuis le début du motif. */
  demarrer(): void {
    if (this.minuterie) return;
    const t = this.ctx.currentTime;
    this.sortie.gain.cancelScheduledValues(t);
    this.sortie.gain.setValueAtTime(this.sortie.gain.value, t);
    this.sortie.gain.linearRampToValueAtTime(1, t + PAS * PAS_PAR_MESURE);
    this.pas = 0;
    this.heure = t + 0.05;
    this.minuterie = setInterval(() => this.planifier(), INTERVALLE_MS);
    this.planifier();
  }

  /** S'éteint en fondu de 2 s ; les notes déjà planifiées se perdent dans le fondu. */
  arreter(): void {
    if (!this.minuterie) return;
    clearInterval(this.minuterie);
    this.minuterie = null;
    const t = this.ctx.currentTime;
    this.sortie.gain.cancelScheduledValues(t);
    this.sortie.gain.setValueAtTime(this.sortie.gain.value, t);
    this.sortie.gain.setTargetAtTime(0, t, 0.6);
  }

  private planifier(): void {
    // Onglet en arrière-plan : on ne rattrape pas le retard, on repart de maintenant.
    if (this.heure < this.ctx.currentTime) this.heure = this.ctx.currentTime + 0.05;
    while (this.heure < this.ctx.currentTime + AVANCE_S) {
      this.jouerPas(this.pas, this.heure);
      this.pas++;
      this.heure += PAS;
    }
  }

  private jouerPas(pas: number, t: number): void {
    const motif = pas % (PAS_PAR_MESURE * 2);
    const mesure = Math.floor(pas / PAS_PAR_MESURE) % 8;
    if (GROS.includes(motif)) this.grosTambour(t, motif % PAS_PAR_MESURE === 0 ? 1 : 0.75);
    if (TOM.includes(motif)) this.tom(t);
    if (FRAPPE.includes(motif)) this.frappe(t);
    if (motif % 2 === 0) this.basse(BASSE[motif / 2]!, t);
    // Le cor enfle sur la seconde moitié de la phrase.
    if (mesure >= 4 && pas % PAS_PAR_MESURE === 0) this.cor(COR[mesure - 4]!, t, PAS * PAS_PAR_MESURE);
  }

  /** Taiko : sinus qui plonge + bouffée de bruit grave. */
  private grosTambour(t: number, force: number): void {
    this.oscillo({ onde: 'sine', f: 110, vers: 42, t, d: 0.45, v: 0.9 * force });
    this.bouffee({ t, d: 0.12, f: 300, v: 0.5 * force, type: 'lowpass' });
  }

  private tom(t: number): void {
    this.oscillo({ onde: 'sine', f: 160, vers: 90, t, d: 0.22, v: 0.45 });
  }

  /** Frappe sèche sur le bord du tambour. */
  private frappe(t: number): void {
    this.bouffee({ t, d: 0.06, f: 2500, v: 0.18, type: 'highpass' });
    this.oscillo({ onde: 'triangle', f: 380, vers: 300, t, d: 0.04, v: 0.12 });
  }

  /** Basse en dents de scie, étouffée par un filtre. */
  private basse(f: number, t: number): void {
    const osc = this.ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const filtre = this.ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.Q.value = 4;
    filtre.frequency.setValueAtTime(700, t);
    filtre.frequency.exponentialRampToValueAtTime(180, t + 0.2);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.32, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + PAS * 2 * 0.95);
    osc.connect(filtre).connect(gain).connect(this.sortie);
    osc.start(t);
    osc.stop(t + PAS * 2);
  }

  /** Cor de guerre : deux dents de scie légèrement désaccordées (et la quinte), attaque lente, filtre sombre. */
  private cor(f: number, t: number, duree: number): void {
    const filtre = this.ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.setValueAtTime(350, t);
    filtre.frequency.linearRampToValueAtTime(900, t + duree * 0.6);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.09, t + duree * 0.4);
    gain.gain.linearRampToValueAtTime(0, t + duree);
    filtre.connect(gain).connect(this.sortie);
    for (const [frequence, desaccord] of [
      [f, -6],
      [f, 6],
      [f * 1.5, 0],
    ] as const) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = frequence;
      osc.detune.value = desaccord;
      osc.connect(filtre);
      osc.start(t);
      osc.stop(t + duree + 0.02);
    }
  }

  private oscillo(n: { onde: OscillatorType; f: number; vers: number; t: number; d: number; v: number }): void {
    const osc = this.ctx.createOscillator();
    osc.type = n.onde;
    osc.frequency.setValueAtTime(n.f, n.t);
    osc.frequency.exponentialRampToValueAtTime(n.vers, n.t + n.d);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, n.t);
    gain.gain.linearRampToValueAtTime(n.v, n.t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.001, n.t + n.d);
    osc.connect(gain).connect(this.sortie);
    osc.start(n.t);
    osc.stop(n.t + n.d + 0.02);
  }

  private bouffee(b: { t: number; d: number; f: number; v: number; type: BiquadFilterType }): void {
    const source = this.ctx.createBufferSource();
    source.buffer = this.bruit;
    const filtre = this.ctx.createBiquadFilter();
    filtre.type = b.type;
    filtre.frequency.value = b.f;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(b.v, b.t);
    gain.gain.exponentialRampToValueAtTime(0.001, b.t + b.d);
    source.connect(filtre).connect(gain).connect(this.sortie);
    source.start(b.t, Math.random() * 0.7);
    source.stop(b.t + b.d + 0.02);
  }
}
