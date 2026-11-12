// Petites icônes pixel (9 × 9) dessinées depuis des motifs texte, converties une fois en images
// (même principe que Tiny Shrooms).

export type Icone = 'spore' | 'vie' | 'vague' | 'pause' | 'lecture' | 'rapide' | 'reglages' | 'degats' | 'portee' | 'cadence' | 'etoile' | 'etoileVide' | 'armure' | 'livre' | 'cadenas';

/** `.` transparent, `#` encre ; les autres lettres renvoient à la palette de l'icône. */
const MOTIFS: Record<Icone, { motif: string[]; palette: Record<string, string> }> = {
  spore: {
    motif: [
      '...###...',
      '..#rwr#..',
      '.#rrrrr#.',
      '#rwrrrwr#',
      '#########',
      '...#c#...',
      '...#c#...',
      '..#ccc#..',
      '...###...',
    ],
    palette: { r: '#c8402f', w: '#f3e6c8', c: '#e8d8b0' },
  },
  vie: {
    motif: [
      '.##...##.',
      '#rr#.#rr#',
      '#rwrrrrr#',
      '#rrrrrrr#',
      '.#rrrrr#.',
      '..#rrr#..',
      '...#r#...',
      '....#....',
      '.........',
    ],
    palette: { r: '#d8433a', w: '#ffb3a8' },
  },
  vague: {
    motif: [
      '..#####..',
      '.#ggggg#.',
      '#gg#g#gg#',
      '#gg#g#gg#',
      '#ggggggg#',
      '.#gg#gg#.',
      '..#g#g#..',
      '..#####..',
      '.........',
    ],
    palette: { g: '#c9cdd3' },
  },
  pause: {
    motif: ['.........', '.##...##.', '.#w#.#w#.', '.#w#.#w#.', '.#w#.#w#.', '.#w#.#w#.', '.#w#.#w#.', '.##...##.', '.........'],
    palette: { w: '#f3e6c8' },
  },
  lecture: {
    motif: ['.........', '.##......', '.#w##....', '.#www##..', '.#wwwww#.', '.#www##..', '.#w##....', '.##......', '.........'],
    palette: { w: '#f3e6c8' },
  },
  rapide: {
    motif: ['.........', '##...##..', '#w#..#w#.', '#ww#.#ww#', '#www##www', '#ww#.#ww#', '#w#..#w#.', '##...##..', '.........'],
    palette: { w: '#f3e6c8' },
  },
  reglages: {
    motif: [
      '...#.#...',
      '.#.#m#.#.',
      '..#mmm#..',
      '##m#.#m##',
      '.#m...m#.',
      '##m#.#m##',
      '..#mmm#..',
      '.#.#m#.#.',
      '...#.#...',
    ],
    palette: { m: '#a9adb3' },
  },
  degats: {
    motif: ['.......#.', '......#w#', '.....#w#.', '.#..#w#..', '..##w#...', '..#r#....', '.#r##....', '#r#..#...', '.#.......'],
    palette: { w: '#dfe3e8', r: '#7a4f2d' },
  },
  portee: {
    motif: ['..#####..', '.#.....#.', '#..###..#', '#.#...#.#', '#.#.r.#.#', '#.#...#.#', '#..###..#', '.#.....#.', '..#####..'],
    palette: { r: '#c8402f' },
  },
  cadence: {
    motif: ['..#####..', '.#wwwww#.', '#www#www#', '#www#www#', '#www##ww#', '#wwwwwww#', '.#wwwww#.', '..#####..', '.........'],
    palette: { w: '#f3e6c8' },
  },
  etoile: {
    motif: ['....#....', '...#j#...', '####jj###', '#jjjwjjj#', '.#jjjjj#.', '..#jjj#..', '.#jj#jj#.', '.#j#.#j#.', '.##...##.'],
    palette: { j: '#e8a33d', w: '#fbe7a8' },
  },
  armure: {
    motif: ['#########', '#mmmwmmm#', '#mmmwmmm#', '#mmmwmmm#', '#mmmwmmm#', '.#mmwmm#.', '.#mmwmm#.', '..#mwm#..', '...###...'],
    palette: { m: '#8d9198', w: '#dfe3e8' },
  },
  livre: {
    motif: ['.#######.', '#rrrrrrw#', '#rjjjrrw#', '#rrrrrrw#', '#rjjrrrw#', '#rrrrrrw#', '#rrrrrrw#', '#########', '.........'],
    palette: { r: '#8a3a2a', j: '#e8a33d', w: '#f3e6c8' },
  },
  cadenas: {
    motif: ['..#####..', '.#.....#.', '.#.....#.', '#########', '#jjjjjjj#', '#jjj#jjj#', '#jjj#jjj#', '#jjjjjjj#', '#########'],
    palette: { j: '#c9a24a' },
  },
  etoileVide: {
    motif: ['....#....', '...#g#...', '####gg###', '#ggggggg#', '.#ggggg#.', '..#ggg#..', '.#gg#gg#.', '.#g#.#g#.', '.##...##.'],
    palette: { g: '#4a3a36' },
  },
};

const cache = new Map<Icone, string>();

export function icone(nom: Icone): string {
  const deja = cache.get(nom);
  if (deja !== undefined) return deja;
  const { motif, palette } = MOTIFS[nom];
  const toile = document.createElement('canvas');
  toile.width = motif[0]!.length;
  toile.height = motif.length;
  const ctx = toile.getContext('2d');
  if (!ctx) return '';
  motif.forEach((ligne, y) =>
    [...ligne].forEach((p, x) => {
      if (p === '.') return;
      ctx.fillStyle = p === '#' ? '#1b1320' : (palette[p] ?? '#ff00ff');
      ctx.fillRect(x, y, 1, 1);
    }),
  );
  const url = toile.toDataURL();
  cache.set(nom, url);
  return url;
}
