"""Icônes de Spore Siege en pixel art, dessinées sur une grille puis agrandies sans lissage.

- `icone.png` (1024 px, grille 32 × 32) : le canon à spores, chapeau rouge casqué, et une limace, sur fond transparent.
- `barre-menus.png` (36 px, grille 18 × 18) : sa silhouette en modèle monochrome pour la barre des menus.

Couleurs de `packages/renderer/src/fortins.ts`. Usage :
    python3 dessiner-icone.py && pnpm --filter desktop tauri icon src-tauri/icons/icone.png
(puis supprimer les dossiers `android` et `ios` générés).
"""
import struct
import zlib
from pathlib import Path

ICI = Path(__file__).parent

CONTOUR = (0x1E, 0x14, 0x10)
CIEL = [(0xE0, 0x7A, 0x3C), (0xC8, 0x56, 0x30), (0xA0, 0x3C, 0x2A), (0x74, 0x2A, 0x24), (0x4A, 0x1E, 0x1C)]
LUEUR = (0xF2, 0xA0, 0x50)
COLLINE = (0x2E, 0x1C, 0x18)
COLLINE_CLAIRE = (0x3E, 0x26, 0x1E)
CHAPEAU = (0xC8, 0x40, 0x3A)
CHAPEAU_CLAIR = (0xE8, 0x64, 0x52)
CHAPEAU_SOMBRE = (0x8E, 0x2A, 0x26)
POIS = (0xF3, 0xE6, 0xC8)
LAMELLES = (0xE8, 0xD9, 0xB8)
LAMELLES_OMBRE = (0xB8, 0xA4, 0x84)
BOIS = (0x6B, 0x4A, 0x2F)
BOIS_CLAIR = (0x8A, 0x64, 0x40)
BOIS_SOMBRE = (0x4A, 0x32, 0x20)
METAL = (0x8A, 0x84, 0x7C)
METAL_CLAIR = (0xBC, 0xB4, 0xA8)
METAL_SOMBRE = (0x4A, 0x44, 0x40)
ROUILLE = (0x9A, 0x4A, 0x24)
RIVET = (0xE0, 0xC8, 0x90)
PIERRE = (0x7D, 0x77, 0x6B)
PIERRE_SOMBRE = (0x55, 0x50, 0x48)
SPORE = (0xF6, 0xEC, 0xC8)


