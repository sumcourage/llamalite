use crate::models::model::LocalModel;
use crate::models::service::ServiceConfig;
use chrono::Local;
use serde::Deserialize;
use std::path::Path;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
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

/// Normalize a model path for comparison: Windows is case-insensitive and
/// paths may mix `\` and `/` separators.
fn normalize_model_path(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

/// Pick the multimodal projector (mmproj) registered for a model path.
///
/// Pure lookup so it can be unit-tested without an AppHandle.
fn pick_mmproj(models: &[LocalModel], model_path: &str) -> Option<String> {
    if model_path.trim().is_empty() {
        return None;
    }
    let target = normalize_model_path(model_path);
    models
        .iter()
        .find(|m| normalize_model_path(&m.local_path) == target)
        .and_then(|m| m.metadata.mmproj_path.as_deref())
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .map(|p| p.to_string())
}

/// Look up the multimodal projector for a model, ignoring stale records whose
/// file no longer exists on disk.
fn find_mmproj_for_model(app: &AppHandle, model_path: &str) -> Option<String> {
    let mmproj = pick_mmproj(&crate::storage::model_store::load_all(app), model_path)?;
    if Path::new(&mmproj).is_file() {
        Some(mmproj)
    } else {
        None
    }
}

/// Classify a llama-server stderr line by the level marker it emits itself.
///
/// llama.cpp writes INFO and WARNING to stderr alongside real errors, so
/// tagging the whole stream as `ERROR` makes a healthy startup look like a
/// failure. Lines look like `<elapsed> <LEVEL> <component> <module>: <msg>`,
/// e.g. `0.00.486.038 W model has unused tensor ...`.
///
/// Returns the prefix the frontend log parser understands: `ERROR`, `WARN`,
/// `DEBUG`, or `INFO`.
fn llama_log_level(line: &str) -> &'static str {
    let mut tokens = line.split_whitespace();
    // First token is the elapsed-time stamp, the level char follows it.
    if let (Some(_stamp), Some(level)) = (tokens.next(), tokens.next()) {
        match level {
            "E" => return "ERROR",
            "W" => return "WARN",
            "D" => return "DEBUG",
            _ => {}
        }
    }
    "INFO"
}

/// Format a llama-server log line the way the frontend parser expects:
/// bare for info, `WARN:` / `ERROR:` / `DEBUG:` prefixes otherwise.
fn format_service_log(timestamp: &str, line: &str) -> String {
    let level = llama_log_level(line);
    let message = line.trim();
    if level == "INFO" {
        format!("[{}] {}", timestamp, message)
    } else {
        format!("[{}] {}: {}", timestamp, level, message)
    }
}

/// Compute the status to report after a process exits.
///
/// An intentional stop (the user pressed stop/restart) must never surface as an
/// error, while an unexpected non-zero exit must. This is kept pure so the rule
/// can be tested without spawning a process.
fn termination_status(intentional: bool, exit_code: Option<i32>) -> (String, Option<String>) {
    if intentional {
        return ("stopped".to_string(), None);
    }
    match exit_code {
        Some(code) if code != 0 => (
            "error".to_string(),
            Some(format!("进程异常退出，退出码: {}", code)),
        ),
        _ => ("stopped".to_string(), None),
    }
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
    /// Incremented on every start. Each capture task records the generation it
    /// belongs to and ignores events once a newer process has been started, so
    /// a dying process cannot overwrite the status or child handle of its
    /// replacement (which is what made "restart" report a bogus crash).
    generation: Arc<AtomicU64>,
}

