//! Flèche vers le haut sur l'icône de la barre des menus quand une mise à jour est prête (comme Tiny Shrooms).
//!
//! L'icône est un modèle monochrome que macOS teinte selon la barre des menus : la flèche l'est donc aussi,
//! pleine et détourée d'un anneau vide pour se détacher du dessin.

use tauri::{image::Image, AppHandle};

const ICONE: &[u8] = include_bytes!("../icons/barre-menus.png");
/// Côté d'un pixel du dessin, en pixels de l'image (dessinée à 18 px, fournie ×2).
const PIXEL: u32 = 2;

/// Une mise à jour est téléchargée : flèche jusqu'au redémarrage.
pub fn signaler_mise_a_jour(app: &AppHandle) {
    if let Err(erreur) = redessiner(app) {
        eprintln!("pastille : {erreur}");
    }
}

fn redessiner(app: &AppHandle) -> Result<(), String> {
    let icone = app.tray_by_id("main").ok_or("icône de barre des menus absente")?;
    let image = Image::from_bytes(ICONE).map_err(|e| e.to_string())?.to_owned();
    icone.set_icon(Some(dessiner(image, est_fleche))).map_err(|e| e.to_string())?;
    icone.set_icon_as_template(true).map_err(|e| e.to_string())
}

/// Flèche vers le haut dans le coin haut gauche.
fn est_fleche(x: i32, y: i32) -> bool {
    match y {
        0 => x == 2,
        1 => (1..=3).contains(&x),
        2 => (0..=4).contains(&x),
        3 | 4 => x == 2,
        _ => false,
    }
}

/// Peint la forme en plein et vide un anneau d'un pixel autour.
fn dessiner(image: Image<'_>, forme: fn(i32, i32) -> bool) -> Image<'static> {
    let (largeur, hauteur) = (image.width(), image.height());
    let mut pixels = image.rgba().to_vec();
    for y in 0..hauteur {
        for x in 0..largeur {
            let (px, py) = ((x / PIXEL) as i32, (y / PIXEL) as i32);
            let couleur = if forme(px, py) {
                [0, 0, 0, 0xff]
            } else if (-1..=1).any(|dy| (-1..=1).any(|dx| forme(px + dx, py + dy))) {
                [0, 0, 0, 0]
            } else {
                continue;
            };
            let i = ((y * largeur + x) * 4) as usize;
            pixels[i..i + 4].copy_from_slice(&couleur);
        }
    }
    Image::new_owned(pixels, largeur, hauteur)
}
