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
  // Touffe de champignons luisants (grotte) : elle éclaire autour d'elle, on ne construit pas dessus.
  l: 'luisant',
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
/**
 * Prairie, niveau 1 (Prés fleuris) : plages ouest et nord-est. Elles se rejoignent sur la ligne 7, qui descend à la
 * souche par (10, 8) ; une ronce en (7, 7) envoie l'ouest par la grande boucle sud, une en (10, 8) y envoie tout le monde.
 */
export const CARTE_PRES_FLEURIS = [
  '.....hfhpfh....sss..',
  '...fhfhhhhhh..ss=s..',
  '..ffhhpphhhhhfhh=hf.',
  '.ffhhrhhhhphhhhh=hff',
  'ss=====hfhhhhphh=pfh',
  'shhhhh=hhhhhhhhh=hph',
  'fhhhhh=hhhhhhhhp=hhp',
  'hhhphh===========hhf',
  'phhhhp=hhh=hhhhhhhff',
  '.hhhhh=hpSShhhhhhhh.',
  'hhhhhh=hhSS===hhhhf.',
  'hhhhhh=hhhhhh=hhhpff',
  '.fhhhh=hhhhhh=hhhhf.',
  '.hhhhp=hphhhh=heehh.',
  '.hfhhh========heeef.',
  '..hrhhhhhhhhhhrhhhf.',
  '..fhhhhhhhfhhhhphph.',
  '...fhhhhhphhhhhfhf..',
  '....ffphhhhhhhhfh...',
  '......fhfhphhh......',
] as const;

/**
 * Prairie, niveau 2 (Lisière) : forêt à l'ouest, plages nord-est et sud réunies en (10, 14). Le nord-est a un raccourci par
 * (11, 6) ; une ronce en (12, 6) l'envoie par la grande boucle, une en (10, 13) y envoie le sud.
 */
export const CARTE_LISIERE = [
  '.....ffffff....sss..',
  '...fhhhphhff..ss=s..',
  '..ffhhhhhhhhhffh=hf.',
  '.fffhhhphhhhhhhh=hff',
  '.fffhphhfhhhhhhh=hff',
  'fffhhhhhhhhhhhhh=hhf',
  'fffhhhhhhhh======hpf',
  'ffffhhhhhhh=h=hhphhh',
  'ffffhhhhhhp=h=hphhff',
  '.hhfhhhhhSS=h=hhhhf.',
  'fffhhhhhhSShh=hphhf.',
  'hfffhphhhh=hh=hhhhff',
  '.ffhhhhhhh=hh=hhhhf.',
  '.ffhhhphph=hh=hhphf.',
  '.pffhh========hhhhf.',
  '..ffhh=hhhhhhhhhhhf.',
  '..ffhh=hhhfhhhhhhff.',
  '...fhh=hphhhhhhhff..',
  '....fssshhhhhffff...',
  '......ffffffff......',
] as const;

/**
 * Prairie, niveau 3 (Hautes herbes) : plages ouest et nord-est réunies en (12, 4), tronc en lacets ; ronces interdites.
 */
export const CARTE_HAUTES_HERBES = [
  '.....fffhhh....sss..',
  '...pfhhhphff..ss=s..',
  '..hfhphhhhhhhhpp=hf.',
  '.fhhhhhhphhhhhhh=hfh',
  '.hhh=============hpf',
  'hfhh=hhhhhhh=hhhhhhf',
  'fhph=hh======hhhhphf',
  'hhhh=hp=hhhhhhhphhhf',
  'fhhh=hh========phhff',
  '.php=hhhhSShph=hphh.',
  'ss===hhhhSShph=hhhf.',
  'sshpphhhhh=hhh=hhhff',
  '.fphhhphhh=====hhhh.',
  '.hhhhhhhhhhhhhhphhp.',
  '.hfhhhhhhphhhpphphh.',
  '..fhhhhhhhhhhhhphhf.',
  '..hfhphhphphhhhhhff.',
  '...ffhhhphhhphpfhf..',
  '....fffhphhhhfhhf...',
  '......ffhfpfff......',
] as const;

/**
 * Prairie, niveau 4 (Champs du moulin) : trois plages (nord-est, ouest, sud) réunies en (8, 14), tronc court ; une ronce
 * en (9, 12) envoie tout le monde par la boucle nord (+13 cases).
 */