impl ServiceManager {
    /// Create a new ServiceManager with no running process.
    pub fn new() -> Self {
        Self {
            child: Arc::new(Mutex::new(None)),
            status: Arc::new(Mutex::new(ServiceStatus::stopped())),
            logs: Arc::new(Mutex::new(Vec::new())),
            intentional_stop: Arc::new(AtomicBool::new(false)),
            generation: Arc::new(AtomicU64::new(0)),
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

        // Claim a new generation. Any capture task still draining the previous
        // process will see a mismatch and stop touching shared state.
        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;

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
        let mut args = self.build_args(config);

        // Vision models need their multimodal projector to accept image input.
        // The UI backfills `--mmproj` when a model is selected, but services
        // saved before that existed (or created outside the UI) would silently
        // start without it and reject images. Fall back to the projector
        // recorded alongside the model file.
        let has_mmproj = config
            .parameters
            .get("mmproj")
            .and_then(|v| v.as_str())
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        if !has_mmproj {
            if let Some(mmproj) = find_mmproj_for_model(app, &config.model_path) {
                args.push("--mmproj".to_string());
                args.push(mmproj);
            }
        }

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
        let generation_arc = self.generation.clone();
        let service_id = config.id.clone();

        // Spawn background task to capture stdout/stderr
        tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
                // A restart spawns the replacement before this process has
                // finished dying. Once a newer generation exists, this task is
                // stale: its logs belong to a dead session and its Terminated
                // event must not touch the live process's status or handle.
                if generation_arc.load(Ordering::SeqCst) != generation {
                    continue;
                }
                match event {
                    CommandEvent::Stdout(bytes) => {
                        let line = String::from_utf8_lossy(&bytes);
                        let timestamp = Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
                        let log = format_service_log(&timestamp, &line);

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
                        let log = format_service_log(&timestamp, &line);

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
                            let was_intentional = intentional_stop_flag.load(Ordering::SeqCst);
                            let (next_status, error_message) =
                                termination_status(was_intentional, payload.code);
                            status.status = next_status;
                            status.error_message = error_message;
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
                status.service_name = None;
                status.pid = None;
                status.port = None;
                status.started_at = None;
                status.error_message = None;
                // `service_id` is intentionally kept so the emitted event tells the
                // frontend which service stopped (it is also how get_service_status
                // maps a status back to a single service).
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

        // Boolean parameters whose llama.cpp long flag is not a plain switch.
        // Emitting these bare makes llama.cpp consume the following argument as
        // their value (e.g. `--flash-attn --presence-penalty`), so an explicit
        // value has to be supplied.
        fn bool_flag_value(k: &str) -> Option<&'static str> {
            match k {
                "flash-attn" => Some("on"),
                "numa" => Some("distribute"),
                _ => None,
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
                        if let Some(v) = bool_flag_value(effective_key) {
                            args.push(v.to_string());
                        }
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
    use crate::models::model::ModelMetadata;
    use std::collections::HashMap;

    fn local_model(path: &str, mmproj: Option<&str>) -> LocalModel {
        LocalModel {
            id: "test-id".to_string(),
            repo_id: Some("test/repo".to_string()),
            filename: "model.gguf".to_string(),
            local_path: path.to_string(),
            size_bytes: 0,
            quantization: None,
            downloaded_at: "2026-01-01".to_string(),
            metadata: ModelMetadata {
                description: None,
                tags: vec!["downloaded".to_string()],
                mmproj_path: mmproj.map(|p| p.to_string()),
            },
        }
    }

    #[test]
    fn test_llama_log_level_reads_llama_marker() {
        assert_eq!(llama_log_level("0.00.065.578 I cmn  common_param: verbosity = 3"), "INFO");
        assert_eq!(
            llama_log_level("0.00.486.038 W model has unused tensor blk.16.attn_q.weight"),
            "WARN"
        );
        assert_eq!(llama_log_level("0.01.000.000 E srv  llama_server: boom"), "ERROR");
        assert_eq!(llama_log_level("0.01.000.000 D srv  llama_server: trace"), "DEBUG");
    }

    #[test]
    fn test_llama_log_level_defaults_to_info() {
        // Lines without llama.cpp's `<elapsed> <LEVEL>` prefix must not be
        // reported as errors just because they arrived on stderr.
        assert_eq!(llama_log_level("plain message"), "INFO");
        assert_eq!(llama_log_level(""), "INFO");
        assert_eq!(llama_log_level("2026-01-01 00:00:00"), "INFO");
    }

    #[test]
    fn test_format_service_log_matches_frontend_parser() {
        let ts = "2026-01-01 00:00:00";
        // INFO stays bare so the frontend parses it as info
        assert_eq!(
            format_service_log(ts, "0.00.065.578 I cmn  common_param: ready\n"),
            "[2026-01-01 00:00:00] 0.00.065.578 I cmn  common_param: ready"
        );
        assert_eq!(
            format_service_log(ts, "0.00.486.038 W model has unused tensor"),
            "[2026-01-01 00:00:00] WARN: 0.00.486.038 W model has unused tensor"
        );
        assert_eq!(
            format_service_log(ts, "0.01.000.000 E failed to load"),
            "[2026-01-01 00:00:00] ERROR: 0.01.000.000 E failed to load"
        );
    }

    #[test]
    fn test_termination_status_intentional_stop_is_not_an_error() {
        // This is the restart path: the old process is killed, so its exit code
        // is non-zero, but it must never be reported as a crash.
        assert_eq!(termination_status(true, Some(1)), ("stopped".to_string(), None));
        assert_eq!(termination_status(true, None), ("stopped".to_string(), None));
    }

    #[test]
    fn test_termination_status_unexpected_crash_is_an_error() {
        let (status, message) = termination_status(false, Some(1));
        assert_eq!(status, "error");
        assert_eq!(message, Some("进程异常退出，退出码: 1".to_string()));
    }

    #[test]
    fn test_termination_status_clean_exit_is_stopped() {
        assert_eq!(termination_status(false, Some(0)), ("stopped".to_string(), None));
        assert_eq!(termination_status(false, None), ("stopped".to_string(), None));
    }

    #[test]
    fn test_pick_mmproj_returns_registered_projector() {
        let models = vec![local_model(
            "D:\\models\\GLM-OCR-Q8_0.gguf",
            Some("D:\\models\\mmproj-GLM-OCR-Q8_0.gguf"),
        )];
        assert_eq!(
            pick_mmproj(&models, "D:\\models\\GLM-OCR-Q8_0.gguf"),
            Some("D:\\models\\mmproj-GLM-OCR-Q8_0.gguf".to_string())
        );
    }

    #[test]
    fn test_pick_mmproj_matches_ignoring_case_and_separators() {
        let models = vec![local_model(
            "D:\\Models\\GLM-OCR-Q8_0.gguf",
            Some("D:\\Models\\mmproj-GLM-OCR-Q8_0.gguf"),
        )];
        assert_eq!(
            pick_mmproj(&models, "d:/models/glm-ocr-q8_0.gguf"),
            Some("D:\\Models\\mmproj-GLM-OCR-Q8_0.gguf".to_string())
        );
    }

    #[test]
    fn test_pick_mmproj_none_for_text_model() {
        let models = vec![local_model("D:\\models\\llama.gguf", None)];
        assert_eq!(pick_mmproj(&models, "D:\\models\\llama.gguf"), None);
    }

    #[test]
    fn test_pick_mmproj_none_when_path_unmatched_or_empty() {
        let models = vec![local_model(
            "D:\\models\\GLM-OCR-Q8_0.gguf",
            Some("D:\\models\\mmproj-GLM-OCR-Q8_0.gguf"),
        )];
        assert_eq!(pick_mmproj(&models, "D:\\models\\other.gguf"), None);
        assert_eq!(pick_mmproj(&models, "   "), None);
        assert_eq!(pick_mmproj(&[], "D:\\models\\GLM-OCR-Q8_0.gguf"), None);
    }

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
        // "model" is added by start() via command.arg("--model"), so build_args
        // must not emit it again
        assert!(!args.contains(&"--model".to_string()));
        assert!(!args.contains(&"test-model".to_string()));
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
    fn test_build_args_flash_attn_gets_explicit_value() {
        let manager = ServiceManager::new();
        let mut params = HashMap::new();
        params.insert("flash-attn".to_string(), serde_json::json!(true));
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
        // `--flash-attn` requires an explicit value, otherwise llama.cpp swallows
        // the next argument (e.g. `--flash-attn --presence-penalty`).
        assert_eq!(args, vec!["--flash-attn", "on"]);
    }

    #[test]
    fn test_build_args_flash_attn_disabled_emits_nothing() {
        let manager = ServiceManager::new();
        let mut params = HashMap::new();
        params.insert("flash-attn".to_string(), serde_json::json!(false));
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
        assert!(args.is_empty(), "Disabled flash-attn should emit no flag");
    }

    #[test]
    fn test_build_args_numa_gets_explicit_value() {
        let manager = ServiceManager::new();
        let mut params = HashMap::new();
        params.insert("numa".to_string(), serde_json::json!(true));
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
        assert_eq!(args, vec!["--numa", "distribute"]);
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