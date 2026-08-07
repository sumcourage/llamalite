use crate::models::service::ServiceConfig;
use chrono::Local;
use serde::Deserialize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// Search for an executable in the system PATH.
///
/// Tries `name` and `name.exe` (Windows). Returns the full path if found.
fn find_in_path(name: &str) -> Option<String> {
    let path_var = std::env::var("PATH").ok()?;

    for dir in std::env::split_paths(&path_var) {
        if dir.as_os_str().is_empty() {
            continue;
        }
        // On Windows, also try with .exe extension
        let candidates = if cfg!(windows) {
            let with_exe = dir.join(format!("{}.exe", name));
            let without_ext = dir.join(name);
            vec![with_exe, without_ext]
        } else {
            vec![dir.join(name)]
        };

        for candidate in &candidates {
            if candidate.is_file() {
                return candidate.to_str().map(|s| s.to_string());
            }
        }
    }
    None
}

/// Resolve the llama-server executable path.
///
/// Priority:
/// 1. System PATH search for `llama-server`
/// 2. User-configured `server_path` (if non-empty and file exists)
/// 3. Returns None to indicate sidecar fallback should be tried
fn resolve_server_binary(server_path: Option<&str>) -> Option<String> {
    // Step 1: Search PATH
    if let Some(path) = find_in_path("llama-server") {
        return Some(path);
    }

    // Step 2: Fall back to configured path
    if let Some(path) = server_path.filter(|p| !p.is_empty()) {
        let p = Path::new(path);
        if p.is_file() {
            return Some(path.to_string());
        }
    }

    None
}

/// Represents the current status of a managed service process.
#[derive(Debug, Clone, serde::Serialize, Deserialize)]
pub struct ServiceStatus {
    pub status: String, // "stopped", "running", "starting", "stopping", "error"
    pub service_id: Option<String>,
    pub service_name: Option<String>,
    pub pid: Option<u32>,
    pub port: Option<u16>,
    pub started_at: Option<String>,
    pub error_message: Option<String>,
    pub logs: Vec<String>,
}

impl ServiceStatus {
    fn stopped() -> Self {
        Self {
            status: "stopped".to_string(),
            service_id: None,
            service_name: None,
            pid: None,
            port: None,
            started_at: None,
            error_message: None,
            logs: Vec::new(),
        }
    }
}

/// Manages the lifecycle of a single llama-server process.
///
/// This manager enforces a single-service constraint: only one process
/// can be running at any time. It provides methods to start, stop, query status,
/// and retrieve logs, and emits Tauri events for real-time frontend updates.
pub struct ServiceManager {
    child: Arc<Mutex<Option<tauri_plugin_shell::process::CommandChild>>>,
    status: Arc<Mutex<ServiceStatus>>,
    logs: Arc<Mutex<Vec<String>>>,
    /// Flag to indicate that the process is being intentionally stopped.
    /// When true, the Terminated handler should NOT set "error" status.
    intentional_stop: Arc<AtomicBool>,
}

impl ServiceManager {
    /// Create a new ServiceManager with no running process.
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            status: Arc::new(Mutex::new(ServiceStatus::stopped())),
            logs: Arc::new(Mutex::new(Vec::new())),
            intentional_stop: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Emit a `service-status-changed` event with the full current status.
    /// This ensures the frontend always receives a complete ServiceStatusInfo payload.
    fn emit_status_event(&self, app: &AppHandle) {
        let status = self.status.lock().unwrap().clone();
        let _ = app.emit(
            "service-status-changed",
            serde_json::json!({
                "id": status.service_id,
                "status": status.status,
                "modelName": status.service_name,
                "port": status.port,
                "pid": status.pid,
                "startedAt": status.started_at,
                "errorMessage": status.error_message,
            }),
        );
    }

    /// Start the llama-server process with the given service configuration.
    ///
    /// Uses the provided `server_path` if set, otherwise falls back to the
    /// bundled sidecar. Serializes parameters into CLI flags, spawns the
    /// process, and begins capturing stdout/stderr. Emits
    /// `service-log` and `service-status-changed` events.
    pub fn start(
        &self,
        config: &ServiceConfig,
        app: &AppHandle,
        server_path: Option<&str>,
    ) -> Result<(), String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        if child_guard.is_some() {
            return Err("服务已在运行中，请先停止当前服务".to_string());
        }

