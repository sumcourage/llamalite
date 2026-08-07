use crate::models::service::ServiceConfig;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Get the services directory path, creating it if it doesn't exist.
fn services_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = data_dir.join("services");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Load all service configurations from the services directory.
pub fn load_all(app: &tauri::AppHandle) -> Vec<ServiceConfig> {
    let dir = match services_dir(app) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    let mut services = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(config) = serde_json::from_str::<ServiceConfig>(&content) {
                        services.push(config);
                    }
                }
            }
        }
    }
    services
}

/// Load a single service configuration by its ID.
pub fn load(app: &tauri::AppHandle, id: &str) -> Option<ServiceConfig> {
    let dir = services_dir(app).ok()?;
    let path = dir.join(format!("service-{}.json", id));
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Save a service configuration to disk.
pub fn save(app: &tauri::AppHandle, config: &ServiceConfig) -> Result<(), String> {
    let dir = services_dir(app)?;
    let path = dir.join(format!("service-{}.json", config.id));
    let content = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

/// Delete a service configuration by its ID.
pub fn delete(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let dir = services_dir(app)?;
    let path = dir.join(format!("service-{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}