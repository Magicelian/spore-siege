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
  // Sentier dans l'eau : les monstres y passent ralentis.
  g: 'gue',
  // Feuille flottante : les tours de terre s'y posent aussi.
  n: 'nenuphar',
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

/**
 * Marais, niveau 1 (Roselière) : une plage au nord-est. Le long sentier descend, traverse l'étang sud à gué et
 * remonte vers la souche ; un raccourci sec longe l'étang nord, une ronce en (15, 5) le ferme (les gués
 * sont sur le long chemin : sur un raccourci, ils rendaient la défense trop facile).
 */
export const CARTE_ROSELIERE = [
  '.....ffffff....sss..',
  '...fffhhhhff..ss=s..',
  '..ffhhhhhhhheeeh=hf.',
  '.ffbhhhhpheeeene=hff',
  '.fhhhhhhfhneeeee=hff',
  'fheehhhhhhhh=====hhf',
  'feeehhhphhhh=eee=hhf',
  'fenehhhhhhhh=nee=hhf',
  'feeehhhhhhhh=eeh=hff',
  '.heehhhhhSS==hhh=bf.',
  'fhhhh====SShhhhh=hf.',
  'fhhhh=hhhhhhhhhh=hff',
  '.fhhh=heeeeeeehh=hf.',
  '.fhhh=eeneeeeenh=hf.',
  '.ffhh=ggggggggg==hf.',
  '..fhhheeeeeeeeehhhf.',
  '..ffhhheeeneehhhhff.',
  '...ffhhhhhhhhhhfff..',
  '....fffhhhhhhffff...',
  '......ffffffff......',
] as const;

/** Marais, niveau 2 (Les Gués) : plages nord-est et ouest réunies en (12, 5) ; le chemin de l'ouest et le tronc passent à gué ; ronces interdites. */
export const CARTE_GUES = [
  '.....ffffff....sss..',
  '...fffhhhhff..ss=s..',
  '..ffhhhhhhhheeeh=hf.',
  '.ffphhheneeeeene=hff',
  '.fhhhheeeeeeeeee=hff',
  'ffhhh=gggggggggg=hhf',
  'fhhhh=eneeeegeeehhhf',
  'fhhhh=heeenegneehhhf',
  'fhhbh=hhhhhh=hhhhhff',
  '.hhhh=hhhSS==hhbhhf.',
  'ss====hhhSShhhhhhpf.',
  'sshhhhhhhhhhhhhhhhff',
  '.fhhhhhhhhhhheeeehf.',
  '.fheeeehhhhhheneehf.',
  '.feeneehhhhhheeeehf.',
  '..eeeeehphhhheeehhf.',
  '..eeeeehhhfbhhhhhff.',
  '...ffhhhhhhhhhhfff..',
  '....fffhhhhhhffff...',
  '......ffffffff......',
] as const;

/** Marais, niveau 3 (Tourbière) : une plage au sud ; raccourci par l'ouest (un gué) qu'une ronce en (8, 16) ferme, long détour par l'est et ses gués. */
export const CARTE_TOURBIERE = [
  '.....ffffff....hhh..',
  '...fffhhhhff..hhhh..',
  '..ffhhbhhhhhhffhhhf.',
  '.ffhhhhhhhhhhhhhhhff',
  '.fhhhhhhfh======hhff',
  'ffhheeehhh=eeeh=hhhf',
  'fhheneephh=eneh=hhhf',
  'fhheeeehhh=hhhegehhf',
  'fhheeehhhh=hhhegneff',
  '.hrhhhhhhSShhbegeef.',
  'hhhhh====SShhhngeef.',
  'hhhhh=hhhhhhhhegehff',
  '.fhhh=hbhhheeeh=hhf.',
  '.fhhegehhhheneh=hhf.',
  '.ffhegebhhheeeh=hrf.',
  '..fbh=hhhhhhhhh=hhf.',
  '..ffh===========hff.',
  '...ffhhhh=hhphhfff..',
  '....fffhh=hhhffff...',
  '......fffssfff......',
] as const;

/** Marais, niveau 4 (Bras morts) : trois plages à l'est réunies tôt ; le tronc longe un canal, de l'eau des deux côtés pour le héron. */
export const CARTE_BRAS_MORTS = [
  '.....ffffff....sss..',
  '...fffhhhhff..ss=s..',
  '..ffhhhhhhhheeeh=hf.',
  '.ffhhhhhhphheneh=hff',
  '.fhheeeeehhheeeh=hff',
  'ffhheeneehhhhhhh=hhf',
  'fhhheeeeehhhhhhh===s',
  'fhhhhhhhhhhhhphe=ehf',
  'fhhhhhhhhhhhhhhe=nff',
  '.hhhhbhhhSShhhhn=ef.',
  'hhhhhhhhhSS=hhhe=ef.',
  'hhhhhhhhhhhgeeee=efs',
  '.fhbhhhhhhh==gg===s.',
  '.fhhhhhhhhheneeeeef.',
  '.ffhhhhhhhhheenehhf.',
  '..fhhhhbhhhheeeehhf.',
  '..ffhhhhhhfhhhhhhff.',
  '...ffhhhhhhhhhhfff..',
  '....fffhhhhhhffff...',
  '......ffffffff......',
] as const;

/** Marais, niveau 5 (Cœur du marais, boss) : plages réunies en (12, 4) ; long tronc qui contourne la souche (gués au sud), sans raccourci :
 * le boss doit rester longtemps à portée (avec un raccourci, il arrivait à la souche presque intact). */
export const CARTE_COEUR_MARAIS = [
  '.....ffffff....sss..',
  '...fffeeeeef..ss=s..',
  '..ffhheeneehhffh=hf.',
  '.ffhhhhhhhhhhhhh=hff',
  '.fhh=============hff',
  'feee=hhhhhhh=hhhhhhf',
  'fene=hphhhph=eeeehhf',
  'feee=hhhhhhh=eneeehf',
  'feee=hbhhhhh=eeeeeff',
  '.hhh=hhhhSSh=eeeeef.',
  'ss===hhhhSSh=eeenef.',
  'sshhhhhhh=hh=eeneeff',
  '.fhhhhh===hh=heeehf.',
  '.fhhhhhgeene=hhhhhf.',
  '.ffbhhhggggg=hhhhpf.',
  '..fhhhheneeehhhbhhf.',
  '..ffhhheeeehhhhhhff.',
  '...ffhhhhhhhhhhfff..',
  '....fffhhhhhhffff...',
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