        // Resolve the llama-server binary: PATH > configured path > sidecar
        let shell = app.shell();
        let resolved = resolve_server_binary(server_path);

        let mut command = if let Some(ref bin_path) = resolved {
            shell.command(bin_path)
        } else {
            // Last resort: try Tauri sidecar (requires bundled binary)
            shell.sidecar("llama-server").map_err(|e| {
                let base = e.to_string();
                // Check for "file not found" errors across platforms:
                // Windows: "系统找不到指定的文件" or "os error 2"
                // macOS/Linux: "os error 2" or "No such file or directory"
                let is_not_found = base.contains("os error 2")
                    || base.contains("No such file or directory")
                    || base.contains("系统找不到指定的文件");
                if is_not_found {
                    "未找到 llama-server。请确认已安装并将 llama-server 所在目录添加到系统 PATH，或在「设置」中配置路径。\n\
                     下载地址: https://github.com/ggml-org/llama.cpp/releases".to_string()
                } else {
                    format!("启动失败: {}", base)
                }
            })?
        };

        // Add model path argument
        command = command.arg("--model").arg(&config.model_path);

        // Parse remaining parameters into CLI args
        let args = self.build_args(config);
        for arg in args {
            command = command.arg(arg);
        }

        // Spawn the process
        let (mut rx, child) = command.spawn().map_err(|e| {
            let err_msg = e.to_string();
            let is_not_found = err_msg.contains("os error 2")
                || err_msg.contains("No such file or directory")
                || err_msg.contains("系统找不到指定的文件");
            let msg = if is_not_found {
                "启动失败：未找到 llama-server。\n\
                 请确认 llama-server 已安装，并将其所在目录添加到系统 PATH。\n\
                 下载地址: https://github.com/ggml-org/llama.cpp/releases\n\
                 也可在「设置」页面手动配置 llama-server 路径。"
                    .to_string()
            } else {
                format!("启动进程失败: {}", err_msg)
            };
            let mut status = self.status.lock().unwrap();
            status.status = "error".to_string();
            status.error_message = Some(msg.clone());
            msg
        })?;

        *child_guard = Some(child);

        // Update status to running
        let now = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
        {
            let mut status = self.status.lock().map_err(|e| e.to_string())?;
            status.status = "running".to_string();
            status.service_id = Some(config.id.clone());
            status.service_name = Some(config.name.clone());
            status.started_at = Some(now.clone());
            status.error_message = None;

            // Extract port from parameters if available
            if let Some(port_val) = config.parameters.get("port") {
                if let Some(p) = port_val.as_u64() {
                    status.port = Some(p as u16);
                }
            }
        }

        // Clear logs for the new session
        {
            let mut logs = self.logs.lock().map_err(|e| e.to_string())?;
            logs.clear();
        }

        // Reset the intentional stop flag for the new process
        self.intentional_stop.store(false, Ordering::SeqCst);

        // Clone Arcs for the background task
        let app_handle = app.clone();
        let status_arc = self.status.clone();
        let logs_arc = self.logs.clone();
        let child_arc = self.child.clone();
        let intentional_stop_flag = self.intentional_stop.clone();
        let service_id = config.id.clone();

