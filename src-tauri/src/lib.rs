mod commands;
mod models;
mod sidecar;
mod storage;

use commands::python::PythonDownloadState;
use sidecar::manager::ServiceManager;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent,
};

/// Application entry point for Llamalite.
///
/// Registers all Tauri plugins (shell, dialog, fs), manages shared state
/// (ServiceManager, PythonDownloadState), registers all command handlers,
/// and sets up the system tray icon with show/hide/quit menu.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // === Plugins ===
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // === Managed State ===
        .manage(ServiceManager::new())
        .manage(PythonDownloadState::new())
        // === Command Handlers ===
        .invoke_handler(tauri::generate_handler![
            // Service commands
            commands::service::list_services,
            commands::service::get_service,
            commands::service::create_service,
            commands::service::update_service,
            commands::service::delete_service,
            commands::service::start_service,
            commands::service::stop_service,
            commands::service::restart_service,
            commands::service::get_service_status,
            commands::service::get_service_logs,
            // Model commands
            commands::model::list_local_models,
            commands::model::delete_model,
            commands::model::start_download,
            commands::model::cancel_download,
            commands::model::delete_paused_download,
            commands::model::search_hf_models,
            commands::model::list_repo_files,
            commands::model::refresh_model_catalog,
            commands::model::get_cached_catalog,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::update_settings,
            // Hardware commands
            commands::hardware::detect_hardware,
            commands::hardware::get_recommendations,
            // Environment check commands
            commands::environment::check_environment,
            commands::environment::check_executable_path,
        ])
        // === System Tray ===
        .setup(|app| {
            // Build tray menu
            let show_item = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let hide_item = MenuItem::with_id(app, "hide", "隐藏窗口", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &hide_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .tooltip("Llamalite - LLM 服务管理器")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "hide" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.hide();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    // Double-click tray icon to show/hide window
                    if let TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            if window.is_visible().unwrap_or(false) {
                                let _ = window.hide();
                            } else {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        // === Intercept window close: hide instead of close ===
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                // Prevent the window from actually closing; hide it instead
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .build(tauri::generate_context!())
        .expect("启动 Llamalite 失败")
        .run(|_app_handle, _event| {});
}