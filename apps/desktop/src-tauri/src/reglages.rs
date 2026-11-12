//! Réglages gardés à part de la partie : taille et dernière position de la fenêtre, son ; menu de l'icône de la
//! barre des menus qui les montre (comme Tiny Shrooms).
use serde::{Deserialize, Serialize};
use std::fs;
use std::sync::Mutex;
use tauri::menu::{CheckMenuItem, MenuItem, Submenu};
use tauri::{AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewWindow, Wry};

/// Côtés proposés pour la fenêtre carrée, en pixels logiques. Le jeu est dessiné pour la petite :
/// les autres ne montrent pas plus d'île, elles grossissent ses pixels. `ECRAN` (la géante) prend
/// le plus grand carré que laisse l'écran. La même liste vit dans `apps/desktop/src/main.ts`.
pub const TAILLES: [u32; 3] = [480, 800, ECRAN];
pub const ECRAN: u32 = 0;

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct Reglages {
    /// Coin haut-gauche de la fenêtre, en pixels physiques.
    pub position: Option<(i32, i32)>,
    pub taille: Option<u32>,
    /// Le jeu le règle au lancement (il garde le choix du joueur) ; coupé par défaut.
    pub son: bool,
}

/// Noms des tailles dans le menu, dans l'ordre de `TAILLES`.
pub const NOMS_TAILLES: [&str; 3] = ["Petite", "Grande", "Géante"];

/// Entrées du menu de l'icône qui changent pendant la partie.
pub struct MenuReglages {
    pub basculer: MenuItem<Wry>,
    pub taille: Submenu<Wry>,
    /// Une case par entrée de `TAILLES`, dans le même ordre.
    pub tailles: Vec<CheckMenuItem<Wry>>,
    pub son: CheckMenuItem<Wry>,
    /// État des mises à jour ; cliquable seulement quand une version est prête (texte : `mises_a_jour`).
    pub mettre_a_jour: MenuItem<Wry>,
    pub quitter: MenuItem<Wry>,
}

pub struct EtatReglages {
    pub reglages: Mutex<Reglages>,
    pub menu: MenuReglages,
}

/// Coche la taille et le son des réglages.
pub fn preparer_menu(menu: &MenuReglages, reglages: &Reglages) {
    for (case, cote) in menu.tailles.iter().zip(TAILLES) {
        let _ = case.set_checked(cote == reglages.taille_effective());
    }
    let _ = menu.son.set_checked(reglages.son);
}

impl Reglages {
    /// Taille retenue, ramenée à la petite si le fichier en porte une qu'on ne propose plus.
    pub fn taille_effective(&self) -> u32 {
        self.taille.filter(|t| TAILLES.contains(t)).unwrap_or(TAILLES[0])
    }
}

fn fichier(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join("reglages.json"))
}

pub fn lire(app: &AppHandle) -> Reglages {
    fichier(app)
        .and_then(|f| fs::read_to_string(f).ok())
        .and_then(|texte| serde_json::from_str(&texte).ok())
        .unwrap_or_default()
}

pub fn ecrire(app: &AppHandle, reglages: &Reglages) {
    let Some(fichier) = fichier(app) else { return };
    if let Some(dossier) = fichier.parent() {
        let _ = fs::create_dir_all(dossier);
    }
    if let Ok(texte) = serde_json::to_string_pretty(reglages) {
        let _ = fs::write(fichier, texte);
    }
}

/// Replace la fenêtre là où on l'avait laissée, si cet endroit est encore sur un écran.
pub fn restaurer_position(fenetre: &WebviewWindow, reglages: &Reglages) {
    let Some((x, y)) = reglages.position else { return };
    let visible = fenetre.available_monitors().unwrap_or_default().iter().any(|ecran| {
        let (p, t) = (ecran.position(), ecran.size());
        x >= p.x && y >= p.y && x < p.x + t.width as i32 && y < p.y + t.height as i32
    });
    if visible {
        let _ = fenetre.set_position(PhysicalPosition::new(x, y));
        garder_visible(fenetre);
    }
}