        // Spawn background task to capture stdout/stderr
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                match event {
                    CommandEvent::Stdout(bytes) => {
                        let line = String::from_utf8_lossy(&bytes);
                        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        let log = format!("[{}] {}", timestamp, line.trim());

                        let mut logs = logs_arc.lock().unwrap();
                        logs.push(log.clone());

                        let _ = app_handle.emit(
                            "service-log",
                            serde_json::json!({
                                "service_id": service_id,
                                "log": log,
                            }),
                        );
                    }
                    CommandEvent::Stderr(bytes) => {
                        let line = String::from_utf8_lossy(&bytes);
                        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        let log = format!("[{}] ERROR: {}", timestamp, line.trim());

                        let mut logs = logs_arc.lock().unwrap();
                        logs.push(log.clone());

                        let _ = app_handle.emit(
                            "service-log",
                            serde_json::json!({
                                "service_id": service_id,
                                "log": log,
                            }),
                        );
                    }
                    CommandEvent::Terminated(payload) => {
                        let full_status = {
                            let mut status = status_arc.lock().unwrap();
                            // Check if this was an intentional stop
                            let was_intentional = intentional_stop_flag.load(Ordering::SeqCst);
                            status.status = "stopped".to_string();
                            if !was_intentional {
                                // Only treat as error if the process crashed unexpectedly
                                if let Some(code) = payload.code {
                                    if code != 0 {
                                        status.error_message =
                                            Some(format!("进程异常退出，退出码: {}", code));
                                        status.status = "error".to_string();
                                    }
                                }
                            } else {
                                // Intentional stop — clear any error message
                                status.error_message = None;
                            }
                            status.clone()
                        };

                        let _ = app_handle.emit(
                            "service-status-changed",
                            serde_json::json!({
                                "id": full_status.service_id,
                                "status": full_status.status,
                                "modelName": full_status.service_name,
                                "port": full_status.port,
                                "pid": full_status.pid,
                                "startedAt": full_status.started_at,
                                "errorMessage": full_status.error_message,
                            }),
                        );

                        let mut child = child_arc.lock().unwrap();
                        *child = None;
                    }
                    CommandEvent::Error(err) => {
                        let log = format!("[{}] SYSTEM ERROR: {}", 
                            Local::now().format("%Y-%m-%d %H:%M:%S").to_string(),
                            err
                        );
                        let mut logs = logs_arc.lock().unwrap();
                        logs.push(log.clone());

                        let _ = app_handle.emit(
                            "service-log",
                            serde_json::json!({
                                "service_id": service_id,
                                "log": log,
                            }),
                        );
                    }
                    _ => {}
                }
            }
        });

        // Emit full status change event
        self.emit_status_event(app);

        Ok(())
    }

    /// Stop the currently running process.
    ///
    /// Kills the process and resets the status to "stopped". Returns an error
    /// if no service is running. Emits a status event so the frontend is notified.
    pub fn stop(&self, app: &AppHandle) -> Result<(), String> {
        let mut child_guard = self.child.lock().map_err(|e| e.to_string())?;
        if let Some(child) = child_guard.take() {
            // Mark as intentional stop so Terminated handler won't set "error"
            self.intentional_stop.store(true, Ordering::SeqCst);

            child.kill().map_err(|e| format!("终止进程失败: {}", e))?;

            {
                let mut status = self.status.lock().map_err(|e| e.to_string())?;
                status.status = "stopped".to_string();
                status.service_id = None;
                status.service_name = None;
                status.pid = None;
                status.port = None;
                status.started_at = None;
                status.error_message = None;
            }

            // Emit status event so frontend knows the service stopped
            self.emit_status_event(app);

            Ok(())
        } else {
            Err("没有正在运行的服务".to_string())
        }
    }

    /// Get the current service status.
    pub fn get_status(&self) -> ServiceStatus {
        self.status
            .lock()
            .map(|s| s.clone())
            .unwrap_or(ServiceStatus::stopped())
    }

    /// Get a copy of the accumulated logs.
    pub fn get_logs(&self) -> Vec<String> {
        self.logs.lock().map(|l| l.clone()).unwrap_or_default()
    }

    /// Convert the service configuration parameters into CLI argument strings.
    ///
    /// Parameter keys with underscores are converted to hyphens for CLI flag
    /// compatibility (e.g., `ctx_size` becomes `--ctx-size`).
    ///
    /// Deprecated parameters are automatically remapped to their new names:
    /// - `draft-max` → `spec-draft-n-max`
    ///
    /// Removed parameters (no replacement) are silently skipped:
    /// - `draft-min`, `draft-p-min`
    fn build_args(&self, config: &ServiceConfig) -> Vec<String> {
        // Remap deprecated parameter names to their replacements.
        // Returns None for parameters that have been removed entirely.
        fn remap_param(k: &str) -> Option<&str> {
            match k {
                "draft-max" | "draft_max" => Some("spec-draft-n-max"),
                // These have been removed with no replacement
                "draft-min" | "draft_min" => None,
                "draft-p-min" | "draft_p_min" => None,
                // Draft-specific parameters removed in recent llama.cpp versions
                "ctx-size-draft" | "ctx_size_draft" => None,
                "device-draft" | "device_draft" => None,
                "gpu-layers-draft" | "gpu_layers_draft" => None,
                // Renamed: --parallel-slots → --parallel
                "parallel-slots" | "parallel_slots" => Some("parallel"),
                // Renamed: --mirostat-eta → --mirostat-lr
                "mirostat-eta" | "mirostat_eta" => Some("mirostat-lr"),
                // Removed: --mirostat-tau (no replacement in latest llama.cpp)
                "mirostat-tau" | "mirostat_tau" => None,
                // Removed: --defrag-thold (deprecated in latest llama.cpp)
                "defrag-thold" | "defrag_thold" => None,
                _ => Some(k),
            }
        }

        let mut args = Vec::new();
        for (key, value) in &config.parameters {
            // Skip "port" as it is handled via --port flag separately if needed
            if key == "port" {
                if let Some(p) = value.as_u64() {
                    args.push("--port".to_string());
                    args.push(p.to_string());
                }
                continue;
            }

            // Skip "model" as it is already added explicitly via command.arg("--model")
            if key == "model" || key == "model_path" {
                continue;
            }

            // Apply deprecated parameter remapping
            let effective_key = match remap_param(key) {
                Some(k) => k,
                None => continue, // Parameter removed, skip
            };

            let flag = format!("--{}", effective_key.replace('_', "-"));
            match value {
                serde_json::Value::String(s) => {
                    args.push(flag);
                    args.push(s.clone());
                }
                serde_json::Value::Number(n) => {
                    args.push(flag);
                    args.push(n.to_string());
                }
                serde_json::Value::Bool(b) => {
                    if *b {
                        args.push(flag);
                    }
                }
                serde_json::Value::Array(arr) => {
                    for item in arr {
                        if let Some(s) = item.as_str() {
                            args.push(flag.clone());
                            args.push(s.to_string());
                        }
                    }
                }
                _ => {
                    args.push(flag);
                    args.push(value.to_string());
                }
            }
        }
        args
    }
}

