// Îles dessinées à la main, une lettre par case.
import type { Biome, Case, Ile, Terrain } from './contrat';

const LETTRES: Record<string, Terrain> = {
  '.': 'vide',
  h: 'herbe',
  f: 'foret',
  p: 'fleurs',
  b: 'buisson',
  r: 'rocher',
  e: 'eau',
  s: 'sable',
  '=': 'sentier',
  // La souche est posée sur de l'herbe.
  S: 'herbe',
};

/**
 * Île-forêt de la V1, 20 × 20. Deux plages : à l'ouest, le sentier se divise au carrefour (4, 10) en une branche
 * nord et une branche sud ; au nord-est, il descend rejoindre la branche nord. Souche 2 × 2 au centre.
 */
export const CARTE_FORET = [
  '.....ffffff....sss..',
  '...fffhhhhff..ss=s..',
  '..ffhhhbhhhhhffh=hf.',
  '.ffhhrhhhhhhhhhh=hff',
  '.fhhhhhhfhhh=====hff',
  'ffhhhhhhhhhh=hhhbhhf',
  'fhhhhhhhhhhh=hhhhhhf',
  'fhhh=========hhrhhhf',
  'fhhh=hhhh=hhhhhhhhff',
  '.bhh=hhhhSShhhhhhhf.',
  'ss===hhhhSShhhhhbhf.',
  'sshh=hhhh=hhrhhhhhff',
  '.fhh=hhhh=hhhhhhhhf.',
  '.fhh======hhhhhheef.',
  '.ffhhhhhbhhhhheeehf.',
  '..fhhrhhhhhhhhheehf.',
  '..ffhhhhhhfhhhhhhff.',
  '...ffhhhhhhhhhhfff..',
  '....fffhhhbhhffff...',
  '......ffffffff......',
] as const;

/** Forêt, niveau 2 (Sous-bois) : plages nord-ouest et nord-est réunies au nord, tronc en lacets, un raccourci que la ronce ferme. */
export const CARTE_SOUS_BOIS = [
  '.....fsffff....fsf..',
  '...ffh=hhhhf..fh=f..',
  '..fhhh===========hf.',
  '.fhhhhhhhhh=hhhhhhhf',
  '.fhhhhhhhhh=hhhhhhhf',
  'fhh=========hhfffhhf',
  'fhh=hhhhhhhhhhfffhhf',
  'fbh=hfffhhhhhhfffhhf',
  'fhh=hhhhhhhhhhhhhhhf',
  '.fh======SS===hhbhf.',
  'fhh=hhhhhSShh=hhhhf.',
  'fhh=hphhbhhhh=hffhhf',
  '.fh=hhhhhhhhh=hffhf.',
  '.fh===========hffhf.',
  '.fhhhhhhhhhhhhhhhhf.',
  '..rhhffffhhhhhheehf.',
  '..fhhffffhhhphhehhf.',
  '...fhhhhhhhhhphhhf..',
  '....ffhhhhhhhhfff...',
  '......ffffffff......',
] as const;

/** Forêt, niveau 3 (Trois sentiers) : l'ouest et le sud se rejoignent, puis le nord-est ; un court tronc jusqu'à la souche. */
export const CARTE_TROIS_SENTIERS = [
  '.....ffffff....fss..',
  '...ffhhhffff..fh=f..',
  '..fhhhhhfffhffhh=hf.',
  '.fhhhhhhhhhh=====hhf',
  '.fhhhhhhhhhh=hhhhhhf',
  'fhhhhhhhhhhh=hhhhhhf',
  'fhhhhh=======hhphhhf',
  'fhbhhh=hhhhh=hhhhhhf',
  'fhhhhh=hhhhh=hhfffhf',
  '.fhhhh=hrSS==hhffff.',
  'fhhhhh=hhSShhhhffff.',
  'fshhhh=hhhhhhhhhhhhf',
  '.s=====hhhhhhhbheef.',
  '.shhhh=hhhhhhhhhehf.',
  '.fhhhh=hhfffhhhhbhf.',
  '..fpph=hhfffhhhhhhf.',
  '..fhhh=hhhhhhhhrhhf.',
  '...fhh=hhhhhhhhhhf..',
  '....ffshhhhhhhfff...',
  '......ffffffff......',
] as const;

