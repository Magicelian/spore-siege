// Point d'entrée : l'île-forêt dans une fenêtre qui flotte par-dessus les applications.
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ileForet, Partie, PAS_MS, VAGUES_FORET, type Commande, type EvenementVu, type Instantane, type Phase } from '@spore-siege/engine';
import { echelleAffichage, ORDRE_ILES, Rendu } from '@spore-siege/renderer';
import { ControleurInterface, type Effet, type Fenetre, type Jeu } from '@spore-siege/ui';
import '@spore-siege/ui/interface.css';

const dansTauri = '__TAURI_INTERNALS__' in window;
/** Distance, en pixels, au-delà de laquelle un appui devient un glisser. */
const SEUIL_GLISSER = 4;
/** Mêmes valeurs que `TAILLES` dans `src-tauri/src/reglages.rs` ; 0 = tout l'écran. */
const TAILLES = [
  { cote: 480, nom: 'Petite' },
  { cote: 800, nom: 'Grande' },
  { cote: 0, nom: 'Géante' },
] as const;

const conteneur = document.getElementById('jeu')!;
const rendu = new Rendu(conteneur);
const ile = ileForet();
rendu.appliquerIle(ile);

// ─── Partie : le moteur avance à pas fixes, l'affichage glisse entre deux pas ──────────
/** Au-delà, on lâche du retard plutôt que de rattraper (fenêtre restée cachée, par exemple). */
const PAS_MAX_PAR_IMAGE = 10;
let partie = new Partie(ile, VAGUES_FORET, Date.now() >>> 0);
let precedent: Instantane | null = null;
let actuel = partie.instantane();
let reserve = 0;
let dernierInstant: number | null = null;
let departVague = 0;

const fenetre: Fenetre | undefined = dansTauri
  ? {
      tailles: TAILLES,
      regler: (taille) => invoke<number>('regler_taille', { taille }),
      actuelle: () => invoke<number>('taille_actuelle'),
      quitter: () => void invoke('quitter'),
      son: (son) => void invoke('regler_son', { son }),
    }
  : undefined;

const SON_COMMANDE: Partial<Record<Commande['type'], Effet>> = {
  poserTour: 'poser',
  ameliorerTour: 'ameliorer',
  vendreTour: 'vendre',
  poserRonce: 'ronce',
  enleverRonce: 'ronce',
};

/** Ce que les sons ont déjà entendu : phase, dernier tir de chaque tour, dernière explosion. */
const entendu = { phase: actuel.phase as Phase, tirs: new Map<number, number>(), impact: -1 };

/** Joue ce qui s'est passé depuis la dernière image. */
function ecouter(vue: Instantane, evenements: EvenementVu[]): void {
  const sons = ui.sons;
  if (vue.phase !== entendu.phase) {
    entendu.phase = vue.phase;
    if (vue.phase === 'vague') sons.jouer('vague');
    else if (vue.phase === 'victoire') sons.jouer('victoire');
    else if (vue.phase === 'defaite') sons.jouer('defaite');
  }
  for (const t of vue.tours) {
    if (t.dernierTir >= 0 && entendu.tirs.get(t.id) !== t.dernierTir) sons.jouer(`tir-${t.type}`);
    entendu.tirs.set(t.id, t.dernierTir);
  }
  if (vue.impacts.some((i) => i.pas > entendu.impact)) sons.jouer('explosion');
  entendu.impact = Math.max(entendu.impact, ...vue.impacts.map((i) => i.pas));
  for (const e of evenements) sons.jouer(e.type);
}

/** La partie vue par l'interface : après une commande, l'instantané change sans attendre le pas suivant. */
function jeuDe(p: Partie): Jeu {
  return {
    executer: (commande) => {
      const fait = p.executer(commande);
      if (fait) actuel = p.instantane();
      const effet = fait ? SON_COMMANDE[commande.type] : 'refus';
      if (effet) ui.sons.jouer(effet);
      return fait;
    },
    instantane: () => actuel,
    libre: (c) => p.libre(c),
    ronceLibre: (c) => p.ronceLibre(c),
    emplacementsRonces: p.emplacementsRonces,
    ile: p.ile,
  };
}

const ui = new ControleurInterface(document.getElementById('interface')!, jeuDe(partie), {
  vignette: (type, stade) => rendu.vignettes.tour(type, stade),
  vignetteMonstre: (type) => rendu.vignettes.monstre(type),
  recommencer,
  fenetre,
  changerEcran: (ecran) => {
    rendu.montrer(ecran === 'partie' ? 'ile' : 'carte');
    dernierInstant = null;
  },
  // L'interface est grossie (zoom CSS) : ses pixels valent `--echelle` pixels de la fenêtre.
  positionsCarte: () => {
    const e = Math.floor(echelleAffichage());
    return rendu.positionsCarte().map((p) => ({ ...p, x: p.x / e, y: p.y / e }));
  },
  ilesJouables: ['foret'],
});
rendu.montrer('carte');
ui.maj(actuel);

