// Point d'entrée : l'île-forêt dans une fenêtre qui flotte par-dessus les applications.
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ileForet } from '@spore-siege/engine';
import { Rendu } from '@spore-siege/renderer';

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
rendu.appliquerIle(ileForet());
rendu.demarrer();

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
window.addEventListener('pointerup', () => (appui = null));
window.addEventListener('blur', () => (appui = null));

// Q / E : un quart de tour.
window.addEventListener('keydown', (e) => {
  if (e.key === 'q' || e.key === 'a') rendu.tourner(-1);
  if (e.key === 'e') rendu.tourner(1);
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