export const CARTE_CHAMPS_MOULIN = [
  '.....fhffff....sss..',
  '...ffhhhhhfp..ss=s..',
  '..ffhphhhphhpfhh=hf.',
  '.hfhhhhhhhhphhph=hpf',
  '.hhhhhhhhhhhhphh=hhh',
  'hfhhhhhphhhhhp===hhh',
  'fhhhh=====hhhp=phphf',
  'fphhh=hhh=phhh=phhpf',
  'hhphh=hhp=hhhh=hhhhh',
  '.hhhh=hhhSShhh=hhhh.',
  'ss==h=hhhSShph=hhhf.',
  'ssp=h=hhh=hhhh=phphf',
  '.fh=p=====hhhh=hphh.',
  '.fh=hhhh=hhhhh=hphf.',
  '.ff============hhhf.',
  '..hhhhhh=hhhhhhhhhf.',
  '..hhhhhh====hphphhf.',
  '...hfhhhhhh=hhhhff..',
  '....fhhhhhh=hfhhf...',
  '......fhfpsssh......',
] as const;

/**
 * Prairie, niveau 5 (Cœur de la prairie, boss) : plages est et ouest réunies en (12, 3), long tronc sans raccourci.
 */
export const CARTE_COEUR_PRAIRIE = [
  '.....hhhfhf....hhh..',
  '...hhfphhhhh..hhhh..',
  '..hfhhhhhhhhhhhhhhf.',
  '.hf==============hhh',
  '.fh=hhhhfphh=hhh=hhh',
  'hfp=hh=======hph=hhf',
  'hhh=hh=hhhhphhhh=hhs',
  'fhp=ph=hhhhhhhph===s',
  'fhh=hh=hhhhhhhhhphhs',
  '.hh=hh=hhSShphhhhhh.',
  'ss==pp=hhSShhhhhhhf.',
  'ssphhh=hp=phhhhhhhff',
  '.fhhhp=hh=====hhhhh.',
  '.fhhhh=hphhhh=hhhhf.',
  '.ffhhh=hhhphh=hhhhh.',
  '..hhhh========hhhhh.',
  '..hfhhhhphhhhhhhhff.',
  '...hfpphhhhhhhhfff..',
  '....fffhhhhhhpfff...',
  '......hfhfffhf......',
] as const;

/**
 * Grotte, niveau 2 (La Voûte) : plages ouest (0) et nord-est (1) réunies en (8, 4) ; raccourci vers la souche, une
 * ronce en (8, 7) envoie tout le monde par la grande boucle sud-ouest. 5 luisants.
 */
export const CARTE_VOUTE = [
  '.....hrhhrh....hss..',
  '...rhrhhhhrh..hh=h..',
  '..rrhhhhhhhhhrhh=lr.',
  '.rrhhrhhhhhhhhhh=hrr',
  's================hrh',
  'hhhhlhhh=hhhlhhrhhhh',
  'rhh======hhhhhhhhhrh',
  'hhh=hhhh=hhhhhhhhhhr',
  'hhr=hhhh=hhlhhhhhhrr',
  '.hh=hhhl=SShhhhhhrh.',
  'hhh=hhhhhSShhhhhhhr.',
  'hhl=hhhhl=hlhhhhhhrr',
  '.rh=hhhhh=lrhhhhhhr.',
  '.hh=hhlhh=hhhhhhhhh.',
  '.hr=======hhhhhhhhr.',
  '..hrhhhhhhhhhhrhrhr.',
  '..rhrhhhhhrhhhhhhhh.',
  '...rhhhrhhhhhhhrhr..',
  '....rrhhhhhhrhhrh...',
  '......rhrhhhhh......',
] as const;

/**
 * Grotte, niveau 3 (Lac souterrain) : plages ouest et sud réunies en (9, 15) ; le chemin de l'ouest passe à gué sous
 * le lac, un étang borde le tronc à l'est (héron) ; ronces interdites. 4 luisants.
 */
export const CARTE_LAC = [
  '.....hrhhrh....hhh..',
  '...rhrhhhhrh..hhhh..',
  '..rrhhhhhhhhhrhhhhr.',
  '.rrhhrhhhhhhhhhhhhrr',
  'hhhhhhhhrhhhhhhhhhrh',
  'hhhhhhhhhhhhhhhrhhhh',
  'rhhhhhhhhhhhhhhhhhrh',
  'shlhhhhhhhhhhhhhhhhr',
  's====hhhlhhlhhhhhhrr',
  '.hhh=hhhhSShhhhhhrh.',
  'heel=hhhhSS=hhhhhhr.',
  'henh=hhhlhh====hhhrr',
  '.eeh=heeneeeeh=hhhr.',
  '.eeh=heeeeenel=eeee.',
  '.hrh=eeeehhhhh=enee.',
  '..hr=gggg======eeee.',
  '..rhreeee=lhhhheeee.',
  '...rhhhrh=hhhhhrhr..',
  '....rrhhh=hhrhhrh...',
  '......rhrshhhh......',
] as const;

