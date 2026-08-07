use crate::models::model::LocalModel;
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Get the models directory path, creating it if it doesn't exist.
fn models_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let dir = data_dir.join("models");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

/// Load all local model metadata from the models directory.
pub fn load_all(app: &tauri::AppHandle) -> Vec<LocalModel> {
    let dir = match models_dir(app) {
        Ok(d) => d,
        Err(_) => return Vec::new(),
    };

    let mut models = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(model) = serde_json::from_str::<LocalModel>(&content) {
                        models.push(model);
                    }
                }
            }
        }
    }
    models
}

/// Load a single model metadata by its ID.
pub fn load(app: &tauri::AppHandle, id: &str) -> Option<LocalModel> {
    let dir = models_dir(app).ok()?;
    let path = dir.join(format!("model-{}.json", id));
    let content = fs::read_to_string(path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Save a model's metadata to disk.
pub fn save(app: &tauri::AppHandle, model: &LocalModel) -> Result<(), String> {
    let dir = models_dir(app)?;
    let path = dir.join(format!("model-{}.json", model.id));
    let content = serde_json::to_string_pretty(model).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}

/// Delete a model's metadata by its ID.
pub fn delete(app: &tauri::AppHandle, id: &str) -> Result<(), String> {
    let dir = models_dir(app)?;
    let path = dir.join(format!("model-{}.json", id));
    if path.exists() {
        fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}