function recommencer(): void {
  partie = new Partie(ile, VAGUES_FORET, Date.now() >>> 0);
  ui.jeu = jeuDe(partie);
  precedent = null;
  actuel = partie.instantane();
  Object.assign(entendu, { phase: actuel.phase, tirs: new Map(), impact: -1 });
  ui.fermer();
  ui.maj(actuel);
}

rendu.surImage = (instant) => {
  if (ui.ecran !== 'partie') return;
  reserve += dernierInstant === null ? 0 : (instant - dernierInstant) * ui.vitesse;
  dernierInstant = instant;
  let pas = 0;
  while (reserve >= PAS_MS && pas < PAS_MAX_PAR_IMAGE) {
    partie.avancer();
    precedent = actuel;
    actuel = partie.instantane();
    reserve -= PAS_MS;
    pas++;
  }
  if (pas === PAS_MAX_PAR_IMAGE) reserve = 0;
  const marque = ui.marque;
  ecouter(actuel, rendu.afficherPartie(precedent, actuel, reserve / PAS_MS, ui.selection, ui.apercu, marque));
  rendu.canevas.style.cursor = marque ? 'pointer' : '';
  if (pas > 0 || ui.vitesse === 0) {
    if (precedent && precedent.phase !== actuel.phase) {
      if (actuel.phase === 'vague') departVague = instant;
      journal(`vague ${actuel.vague} : ${actuel.phase} après ${((instant - departVague) / 1000).toFixed(1)} s`);
    }
  }
  ui.maj(actuel);
};
rendu.demarrer();
// Menu de l'icône de la barre des menus : le jeu suit le son et la taille choisis.
if (dansTauri) {
  void listen<boolean>('son', (e) => ui.signalerSon(e.payload));
  void listen<number>('taille', (e) => ui.signalerTaille(e.payload));
}
// Pour mesurer depuis la console en développement : `debogage()`.
if (import.meta.env.DEV) Object.assign(window, { debogage: () => ({ actuel, reserve, images: rendu.images, rendu, ui, partie }) });
/** En développement dans Tauri : écrit dans le terminal de `pnpm dev`. */
function journal(message: string): void {
  if (import.meta.env.DEV && dansTauri) void invoke('journal', { message });
}

// ─── Fenêtre et entrées ──────────────────────────────────────────────────────────────
function redimensionner(): void {
  rendu.redimensionner();
  document.documentElement.style.setProperty('--echelle', String(Math.floor(echelleAffichage())));
  ui.rafraichir();
}
window.addEventListener('resize', redimensionner);
redimensionner();

// Molette : zoom par paliers.
window.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (ui.ecran === 'partie' && Math.abs(e.deltaY) > 2) rendu.zoomer(e.deltaY < 0 ? 1 : -1);
  },
  { passive: false },
);

// Clic : bulle de la case visée. Glisser : déplace la fenêtre, comme Tiny Shrooms ; avec Cmd (ou Ctrl), ou dans un
// navigateur, déplace la vue.
let appui: { x: number; y: number; mode: 'attente' | 'vue'; fenetre: boolean } | null = null;
rendu.canevas.addEventListener('pointerdown', (e) => {
  if (e.button === 0) appui = { x: e.clientX, y: e.clientY, mode: 'attente', fenetre: dansTauri && !(e.metaKey || e.ctrlKey) };
});
window.addEventListener('pointermove', (e) => {
  // Survol : ce qu'on pourrait cliquer, marqué sur l'île (pas pendant un glisser, ni sous l'interface).
  ui.survoler(!appui && e.target === rendu.canevas && ui.ecran === 'partie' ? rendu.caseSous(e.clientX, e.clientY) : null);
  if (!appui) return;
  if (appui.mode === 'attente' && Math.hypot(e.clientX - appui.x, e.clientY - appui.y) > SEUIL_GLISSER) {
    if (appui.fenetre) {
      // La fenêtre suit la souris jusqu'au relâchement ; la vue web ne reçoit plus rien d'ici là.
      appui = null;
      void getCurrentWindow().startDragging();
      return;
    }
    appui.mode = 'vue';
  }
  if (appui.mode === 'vue') {
    rendu.glisser(e.clientX - appui.x, e.clientY - appui.y);
    appui.x = e.clientX;
    appui.y = e.clientY;
  }
});
window.addEventListener('pointerup', (e) => {
  // La bulle s'ouvre du côté opposé au clic, pour ne pas cacher la case.
  if (appui?.mode === 'attente' && ui.ecran === 'partie') ui.cliquer(rendu.caseSous(e.clientX, e.clientY), e.clientY > window.innerHeight / 2);
  appui = null;
});
window.addEventListener('blur', () => {
  appui = null;
  ui.survoler(null);
});
document.addEventListener('pointerleave', () => ui.survoler(null));

// Q / E : un quart de tour ; espace : pause ; Échap : fermer la bulle.
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') ui.fermer();
  if (ui.ecran !== 'partie') return;
  if (e.key === 'q' || e.key === 'a') rendu.tourner(-1);
  if (e.key === 'e') rendu.tourner(1);
  if (e.key === ' ') {
    e.preventDefault();
    ui.basculerPause();
  }
});