/** Forêt, niveau 4 (Fourré) : plages sud et sud-est réunies, un court sentier dans un fourré épais, quelques clairières. */
export const CARTE_FOURRE = [
  '.....ffffff....fff..',
  '...ffhhhhhhf..fhhf..',
  '..fhhhhhhhhhffhhhhf.',
  '.fhhhhhhhhhhhhhhhhhf',
  '.fhhhhhhhhhhhhhheehf',
  'fhhhhhhhhhhhhphhhhhf',
  'fhhhhhhhhhhbhhhhhhhf',
  'fhhhhhhphhhhhhhhhhhf',
  'fhhhhbhhhhhhhhhhhhhf',
  '.fhffffffSShhffffrf.',
  'fhhfffff=SShhffffff.',
  'fhhfffff=hhfffffffhf',
  '.fhfffhh=hhffffffff.',
  '.fhfffhh=ffffffffff.',
  '.fhfffff=hhffffffff.',
  '..ffffhh=hhfhhhhfff.',
  '..ffffhh=fffhhfffff.',
  '...fffff=========s..',
  '....ffffff=ffffff...',
  '......ffffsfff......',
] as const;

/** Forêt, niveau 5 (Cœur de la forêt) : plages ouest et est réunies au nord, tronc autour de la souche, un raccourci que la ronce ferme. */
export const CARTE_COEUR = [
  '.....ffffff....fff..',
  '...ffhhhhhhe..fhhf..',
  '..fhhhhhhhhhefhhhrf.',
  '.fhhhhhhhhhhhhhhhhhf',
  '.s================sf',
  'fhhhhhhhhh=hhhhhhhhf',
  'fhhhhhffhh======hhhf',
  'fhbhhhffhhhhhhh=hhhf',
  'fhhhhhhhhhhhphh=hfff',
  '.fhhh====SShhhh=hff.',
  'fhffh=hhhSS=====hff.',
  'fhffh=hphhhhhhh=hhhf',
  '.fffh=hhhhhhffh=hhf.',
  '.fhhh=hhhhhhhhh=hbf.',
  '.fhhh===========hhf.',
  '..rhhhhhhhhhhhhhhhf.',
  '..fhhhhhhpbhhhhhhhf.',
  '...fhhhhhhhhhhhhhf..',
  '....ffhhhhhhhhfff...',
  '......ffffffff......',
] as const;

/** Lit une carte en lettres ; la souche est le carré de `S`. */
export function lireCarte(lignes: readonly string[], biome: Biome): Ile {
  const profondeur = lignes.length;
  const largeur = lignes[0]?.length ?? 0;
  const terrain: Terrain[] = [];
  const souches: Case[] = [];
  lignes.forEach((ligne, y) => {
    if (ligne.length !== largeur) throw new Error(`ligne ${y} : ${ligne.length} cases au lieu de ${largeur}`);
    [...ligne].forEach((lettre, x) => {
      const t = LETTRES[lettre];
      if (!t) throw new Error(`lettre inconnue « ${lettre} » en (${x}, ${y})`);
      if (lettre === 'S') souches.push({ x, y });
      terrain.push(t);
    });
  });
  const souche = souches[0];
  const tailleSouche = Math.round(Math.sqrt(souches.length));
  if (!souche || tailleSouche * tailleSouche !== souches.length) throw new Error('la souche doit être un carré de S');
  return { biome, largeur, profondeur, terrain, souche, tailleSouche };
}

export function ileForet(): Ile {
  return lireCarte(CARTE_FORET, 'foret');
}
