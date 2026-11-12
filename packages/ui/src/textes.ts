// Tous les textes de l'interface, en un seul endroit : l'anglais s'ajoutera ici plus tard.
import type { TypeTour } from '@spore-siege/engine';

export const TOURS_TEXTES: Record<TypeTour, { nom: string; role: string }> = {
  ruche: { nom: 'Poste-ruche', role: 'Ses abeilles piquent vite, un monstre à la fois.' },
  cristal: { nom: 'Obélisque', role: 'Un éclair qui saute de monstre en monstre et perce les carapaces.' },
  mortier: { nom: 'Mortier à tourbe', role: 'Un obus lent qui éclabousse et englue toute une zone.' },
  canon: { nom: 'Canon à spores', role: 'Gros dégâts en zone, mais il recharge lentement.' },
};

export const TEXTES = {
  construire: 'Construire',
  stade: (n: number) => `Stade ${n}/3`,
  stadeMax: 'Stade 3/3, pleine puissance',
  ameliorer: 'Améliorer',
  vendre: 'Vendre',
  degats: 'Dégâts',
  portee: 'Portée',
  cadence: 'Recharge',
  rebonds: (n: number) => `${n} rebond${n > 1 ? 's' : ''}`,
  ralentit: 'ralentit',
  zone: 'zone',
  secondes: (s: number) => `${nombre(s)} s`,
  ronce: 'Ronce',
  ronceRole: 'Ferme cette branche du sentier : les monstres prennent l’autre.',
  ronceArracher: 'Arracher',
  ronceRoleArracher: 'Arrachée, la branche se rouvre et les monstres reprennent le plus court chemin.',
  ronceImpossible: 'Impossible ici : la souche doit garder un chemin, et pas sur un monstre.',
  faire: 'Faire pousser',
  lancer: 'Lancer',
  lancerAide: (n: number) => `Lancer la vague maintenant : +${n} spores, une par seconde gagnée.`,
  vague: (n: number, total: number) => `${n}/${total}`,
  vagueAide: 'Vague en cours ou à venir',
  vieAide: 'Vie de la souche',
  sporesAide: 'Spores, pour construire',
  pause: 'Pause',
  reprendre: 'Reprendre',
  rapide: 'Vitesse ×2',
  reglages: 'Réglages',
  fenetre: 'Fenêtre',
  partie: 'Partie',
  recommencer: 'Recommencer l’île',
  quitter: 'Quitter le jeu',
  victoire: 'Victoire',
  defaite: 'La souche est tombée',
  rejouer: 'Rejouer',
  fermer: 'Fermer',
};

/** Nombre à la française : virgule, au plus deux décimales. */
export function nombre(n: number): string {
  return (Math.round(n * 100) / 100).toString().replace('.', ',');
}