/// Ramène la fenêtre sur son écran quand elle vient de grandir au-delà du bord.
fn garder_visible(fenetre: &WebviewWindow) {
    let (Ok(coin), Ok(taille), Ok(Some(ecran))) = (fenetre.outer_position(), fenetre.outer_size(), fenetre.current_monitor())
    else {
        return;
    };
    let (p, t) = (ecran.position(), ecran.size());
    let x = coin.x.min(p.x + t.width as i32 - taille.width as i32).max(p.x);
    let y = coin.y.min(p.y + t.height as i32 - taille.height as i32).max(p.y);
    if (x, y) != (coin.x, coin.y) {
        let _ = fenetre.set_position(PhysicalPosition::new(x, y));
    }
}

/// Donne à la fenêtre le côté demandé (elle reste carrée), sans la laisser déborder de l'écran.
pub fn redimensionner(fenetre: &WebviewWindow, taille: u32) {
    if taille == ECRAN {
        remplir_ecran(fenetre);
        return;
    }
    let _ = fenetre.set_size(LogicalSize::new(taille, taille));
    garder_visible(fenetre);
}

/// Plus grand carré que laisse la zone utile de l'écran de la fenêtre, centré sur celle-ci.
fn remplir_ecran(fenetre: &WebviewWindow) {
    let Some(ecran) = fenetre.current_monitor().ok().flatten().or_else(|| fenetre.primary_monitor().ok().flatten())
    else {
        return;
    };
    let zone = ecran.work_area();
    let cote = zone.size.width.min(zone.size.height);
    let _ = fenetre.set_size(PhysicalSize::new(cote, cote));
    let _ = fenetre.set_position(PhysicalPosition::new(
        zone.position.x + (zone.size.width - cote) as i32 / 2,
        zone.position.y + (zone.size.height - cote) as i32 / 2,
    ));
}

/// Retient la position courante de la fenêtre et écrit les réglages.
pub fn enregistrer(app: &AppHandle) {
    let mut reglages = lire(app);
    if let Some(p) = app.get_webview_window("main").and_then(|f| f.outer_position().ok()) {
        reglages.position = Some((p.x, p.y));
    }
    ecrire(app, &reglages);
}

/// Taille choisie dans le menu de l'icône ou dans ⚙ : la fenêtre grandit, le frontend suit par l'événement
/// `resize` et coche la bonne case de ⚙ grâce à l'événement `taille`.
pub fn appliquer_taille(app: &AppHandle, taille: u32) {
    if let Some(etat) = app.try_state::<EtatReglages>() {
        for (case, cote) in etat.menu.tailles.iter().zip(TAILLES) {
            let _ = case.set_checked(cote == taille);
        }
        etat.reglages.lock().unwrap().taille = Some(taille);
    }
    if let Some(fenetre) = app.get_webview_window("main") {
        redimensionner(&fenetre, taille);
    }
    let mut reglages = lire(app);
    reglages.taille = Some(taille);
    ecrire(app, &reglages);
    enregistrer(app);
    let _ = app.emit("taille", taille);
}

#[tauri::command]
pub fn regler_taille(app: AppHandle, taille: u32) -> u32 {
    if !TAILLES.contains(&taille) {
        return lire(&app).taille_effective();
    }
    appliquer_taille(&app, taille);
    taille
}

/// Son allumé ou coupé dans le menu de l'icône : le jeu suit par l'événement `son`.
pub fn appliquer_son(app: &AppHandle, son: bool) {
    noter_son(app, son);
    let _ = app.emit("son", son);
}

fn noter_son(app: &AppHandle, son: bool) {
    let etat = app.state::<EtatReglages>();
    let _ = etat.menu.son.set_checked(son);
    etat.reglages.lock().unwrap().son = son;
    let mut reglages = lire(app);
    reglages.son = son;
    ecrire(app, &reglages);
}

/// Son réglé dans ⚙ (ou au lancement, depuis le choix gardé par le jeu) : le menu de l'icône suit.
#[tauri::command]
pub fn regler_son(app: AppHandle, son: bool) {
    noter_son(&app, son);
}

/// Taille retenue, pour cocher la bonne case du menu au lancement.
#[tauri::command]
pub fn taille_actuelle(app: AppHandle) -> u32 {
    lire(&app).taille_effective()
}

/// Quitter depuis le menu du jeu : la fenêtre n'a ni cadre ni bouton de fermeture.
#[tauri::command]
pub fn quitter(app: AppHandle) {
    crate::sortir(&app);
}
