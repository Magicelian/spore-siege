// Point d'entrée : l'île-forêt dans une fenêtre qui flotte par-dessus les applications.
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import {
  ileForet,
  Partie,
  PART_RONCE_RENDUE,
  PAS_MS,
  PRIX_RONCE,
  TOURS,
  VAGUES_FORET,
  type Case,
  type Instantane,
  type TypeTour,
} from '@spore-siege/engine';
import { Rendu, type Pose } from '@spore-siege/renderer';

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

rendu.surImage = (instant) => {
  reserve += dernierInstant === null ? 0 : instant - dernierInstant;
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
  rendu.afficherPartie(precedent, actuel, reserve / PAS_MS, selection, pose());
  if (pas > 0) {
    if (precedent && precedent.phase !== actuel.phase) {
      if (actuel.phase === 'vague') departVague = instant;
      journal(`vague ${actuel.vague} : ${actuel.phase} après ${((instant - departVague) / 1000).toFixed(1)} s`);
    }
    if (precedent && precedent.souche.pv !== actuel.souche.pv)
      journal(`souche ${actuel.souche.pv}/${actuel.souche.pvMax}, ${((instant - departVague) / 1000).toFixed(1)} s après le départ de la vague`);
    afficherCompteur(actuel);
    afficherOutils(actuel);
  }
};
rendu.demarrer();
// Pour mesurer depuis la console en développement : `debogage()`.
if (import.meta.env.DEV) Object.assign(window, { debogage: () => ({ actuel, reserve, images: rendu.images, survol, rendu }) });
/** En développement dans Tauri : écrit dans le terminal de `pnpm dev`. */
const journal = (message: string) => {
  if (import.meta.env.DEV && dansTauri) void invoke('journal', { message });
};
let departVague = 0;

// Compteur provisoire (l'interface définitive vient à l'étape 4).
const compteur = document.getElementById('compteur')!;
const texte = compteur.querySelector('span')!;
const action = compteur.querySelector('button')!;
action.addEventListener('click', () => {
  if (actuel.phase === 'victoire' || actuel.phase === 'defaite') {
    partie = new Partie(ile, VAGUES_FORET, Date.now() >>> 0);
    precedent = null;
    choix = selection = ronceChoisie = null;
  } else partie.executer({ type: 'lancerVague' });
  rafraichir();
});
/** Après une commande : l'instantané change sans attendre le pas suivant. */
function rafraichir(): void {
  actuel = partie.instantane();
  afficherCompteur(actuel);
  afficherOutils(actuel);
}
function afficherCompteur(i: Instantane): void {
  const souche = `Souche ${i.souche.pv}/${i.souche.pvMax}`;
  const etat = {
    pause: `Vague ${i.vague}/${i.vagues} dans ${i.pauseRestante} s`,
    vague: `Vague ${i.vague}/${i.vagues}`,
    victoire: `Victoire ${'★'.repeat(i.etoiles)}${'☆'.repeat(3 - i.etoiles)}`,
    defaite: 'La souche est tombée',
  }[i.phase];
  texte.textContent = `${etat} · ${souche} · ${i.spores} spores`;
  action.hidden = i.phase === 'vague';
  action.textContent = i.phase === 'pause' ? `Lancer +${i.bonusLancer}` : 'Rejouer';
  action.title = i.phase === 'pause' ? 'Lancer la vague maintenant : une spore par seconde gagnée' : '';
}
afficherCompteur(actuel);

// ─── Tours (barre et fiche provisoires, l'interface définitive vient à l'étape 4) ──────
type Outil = TypeTour | 'ronce';
const NOMS: Record<Outil, string> = { ruche: 'Ruche', cristal: 'Cristal', mortier: 'Mortier', canon: 'Canon', ronce: 'Ronce' };
const TYPES = Object.keys(NOMS) as Outil[];
const prixPose = (o: Outil) => (o === 'ronce' ? PRIX_RONCE : TOURS[o].stades[0].prix);
/** Tour ou ronce à poser au prochain clic, tour ou ronce dont on montre la fiche, case sous la souris. */
let choix: Outil | null = null;
let selection: number | null = null;
let ronceChoisie: Case | null = null;
let survol: Case | null = null;

const barre = document.getElementById('barre')!;
const boutonsTours = TYPES.map((type, i) => {
  const b = document.createElement('button');
  b.textContent = `${i + 1} ${NOMS[type]} ${prixPose(type)}`;
  b.addEventListener('click', () => choisir(choix === type ? null : type));
  barre.append(b);
  return b;
});
const fiche = document.getElementById('fiche')!;
const ficheTexte = fiche.querySelector('span')!;
const ameliorer = fiche.querySelector<HTMLButtonElement>('[data-action="ameliorer"]')!;
const vendre = fiche.querySelector<HTMLButtonElement>('[data-action="vendre"]')!;
ameliorer.addEventListener('click', () => {
  if (ronceChoisie) return;
  if (selection !== null) partie.executer({ type: 'ameliorerTour', id: selection });
  rafraichir();
});
vendre.addEventListener('click', () => {
  if (selection !== null) partie.executer({ type: 'vendreTour', id: selection });
  if (ronceChoisie) partie.executer({ type: 'enleverRonce', case: ronceChoisie });
  selection = ronceChoisie = null;
  rafraichir();
});

function choisir(type: Outil | null): void {
  choix = type;
  if (type) selection = ronceChoisie = null;
  afficherOutils(actuel);
}