impl Default for ServiceManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_service_manager_new_creates_stopped_manager() {
        let manager = ServiceManager::new();
        let status = manager.get_status();
        assert_eq!(status.status, "stopped");
        assert!(status.service_id.is_none());
        assert!(status.service_name.is_none());
        assert!(status.pid.is_none());
        assert!(status.port.is_none());
        assert!(status.started_at.is_none());
        assert!(status.error_message.is_none());
    }

    #[test]
    fn test_service_status_stopped_returns_correct_state() {
        let status = ServiceStatus::stopped();
        assert_eq!(status.status, "stopped");
        assert!(status.service_id.is_none());
        assert!(status.service_name.is_none());
        assert!(status.pid.is_none());
        assert!(status.port.is_none());
        assert!(status.started_at.is_none());
        assert!(status.error_message.is_none());
        assert!(status.logs.is_empty());
    }

    #[test]
    fn test_build_args_empty_params() {
        let manager = ServiceManager::new();
        let config = ServiceConfig {
            id: "test".to_string(),
            name: "test".to_string(),
            model_path: "/test.gguf".to_string(),
            parameters: HashMap::new(),
            created_at: "".to_string(),
            updated_at: "".to_string(),
            last_started_at: None,
        };
        let args = manager.build_args(&config);
        assert!(args.is_empty(), "Empty parameters should produce empty args");
    }

    #[test]
    fn test_build_args_port_parameter() {
        let manager = ServiceManager::new();
        let mut params = HashMap::new();
        params.insert("port".to_string(), serde_json::json!(8080));
        let config = ServiceConfig {
            id: "test".to_string(),
            name: "test".to_string(),
            model_path: "/test.gguf".to_string(),
            parameters: params,
            created_at: "".to_string(),
            updated_at: "".to_string(),
            last_started_at: None,
        };
        let args = manager.build_args(&config);
        assert_eq!(args, vec!["--port", "8080"]);
    }

    #[test]
    fn test_build_args_boolean_flags() {
        let manager = ServiceManager::new();
        let mut params = HashMap::new();
        params.insert("verbose".to_string(), serde_json::json!(true));
        params.insert("no_kv_offload".to_string(), serde_json::json!(true));
        let config = ServiceConfig {
            id: "test".to_string(),
            name: "test".to_string(),
            model_path: "/test.gguf".to_string(),
            parameters: params,
            created_at: "".to_string(),
            updated_at: "".to_string(),
            last_started_at: None,
        };
        let args = manager.build_args(&config);
        // Boolean true flags should be present (with underscores converted to hyphens)
        assert!(args.contains(&"--verbose".to_string()));
        assert!(args.contains(&"--no-kv-offload".to_string()));

        // Boolean false should be omitted
        let mut false_params = HashMap::new();
        false_params.insert("verbose".to_string(), serde_json::json!(false));
        let false_config = ServiceConfig {
            id: "test".to_string(),
            name: "test".to_string(),
            model_path: "/test.gguf".to_string(),
            parameters: false_params,
            created_at: "".to_string(),
            updated_at: "".to_string(),
            last_started_at: None,
        };
        let args_false = manager.build_args(&false_config);
        assert!(
            !args_false.contains(&"--verbose".to_string()),
            "Boolean false should not produce a flag"
        );
    }

    #[test]
    fn test_build_args_string_and_number_params() {
        let manager = ServiceManager::new();
        let mut params = HashMap::new();
        params.insert("ctx_size".to_string(), serde_json::json!(2048));
        params.insert("model".to_string(), serde_json::json!("test-model"));
        let config = ServiceConfig {
            id: "test".to_string(),
            name: "test".to_string(),
            model_path: "/test.gguf".to_string(),
            parameters: params,
            created_at: "".to_string(),
            updated_at: "".to_string(),
            last_started_at: None,
        };
        let args = manager.build_args(&config);
        // ctx_size should become --ctx-size (underscore to hyphen)
        assert!(args.contains(&"--ctx-size".to_string()));
        assert!(args.contains(&"2048".to_string()));
        // String parameter
        assert!(args.contains(&"--model".to_string()));
        assert!(args.contains(&"test-model".to_string()));
    }

    #[test]
    fn test_build_args_array_parameters() {
        let manager = ServiceManager::new();
        let mut params = HashMap::new();
        params.insert(
            "embedding".to_string(),
            serde_json::json!(["model1", "model2"]),
        );
        let config = ServiceConfig {
            id: "test".to_string(),
            name: "test".to_string(),
            model_path: "/test.gguf".to_string(),
            parameters: params,
            created_at: "".to_string(),
            updated_at: "".to_string(),
            last_started_at: None,
        };
        let args = manager.build_args(&config);
        // Array parameters should produce repeated flags
        let count = args.iter().filter(|&a| a == "--embedding").count();
        assert_eq!(count, 2, "Array params should produce repeated flags");
        assert!(args.contains(&"model1".to_string()));
        assert!(args.contains(&"model2".to_string()));
    }

    #[test]
    fn test_build_args_underscore_to_hyphen_conversion() {
        let manager = ServiceManager::new();
        let mut params = HashMap::new();
        params.insert("no_kv_offload".to_string(), serde_json::json!(true));
        params.insert("mlock".to_string(), serde_json::json!(true));
        let config = ServiceConfig {
            id: "test".to_string(),
            name: "test".to_string(),
            model_path: "/test.gguf".to_string(),
            parameters: params,
            created_at: "".to_string(),
            updated_at: "".to_string(),
            last_started_at: None,
        };
        let args = manager.build_args(&config);
        // Underscores should be converted to hyphens
        assert!(
            args.contains(&"--no-kv-offload".to_string()),
            "Underscores should be converted to hyphens"
        );
        // mlock has no underscores, should stay as --mlock
        assert!(args.contains(&"--mlock".to_string()));
    }

    #[test]
    fn test_get_status_returns_stopped_when_no_service() {
        let manager = ServiceManager::new();
        let status = manager.get_status();
        assert_eq!(status.status, "stopped");
    }

    #[test]
    fn test_get_logs_returns_empty_vec_when_no_logs() {
        let manager = ServiceManager::new();
        let logs = manager.get_logs();
        assert!(logs.is_empty(), "New manager should have no logs");
    }
}