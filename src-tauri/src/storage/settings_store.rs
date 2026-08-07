use crate::models::settings::AppSettings;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Get the config.json file path, creating the parent directory if needed.
fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    Ok(data_dir.join("config.json"))
}

/// Load application settings from config.json, returning defaults if not found.
pub fn load(app: &tauri::AppHandle) -> AppSettings {
    let path = match config_path(app) {
        Ok(p) => p,
        Err(_) => return AppSettings::default(),
    };

    fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default()
}

/// Save application settings to config.json.
pub fn save(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = config_path(app)?;
    let content = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}