function afficherOutils(i: Instantane): void {
  const fin = i.phase === 'victoire' || i.phase === 'defaite';
  if (fin) choix = selection = ronceChoisie = null;
  TYPES.forEach((type, n) => {
    boutonsTours[n]!.classList.toggle('choisi', choix === type);
    boutonsTours[n]!.disabled = fin || i.spores < prixPose(type);
  });
  const tour = i.tours.find((t) => t.id === selection);
  if (ronceChoisie && !i.ronces.some((r) => r.x === ronceChoisie!.x && r.y === ronceChoisie!.y)) ronceChoisie = null;
  fiche.hidden = !tour && !ronceChoisie;
  if (ronceChoisie) {
    ficheTexte.textContent = 'Ronce';
    ameliorer.hidden = true;
    vendre.textContent = `Enlever +${Math.floor(PRIX_RONCE * PART_RONCE_RENDUE)}`;
    return;
  }
  if (!tour) return;
  ficheTexte.textContent = `${NOMS[tour.type]} stade ${tour.stade}`;
  ameliorer.hidden = tour.prixAmelioration === null;
  ameliorer.textContent = `Améliorer ${tour.prixAmelioration}`;
  ameliorer.disabled = tour.prixAmelioration === null || i.spores < tour.prixAmelioration;
  vendre.textContent = `Vendre ${tour.revente}`;
}
afficherOutils(actuel);

function pose(): Pose | null {
  if (!choix || !survol) return null;
  const ronce = choix === 'ronce';
  return {
    type: choix,
    case: survol,
    possible: (ronce ? partie.ronceLibre(survol) : partie.libre(survol)) && actuel.spores >= prixPose(choix),
    // Ronce : un petit cercle sous la case, blanc ou rouge selon qu'elle peut pousser.
    portee: choix === 'ronce' ? 0.5 : TOURS[choix].stades[0].portee,
  };
}

/** Clic sans glisser sur l'île : pose la tour choisie, sinon ouvre la fiche de la tour visée. */
function cliquer(x: number, y: number): void {
  const c = rendu.caseSous(x, y);
  if (choix) {
    const commande = choix === 'ronce' ? { type: 'poserRonce' as const, case: c! } : { type: 'poserTour' as const, tour: choix, case: c! };
    if (c && partie.executer(commande)) choix = null;
  } else {
    selection = (c && actuel.tours.find((t) => t.case.x === c.x && t.case.y === c.y)?.id) ?? null;
    ronceChoisie = (c && actuel.ronces.find((r) => r.x === c.x && r.y === c.y)) ?? null;
  }
  rafraichir();
}

window.addEventListener('resize', () => rendu.redimensionner());

// Molette : zoom par paliers.
window.addEventListener(
  'wheel',
  (e) => {
    e.preventDefault();
    if (Math.abs(e.deltaY) > 2) rendu.zoomer(e.deltaY < 0 ? 1 : -1);
  },
  { passive: false },
);

// Glisser : déplace la fenêtre, comme Tiny Shrooms ; avec Cmd (ou Ctrl), ou dans un navigateur, déplace la vue.
let appui: { x: number; y: number; mode: 'attente' | 'vue'; fenetre: boolean } | null = null;
rendu.canevas.addEventListener('pointerdown', (e) => {
  if (e.button === 0) appui = { x: e.clientX, y: e.clientY, mode: 'attente', fenetre: dansTauri && !(e.metaKey || e.ctrlKey) };
});
window.addEventListener('pointermove', (e) => {
  survol = e.target === rendu.canevas ? rendu.caseSous(e.clientX, e.clientY) : null;
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
  if (appui?.mode === 'attente') cliquer(e.clientX, e.clientY);
  appui = null;
});
window.addEventListener('blur', () => (appui = null));

// Q / E : un quart de tour.
window.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'a') rendu.tourner(-1);
  if (e.key === 'e') rendu.tourner(1);
  // 1 à 5 : choisir une tour ou la ronce ; Échap : annuler.
  const n = Number(e.key);
  if (n >= 1 && n <= TYPES.length) choisir(choix === TYPES[n - 1] ? null : TYPES[n - 1]!);
  if (e.key === 'Escape') {
    choisir(null);
    selection = ronceChoisie = null;
    afficherOutils(actuel);
  }
});

// Menu de la fenêtre (provisoire, refait avec l'interface à l'étape 4) : taille et quitter.
if (dansTauri) {
  const menu = document.getElementById('menu')!;
  const bouton = document.getElementById('bouton-menu')!;
  const cases = TAILLES.map(({ cote, nom }) => {
    const choix = document.createElement('button');
    choix.textContent = nom;
    choix.addEventListener('click', async () => cocher(await invoke<number>('regler_taille', { taille: cote })));
    menu.append(choix);
    return { cote, choix };
  });
  const quitter = document.createElement('button');
  quitter.textContent = 'Quitter';
  quitter.className = 'quitter';
  quitter.addEventListener('click', () => void invoke('quitter'));
  menu.append(quitter);
  const cocher = (taille: number) => cases.forEach(({ cote, choix }) => choix.classList.toggle('coche', cote === taille));
  void invoke<number>('taille_actuelle').then(cocher);
  bouton.hidden = false;
  bouton.addEventListener('click', () => menu.toggleAttribute('hidden'));
  window.addEventListener('blur', () => menu.setAttribute('hidden', ''));
}
