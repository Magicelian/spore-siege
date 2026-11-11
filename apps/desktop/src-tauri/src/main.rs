// Fenêtre de jeu : une île qui flotte par-dessus les applications, sans cadre ni fond, comme Tiny Shrooms.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod reglages;

use tauri::{Manager, RunEvent};

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let lus = reglages::lire(app.handle());
            if let Some(fenetre) = app.get_webview_window("main") {
                reglages::redimensionner(&fenetre, lus.taille_effective());
                reglages::restaurer_position(&fenetre, &lus);
                let _ = fenetre.show();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![reglages::regler_taille, reglages::taille_actuelle, reglages::quitter])
        .build(tauri::generate_context!())
        .expect("échec du lancement de Spore Siege")
        .run(|app, evenement| {
            // Cmd+Q ou fermeture : on retient où était la fenêtre.
            if let RunEvent::ExitRequested { .. } = evenement {
                reglages::enregistrer(app);
            }
        });
}
