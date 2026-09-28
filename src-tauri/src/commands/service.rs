use crate::models::service::{ServiceConfig, ServiceStatusInfo};
use crate::sidecar::manager::ServiceManager;
use crate::storage::{service_store, settings_store};
use chrono::Local;
use std::collections::HashMap;
use tauri::{AppHandle, State};
use uuid::Uuid;

/// List all saved service configurations.
#[tauri::command]
pub fn list_services(app: tauri::AppHandle) -> Vec<ServiceConfig> {
    service_store::load_all(&app)
}

/// Get a single service configuration by ID.
#[tauri::command]
pub fn get_service(app: tauri::AppHandle, id: String) -> Result<ServiceConfig, String> {
    service_store::load(&app, &id).ok_or_else(|| format!("服务 {} 未找到", id))
}

/// Create a new service configuration.
#[tauri::command]
pub fn create_service(
    app: tauri::AppHandle,
    name: String,
    model_path: String,
    parameters: HashMap<String, serde_json::Value>,
) -> Result<ServiceConfig, String> {
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let config = ServiceConfig {
        id: Uuid::new_v4().to_string(),
        name,
        model_path,
        parameters,
        created_at: now.clone(),
        updated_at: now,
        last_started_at: None,
    };
    service_store::save(&app, &config)?;
    Ok(config)
}

/// Update an existing service configuration.
#[tauri::command]
pub fn update_service(
    app: tauri::AppHandle,
    id: String,
    name: String,
    model_path: String,
    parameters: HashMap<String, serde_json::Value>,
) -> Result<ServiceConfig, String> {
    let mut config = service_store::load(&app, &id).ok_or_else(|| format!("服务 {} 未找到", id))?;
    let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    config.name = name;
    config.model_path = model_path;
    config.parameters = parameters;
    config.updated_at = now;
    service_store::save(&app, &config)?;
    Ok(config)
}

/// Delete a service configuration by ID.
#[tauri::command]
pub fn delete_service(app: tauri::AppHandle, id: String) -> Result<(), String> {
    service_store::delete(&app, &id)
}

/// Start a service by its configuration ID.
#[tauri::command]
pub fn start_service(
    app: tauri::AppHandle,
    manager: State<'_, ServiceManager>,
    id: String,
) -> Result<(), String> {
    let config = service_store::load(&app, &id).ok_or_else(|| format!("服务 {} 未找到", id))?;

    // Load settings to get the llama-server path
    let settings = settings_store::load(&app);
    let server_path = settings.llama_server_path.as_deref().filter(|p| !p.is_empty());

    manager.start(&config, &app, server_path)?;

    // Persist the last_started_at timestamp
    let mut updated = config;
    updated.last_started_at = Some(Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
    let _ = service_store::save(&app, &updated);

    Ok(())
}

/// Stop the currently running service.
#[tauri::command]
pub fn stop_service(app: AppHandle, manager: State<'_, ServiceManager>) -> Result<(), String> {
    manager.stop(&app)
}

/// Restart a service: stop current, then start with the given configuration.
#[tauri::command]
pub fn restart_service(
    app: AppHandle,
    manager: State<'_, ServiceManager>,
    id: String,
) -> Result<(), String> {
    // Ignore stop error if no service is running
    let _ = manager.stop(&app);

    let config = service_store::load(&app, &id).ok_or_else(|| format!("服务 {} 未找到", id))?;

    // Load settings to get the llama-server path
    let settings = settings_store::load(&app);
    let server_path = settings.llama_server_path.as_deref().filter(|p| !p.is_empty());

    manager.start(&config, &app, server_path)?;

    // Persist the last_started_at timestamp
    let mut updated = config;
    updated.last_started_at = Some(Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
    let _ = service_store::save(&app, &updated);

    Ok(())
}

/// Get the status of a single service.
///
/// The manager only tracks one process at a time, so only the service that
/// owns it reports a live status. Every other service is reported as stopped,
/// otherwise the UI would mark all cards as running.
#[tauri::command]
pub fn get_service_status(manager: State<'_, ServiceManager>, id: String) -> ServiceStatusInfo {
    let status = manager.get_status();

    if status.service_id.as_deref() == Some(id.as_str()) {
        ServiceStatusInfo {
            id: status.service_id,
            status: status.status,
            model_name: status.service_name,
            pid: status.pid,
            port: status.port,
            started_at: status.started_at,
            error_message: status.error_message,
        }
    } else {
        ServiceStatusInfo {
            id: Some(id),
            status: "stopped".to_string(),
            model_name: None,
            pid: None,
            port: None,
            started_at: None,
            error_message: None,
        }
    }
}

/// Get the accumulated logs from the currently running service.
#[tauri::command]
pub fn get_service_logs(manager: State<'_, ServiceManager>) -> Vec<String> {
    manager.get_logs()
}