class Grille:
    def __init__(self, n):
        self.n = n
        self.p = [[None] * n for _ in range(n)]

    def point(self, x, y, c):
        if 0 <= x < self.n and 0 <= y < self.n:
            self.p[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.point(x, y, c)

    def ovale(self, cx, cy, rx, ry, c, haut_seulement=False):
        for y in range(self.n):
            for x in range(self.n):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1 and (not haut_seulement or y + 0.5 <= cy):
                    self.point(x, y, c)

    def detourer(self, couleur=CONTOUR):
        """Contour d'un pixel autour de tout ce qui est dessiné (diagonales comprises)."""
        bord = []
        for y in range(self.n):
            for x in range(self.n):
                if self.p[y][x] is not None:
                    continue
                if any(
                    0 <= x + dx < self.n and 0 <= y + dy < self.n and self.p[y + dy][x + dx] not in (None, couleur)
                    for dx in (-1, 0, 1)
                    for dy in (-1, 0, 1)
                ):
                    bord.append((x, y))
        for x, y in bord:
            self.p[y][x] = couleur


def png(chemin, grille, echelle):
    n = grille.n * echelle
    lignes = b''
    for y in range(n):
        lignes += b'\0'
        for x in range(n):
            c = grille.p[y // echelle][x // echelle]
            lignes += bytes(c + (255,)) if c else b'\0\0\0\0'
    morceau = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xFFFFFFFF)
    donnees = (
        b'\x89PNG\r\n\x1a\n'
        + morceau(b'IHDR', struct.pack('>IIBBBBB', n, n, 8, 6, 0, 0, 0))
        + morceau(b'IDAT', zlib.compress(lignes, 9))
        + morceau(b'IEND', b'')
    )
    Path(chemin).write_bytes(donnees)


def canon(g, ox=0, oy=0):
    """Le canon à spores : socle de pierre, tour de planches cerclée, fût rouillé, chapeau casqué."""
    # Socle.
    g.rect(9 + ox, 27 + oy, 22 + ox, 28 + oy, PIERRE)
    for x in (10, 13, 17, 20):
        g.point(x + ox, 28 + oy, PIERRE_SOMBRE)
    g.rect(9 + ox, 27 + oy, 22 + ox, 27 + oy, PIERRE)
    # Tour de planches : lumière à gauche, ombre à droite.
    g.rect(11 + ox, 17 + oy, 20 + ox, 26 + oy, BOIS)
    for x in range(11, 21, 2):
        g.rect(x + ox, 17 + oy, x + ox, 26 + oy, BOIS_SOMBRE if x > 15 else BOIS)
    g.rect(11 + ox, 17 + oy, 11 + ox, 26 + oy, BOIS_CLAIR)
    g.rect(12 + ox, 17 + oy, 12 + ox, 26 + oy, BOIS_CLAIR)
    g.rect(20 + ox, 17 + oy, 20 + ox, 26 + oy, BOIS_SOMBRE)
    # Cerclages rivés.
    for y in (19, 24):
        g.rect(11 + ox, y + oy, 20 + ox, y + oy, METAL)
        g.point(11 + ox, y + oy, METAL_CLAIR)
        g.point(20 + ox, y + oy, METAL_SOMBRE)
        for x in (13, 16, 19):
            g.point(x + ox, y + oy, RIVET)
    # Meurtrière.
    g.rect(15 + ox, 21 + oy, 16 + ox, 22 + oy, CONTOUR)
    # Fût du canon, vers la droite, bouche rouillée.
    g.rect(20 + ox, 20 + oy, 26 + ox, 22 + oy, METAL)
    g.rect(20 + ox, 20 + oy, 26 + ox, 20 + oy, METAL_CLAIR)
    g.rect(20 + ox, 22 + oy, 26 + ox, 22 + oy, METAL_SOMBRE)
    g.rect(26 + ox, 20 + oy, 27 + ox, 22 + oy, ROUILLE)
    g.point(27 + ox, 21 + oy, CONTOUR)
    # Chapeau : dôme rouge, lamelles dessous, reflet, pois.
    g.ovale(16 + ox, 17 + oy, 11, 9, CHAPEAU, haut_seulement=True)
    g.ovale(13.5 + ox, 12 + oy, 5, 3.2, CHAPEAU_CLAIR)
    for x in range(5, 27):
        if g.p[16 + oy][x + ox] == CHAPEAU or g.p[16 + oy][x + ox] == CHAPEAU_CLAIR:
            g.point(x + ox, 16 + oy, CHAPEAU_SOMBRE)
    g.rect(8 + ox, 17 + oy, 23 + ox, 17 + oy, LAMELLES)
    for x in range(9, 23, 2):
        g.point(x + ox, 17 + oy, LAMELLES_OMBRE)
    for x, y in ((10, 12), (11, 13), (18, 10), (19, 10), (18, 11), (19, 11), (23, 13), (14, 15), (8, 15)):
        g.point(x + ox, y + oy, POIS)
    # Pointe de casque en métal.
    g.rect(15 + ox, 5 + oy, 16 + ox, 8 + oy, METAL)
    g.rect(15 + ox, 5 + oy, 15 + ox, 8 + oy, METAL_CLAIR)
    g.point(15 + ox, 3 + oy, METAL_CLAIR)
    g.point(15 + ox, 2 + oy, METAL_CLAIR)
    g.point(16 + ox, 4 + oy, METAL)
    g.point(15 + ox, 4 + oy, METAL_CLAIR)
    g.rect(14 + ox, 8 + oy, 17 + ox, 8 + oy, METAL_SOMBRE)


def limace(g):
    """Limace de la Rouille qui rampe vers la tour : moisissure grise, taches de rouille, œil qui luit."""
    g.ovale(5, 27.5, 4, 2, (0x8D, 0x91, 0x98))
    g.ovale(7, 26, 2.2, 2, (0x8D, 0x91, 0x98))
    g.rect(2, 28, 8, 28, (0x6A, 0x6D, 0x74))
    g.point(3, 26, (0xB9, 0xBE, 0xC4))
    g.point(5, 26, (0xB8, 0x57, 0x2B))
    g.point(4, 27, (0xB8, 0x57, 0x2B))
    g.point(8, 24, (0x4C, 0x4F, 0x57))
    g.point(8, 23, (0xFF, 0xA2, 0x3A))


def icone():
    fond = Grille(32)
    # Ciel de guerre en bandes, plus sombre vers le bas, avec une lueur derrière la tour.
    for y in range(32):
        bande = CIEL[min(len(CIEL) - 1, y * len(CIEL) // 26)]
        fond.rect(0, y, 31, y, bande)
        # Tramage entre deux bandes.
        if y % 6 == 5 and y < 26:
            suivante = CIEL[min(len(CIEL) - 1, (y + 1) * len(CIEL) // 26)]
            for x in range(0, 32, 2):
                fond.point(x + (y // 6) % 2, y, suivante)
    fond.ovale(16, 13, 14, 11, CIEL[0])
    fond.ovale(16, 12, 10, 7, LUEUR)
    # Collines sombres.
    fond.ovale(6, 32, 12, 8, COLLINE_CLAIRE)
    fond.ovale(27, 33, 12, 9, COLLINE_CLAIRE)
    fond.rect(0, 27, 31, 31, COLLINE)
    # Spores qui s'envolent de la bouche du canon.
    for x, y in ((29, 18), (30, 16), (28, 15), (30, 13)):
        fond.point(x, y, SPORE)

    devant = Grille(32)
    canon(devant)
    limace(devant)
    devant.detourer()
    # Fond transparent (demande de Celian, 12/11/2026) : seul le sujet, détouré, sans ciel ni cadre.
    png(ICI / 'icone.png', devant, 32)


def barre_menus():
    """Même style que celle de Tiny Shrooms (chapeau à gros pois évidés, pied à part avec deux yeux), en version
    guerre : pointe de casque sur le chapeau, fût de canon sur le côté. En noir (macOS la teinte)."""
    g = Grille(18)
    noir = (0, 0, 0)
    # Pointe de casque.
    g.rect(8, 1, 9, 2, noir)
    # Chapeau.
    for y, x0, x1 in ((3, 6, 11), (4, 4, 13), (5, 3, 14), (6, 2, 15), (7, 1, 16), (8, 1, 16)):
        g.rect(x0, y, x1, y, noir)
    g.rect(4, 5, 5, 6, None)
    g.rect(11, 4, 12, 5, None)
    # Pied, coins arrondis, deux yeux.
    g.rect(5, 10, 12, 15, noir)
    for x, y in ((5, 10), (12, 10), (5, 15), (12, 15)):
        g.point(x, y, None)
    g.rect(7, 12, 7, 13, None)
    g.rect(10, 12, 10, 13, None)
    # Fût du canon, à droite du pied.
    g.rect(13, 12, 15, 13, noir)
    g.rect(16, 11, 16, 14, noir)
    png(ICI / 'barre-menus.png', g, 2)


icone()
barre_menus()