/**
 * Grotte, niveau 4 (Mine abandonnée) : 3 plages (ouest, sud, nord-est) réunies en (5, 12), tronc en lacets à l'est ;
 * seulement 2 luisants : tout repose sur les champignons-lanternes.
 */
export const CARTE_MINE = [
  '.....hrhhrh....hss..',
  '...rhrhhhhrh..hh=h..',
  '..rrhhhhhhhhhrhh=hr.',
  '.rrhhrhhhhhhh====hrr',
  'hhhhhhhhrhhhh=hhhhrh',
  'hhhhhhhhhhhhh=hrhhhh',
  'rhhhhhhhhhhhh=hhhhrh',
  'hhhhh=========hhhhhr',
  'hhrhh=hhlhhlhhhhhhrr',
  '.hhhh=hlhSShhhhhhrh.',
  'hhhhh=hhhSS======hr.',
  'hhhhh=hhlhhlhhhh=hrr',
  's============hhh=hr.',
  '.hhhh=hhhhhh=hlh=hh.',
  '.hrhh=hhhhhh=hhh=hr.',
  '..hrh=hhhhhh=====hr.',
  '..rhr=hhhhrhhhhhhhh.',
  '...rh=hrhhhhhhhrhr..',
  '....r=hhhhhhrhhrh...',
  '.....srhrhhhhh......',
] as const;

/**
 * Grotte, niveau 5 (Cœur de la grotte, boss) : plages ouest et est réunies en (12, 3), long tronc sans raccourci ;
 * des luisants près de la souche, seules lumières que le Ver ne souffle pas.
 */
export const CARTE_COEUR_GROTTE = [
  '.....hrhhrh....hhh..',
  '...rhrhhhhrh..hhhh..',
  '..rrhhhhhhhhhrhhlhr.',
  's==================r',
  'hhhhhhhlrhhh=hhhhh=h',
  'hhhhhh=======hhrhh=h',
  'rhhhhh=hhhhlhhhhhh=h',
  'hhhhhh=hhhhhhhhhhh=s',
  'hhrhhh=hlhhhhhhhhhrr',
  '.hhhhl=hhSSlhhhhhrh.',
  'hhhhhh=hhSShhhhhhhr.',
  'hhhhhh=hl=hlhhhhhhrr',
  '.rhhhh=hh=hrhhhhhhr.',
  '.hhhhh====hhlhhhhhh.',
  '.hrhhhhhlhhhhhhhhhr.',
  '..hrhhhhhhhhhhrhrhr.',
  '..rhrhhhhhrhhhhhhhh.',
  '...rhhhrhhhhhhhrhr..',
  '....rrhhhhhhrhhrh...',
  '......rhrhhhhh......',
] as const;

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

/**
 * Grotte, niveau 1 (Galerie des luisants) : le tracé des Prés fleuris (plages ouest et nord-est réunies ligne 7,
 * ronce (7, 7)), semé de rochers et de 7 luisants (`l`) qui éclairent une bonne moitié du chemin : le reste est
 * noir et attend les champignons-lanternes.
 */
export const CARTE_GALERIE = [
  '.....hrhhrh....sss..',
  '...rhrhhhhrh..ss=s..',
  '..rrhhhhhhhhhrhh=hr.',
  '.rrhhrhhhhhhhhhh=lrr',
  'ss=====hrhhhhhhh=hrh',
  'shhhlh=hhhhhhhrh=hhh',
  'rhhhhh=hhhhhhhhh=hrh',
  'hhhhhh===========hhr',
  'hhrhhh=hhh=lhhhhhhrr',
  '.hhhhh=hhSShhhhhhrh.',
  'hhhhhl=hhSS===hhhhr.',
  'hhhhhh=hhhhhh=hhhhrr',
  '.rhhhh=hhhhrh=lhhhr.',
  '.hhhhh=hhhhhh=heehh.',
  '.hrhhh========heeer.',
  '..hrhhhhhlhhhhrhrhr.',
  '..rhrhhhhhrhhhhhhhh.',
  '...rhhhrhhhhhhhrhr..',
  '....rrhhhhhhrhhrh...',
  '......rhrhhhhh......',
] as const;
