mod commands;
mod config;
mod error;
mod state;

use crate::config::AppConfig;
use crate::state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let cfg = AppConfig::from_env_and_args();
    let app_state = AppState::new(cfg);

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            commands::serial::get_serial_ports,
            commands::serial::open_serial,
            commands::serial::write_serial,
            commands::serial::close_serial,
            commands::storage::save_data_point,
            commands::storage::query_data,
            commands::version::get_version_info,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
