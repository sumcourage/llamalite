use crate::models::settings::AppSettings;
use crate::storage::settings_store;

/// Get the current application settings.
#[tauri::command]
pub fn get_settings(app: tauri::AppHandle) -> AppSettings {
    settings_store::load(&app)
}

/// Update application settings.
///
/// Replaces the entire settings object with the provided values.
#[tauri::command]
pub fn update_settings(app: tauri::AppHandle, settings: AppSettings) -> Result<AppSettings, String> {
    settings_store::save(&app, &settings)?;
    Ok(settings)
}