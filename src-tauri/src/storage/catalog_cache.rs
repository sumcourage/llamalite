use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

/// Cached GGUF file info for a single repository.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedRepoInfo {
    /// Whether the repo exists and contains GGUF files.
    pub valid: bool,
    /// List of GGUF files with sizes.
    pub gguf_files: Vec<CachedGgufFile>,
    /// If the actual repo ID differs (e.g. -GGUF variant was used).
    pub actual_repo_id: Option<String>,
    /// Error message if invalid.
    pub error: Option<String>,
    /// Timestamp when this entry was last validated (Unix epoch seconds).
    pub checked_at: u64,
}

/// A single GGUF file entry in the cache.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedGgufFile {
    pub filename: String,
    pub size: Option<u64>,
}

/// The full catalog cache structure.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogCache {
    /// Map of repo_id -> CachedRepoInfo
    pub repos: std::collections::HashMap<String, CachedRepoInfo>,
    /// When the entire cache was last refreshed (Unix epoch seconds).
    pub refreshed_at: u64,
}

impl Default for CatalogCache {
    fn default() -> Self {
        Self {
            repos: std::collections::HashMap::new(),
            refreshed_at: 0,
        }
    }
}

/// Get the cache file path.
fn cache_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&data_dir).map_err(|e| e.to_string())?;
    Ok(data_dir.join("catalog_cache.json"))
}

/// Load the catalog cache from disk. Returns default if not found.
pub fn load(app: &tauri::AppHandle) -> CatalogCache {
    let path = match cache_file_path(app) {
        Ok(p) => p,
        Err(_) => return CatalogCache::default(),
    };

    if !path.exists() {
        return CatalogCache::default();
    }

    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => CatalogCache::default(),
    }
}

/// Save the catalog cache to disk.
pub fn save(app: &tauri::AppHandle, cache: &CatalogCache) -> Result<(), String> {
    let path = cache_file_path(app)?;
    let content = serde_json::to_string_pretty(cache).map_err(|e| e.to_string())?;
    fs::write(path, content).map_err(|e| e.to_string())
}
