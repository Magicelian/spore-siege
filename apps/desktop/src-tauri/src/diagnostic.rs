//! Journal de diagnostic de l'appli installée (où `eprintln!` ne va nulle part) :
//! `~/Library/Logs/fr.magicelian.sporesiege/journal.log`. Sert à comprendre pourquoi l'icône de la barre des menus
//! cesse parfois de répondre après une longue absence : clics reçus, fenêtre montrée ou cachée, fil principal bloqué.

use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::mpsc;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Manager};

/// Au-delà, le journal repart de zéro.
const TAILLE_MAX: u64 = 512 * 1024;
/// Le fil principal est sondé à cet intervalle…
const INTERVALLE_SONDE: Duration = Duration::from_secs(10);
/// … et noté bloqué s'il ne répond pas dans ce délai.
const DELAI_BLOCAGE: Duration = Duration::from_secs(3);

pub fn ecrire(app: &AppHandle, message: &str) {
    let Ok(dossier) = app.path().app_log_dir() else {
        return;
    };
    let _ = fs::create_dir_all(&dossier);
    let chemin = dossier.join("journal.log");
    let trop_gros = fs::metadata(&chemin).is_ok_and(|m| m.len() > TAILLE_MAX);
    let fichier = OpenOptions::new().create(true).append(!trop_gros).write(true).truncate(trop_gros).open(&chemin);
    if let Ok(mut fichier) = fichier {
        let secondes = SystemTime::now().duration_since(UNIX_EPOCH).map_or(0, |d| d.as_secs());
        let _ = writeln!(fichier, "{} {} {message}", horodatage(secondes), app.package_info().version);
    }
}

/// Date et heure UTC lisibles, sans dépendance.
fn horodatage(secondes: u64) -> String {
    let (jours, reste) = (secondes / 86_400, secondes % 86_400);
    // Algorithme de Howard Hinnant (jours depuis 1970 → date civile).
    let z = jours as i64 + 719_468;
    let ere = z.div_euclid(146_097);
    let jde = z - ere * 146_097;
    let ade = (jde - jde / 1_460 + jde / 36_524 - jde / 146_096) / 365;
    let jda = jde - (365 * ade + ade / 4 - ade / 100);
    let mp = (5 * jda + 2) / 153;
    let jour = jda - (153 * mp + 2) / 5 + 1;
    let mois = if mp < 10 { mp + 3 } else { mp - 9 };
    let annee = ade + ere * 400 + i64::from(mois <= 2);
    format!("{annee:04}-{mois:02}-{jour:02} {:02}:{:02}:{:02}Z", reste / 3_600, reste % 3_600 / 60, reste % 60)
}

/// Sonde le fil principal ; note quand il ne répond plus, et combien de temps il est resté bloqué.
pub fn surveiller_fil_principal(app: AppHandle) {
    ecrire(&app, "démarrage");
    std::thread::spawn(move || loop {
        std::thread::sleep(INTERVALLE_SONDE);
        let (envoi, reception) = mpsc::channel();
        let depart = Instant::now();
        if app.run_on_main_thread(move || {
            let _ = envoi.send(());
        }).is_err() {
            return;
        }
        if reception.recv_timeout(DELAI_BLOCAGE).is_ok() {
            continue;
        }
        ecrire(&app, "fil principal bloqué (> 3 s)");
        match reception.recv() {
            Ok(()) => ecrire(&app, &format!("fil principal débloqué après {:.1} s", depart.elapsed().as_secs_f64())),
            Err(_) => return,
        }
    });
}
