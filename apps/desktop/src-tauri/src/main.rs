// Fenêtre de jeu : une île qui flotte par-dessus les applications, sans cadre ni fond, comme Tiny Shrooms.
// Icône dans la barre des menus (clic gauche : montrer ou cacher la fenêtre ; clic droit : menu), mises à jour
// automatiques.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod diagnostic;
mod icone;
mod mises_a_jour;
mod pastille;
mod pouls;
mod reglages;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu},
    AppHandle, Emitter, Manager, RunEvent,
};

/// Messages du frontend recopiés dans le terminal de `pnpm dev`, pour mesurer dans la vraie fenêtre.
#[tauri::command]
fn journal(message: String) {
    println!("[jeu] {message}");
}

/// Cache ou affiche la fenêtre.
fn basculer_fenetre(app: &AppHandle) {
    let Some(fenetre) = app.get_webview_window("main") else {
        return;
    };
    if fenetre.is_visible().unwrap_or(false) {
        diagnostic::ecrire(app, "fenêtre cachée");
        // Fenêtre cachée : le jeu coupe son et musique (sans toucher au réglage Son). Prévenu avant, comme Tiny Shrooms.
        let _ = app.emit("visible", false);
        let _ = fenetre.hide();
    } else {
        afficher_fenetre(app);
    }
}

fn afficher_fenetre(app: &AppHandle) {
    let Some(fenetre) = app.get_webview_window("main") else {
        return;
    };
    diagnostic::ecrire(app, "fenêtre montrée");
    let _ = fenetre.show();
    let _ = fenetre.set_focus();
    let _ = app.emit("visible", true);
}

/// Dernière étape : position retenue, puis mise à jour installée si elle a été demandée (la partie n'a rien à
/// écrire : étoiles et monstres découverts sont déjà dans le stockage du jeu).
pub fn sortir(app: &AppHandle) {
    reglages::enregistrer(app);
    mises_a_jour::installer_si_demande(app);
    app.exit(0);
}

fn main() {
    let builder = tauri::Builder::default();
    // Windows : un second lancement ramène la fenêtre du premier (macOS ne lance jamais deux fois une application).
    #[cfg(not(target_os = "macos"))]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _, _| afficher_fenetre(app)));
    builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .on_window_event(|fenetre, evenement| {
            // Alt + F4 sous Windows : même sortie que depuis le menu.
            if let tauri::WindowEvent::CloseRequested { api, .. } = evenement {
                api.prevent_close();
                sortir(fenetre.app_handle());
            }
        })
        .manage(mises_a_jour::EtatMiseAJour::default())
        .setup(|app| {
            // Pas d'icône dans le Dock : l'application vit dans la barre des menus, comme Tiny Shrooms.
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let lus = reglages::lire(app.handle());
            let entree = |id: &str, texte: &str| MenuItem::with_id(app, id, texte, true, None::<&str>);
            let case = |id: &str, texte: &str| CheckMenuItem::with_id(app, id, texte, true, false, None::<&str>);
            let tailles = reglages::TAILLES
                .iter()
                .zip(reglages::NOMS_TAILLES)
                .map(|(cote, nom)| case(&format!("taille-{cote}"), nom))
                .collect::<Result<Vec<_>, _>>()?;
            let entrees = reglages::MenuReglages {
                basculer: entree("basculer", "Afficher / cacher la fenêtre")?,
                taille: Submenu::with_id_and_items(
                    app,
                    "taille",
                    "Taille de la fenêtre",
                    true,
                    &tailles.iter().map(|c| c as &dyn tauri::menu::IsMenuItem<_>).collect::<Vec<_>>(),
                )?,
                tailles,
                son: case("son", "Son")?,
                musique: case("musique", "Musique pendant les vagues")?,
                mettre_a_jour: entree("mettre-a-jour", "")?,
                quitter: entree("quitter", "Quitter Spore Siege")?,
            };
            reglages::preparer_menu(&entrees, &lus);
            let menu = Menu::with_items(
                app,
                &[
                    &entrees.basculer,
                    &entrees.taille,
                    &PredefinedMenuItem::separator(app)?,
                    &entrees.son,
                    &entrees.musique,
                    &PredefinedMenuItem::separator(app)?,
                    &entrees.mettre_a_jour,
                    &entrees.quitter,
                ],
            )?;
            if let Some(fenetre) = app.get_webview_window("main") {
                reglages::redimensionner(&fenetre, lus.taille_effective());
                reglages::restaurer_position(&fenetre, &lus);
                let _ = fenetre.show();
            }
            app.manage(reglages::EtatReglages { reglages: std::sync::Mutex::new(lus), menu: entrees });

            let icone = app
                .tray_by_id("main")
                .expect("l'icône de barre des menus doit être déclarée dans tauri.conf.json");
            icone.on_menu_event(|app, evenement| match evenement.id.as_ref() {
                "basculer" => basculer_fenetre(app),
                "son" => {
                    let coche = app.state::<reglages::EtatReglages>().menu.son.is_checked().unwrap_or(false);
                    reglages::appliquer_son(app, coche);
                }
                "musique" => {
                    let coche = app.state::<reglages::EtatReglages>().menu.musique.is_checked().unwrap_or(false);
                    reglages::appliquer_musique(app, coche);
                }
                taille if taille.starts_with("taille-") => {
                    if let Ok(cote) = taille["taille-".len()..].parse() {
                        reglages::appliquer_taille(app, cote);
                    }
                }
                "quitter" => sortir(app),
                "mettre-a-jour" => {
                    mises_a_jour::demander(app);
                    sortir(app);
                }
                _ => {}
            });
            icone::surveiller(app.handle().clone(), menu, basculer_fenetre);
            mises_a_jour::surveiller(app.handle().clone());
            diagnostic::surveiller_fil_principal(app.handle().clone());
            pouls::battre_le_pouls(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            reglages::regler_taille,
            reglages::taille_actuelle,
            reglages::regler_son,
            reglages::regler_musique,
            reglages::quitter,
            journal
        ])
        .build(tauri::generate_context!())
        .expect("échec du lancement de Spore Siege")
        .run(|app, evenement| {
            if let RunEvent::ExitRequested { .. } = evenement {
                reglages::enregistrer(app);
            }
        });
}
