use crate::commands::python::PythonDownloadState;
use crate::models::model::{HFModelInfo, LocalModel};
use crate::storage::catalog_cache;
use crate::storage::model_store;
use crate::storage::service_store;
use crate::storage::settings_store;
use serde::Serialize;
use std::fs;
use tauri::{AppHandle, Emitter, Manager, State};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows constant to hide console window.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Helper: apply CREATE_NO_WINDOW flag on Windows to suppress CMD popup.
#[allow(unused_variables)]
fn hide_window(cmd: &mut std::process::Command) {
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Helper: apply CREATE_NO_WINDOW flag on Windows for tokio async Command.
#[allow(unused_variables)]
fn hide_window_tokio(cmd: &mut tokio::process::Command) {
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Information about a file in a ModelScope repository.
#[derive(Debug, Clone, Serialize)]
pub struct HFRepoFile {
    pub filename: String,
    pub size: Option<u64>,
}

/// List all locally downloaded models.
#[tauri::command]
pub fn list_local_models(app: tauri::AppHandle) -> Vec<LocalModel> {
    model_store::load_all(&app)
}

/// Delete a local model by its ID.
///
/// Checks if any existing service references this model before deletion.
/// If a reference is found, the deletion is rejected with an error message.
#[tauri::command]
pub fn delete_model(app: AppHandle, id: String) -> Result<(), String> {
    let model = model_store::load(&app, &id).ok_or_else(|| format!("模型 {} 未找到", id))?;

    let services = service_store::load_all(&app);
    for service in &services {
        if service.model_path == model.local_path {
            return Err(format!(
                "无法删除模型 '{}'：服务 '{}' 正在引用此模型",
                model.filename, service.name
            ));
        }
    }

    // Delete the model file if it exists
    if !model.local_path.is_empty() {
        let path = std::path::Path::new(&model.local_path);
        if path.exists() {
            let _ = fs::remove_file(path);
        }
    }

    // Delete the companion multimodal projector (mmproj) if present
    if let Some(mmproj) = &model.metadata.mmproj_path {
        if !mmproj.trim().is_empty() {
            let mmproj_path = std::path::Path::new(mmproj);
            if mmproj_path.exists() {
                let _ = fs::remove_file(mmproj_path);
            }
        }
    }

    model_store::delete(&app, &id)
}

/// Pick a recommended GGUF file for a ModelScope repository.
fn pick_recommended_filename(files: &[String]) -> String {
    let preference_order = [
        "q4_k_m.gguf",
        "Q4_K_M.gguf",
        "q4_0.gguf",
        "Q4_0.gguf",
        "q5_k_m.gguf",
        "Q5_K_M.gguf",
        "q8_0.gguf",
        "Q8_0.gguf",
    ];
    for suffix in preference_order {
        if let Some(hit) = files.iter().find(|f| f.ends_with(suffix)) {
            return hit.clone();
        }
    }
    files
        .iter()
        .find(|f| f.to_ascii_lowercase().ends_with(".gguf"))
        .cloned()
        .unwrap_or_default()
}

/// Pick a multimodal projector (mmproj) file from a repo file list.
///
/// Vision models ship their projector as a separate `mmproj-*.gguf` file.
/// Returns `None` when the repo contains no such file (text-only model).
fn pick_companion_filename(files: &[String]) -> Option<String> {
    files
        .iter()
        .find(|f| {
            let lower = f.to_ascii_lowercase();
            lower.ends_with(".gguf") && lower.contains("mmproj")
        })
        .cloned()
}

/// Get the models download directory.
fn get_models_download_dir(app: &AppHandle) -> Result<String, String> {
    let settings = settings_store::load(app);
    if let Some(ref dir) = settings.models_dir {
        if !dir.trim().is_empty() {
            return Ok(dir.trim().to_string());
        }
    }
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(data_dir.join("models").to_string_lossy().to_string())
}

/// Start downloading a model from ModelScope.
#[tauri::command]
pub fn start_download(
    app: AppHandle,
    state: State<'_, PythonDownloadState>,
    repo_id: String,
    filename: String,
    companion_filename: Option<String>,
) -> Result<String, String> {
    if repo_id.trim().is_empty() {
        return Err("下载失败：缺少仓库 ID (repoId)".to_string());
    }

    let now = chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string();
    let model_id = uuid::Uuid::new_v4().to_string();

    // Resolve the filename to download
    let (resolved_filename, actual_repo_id, auto_companion) = if filename.trim().is_empty() {
        // No filename provided — fetch real file list from ModelScope and pick the best one
        let try_repo = |repo: &str| -> Result<Vec<String>, String> {
            match list_repo_files(app.clone(), repo.to_string()) {
                Ok(files) => {
                    let gguf_files: Vec<String> = files
                        .iter()
                        .filter(|f| f.filename.to_ascii_lowercase().ends_with(".gguf"))
                        .map(|f| f.filename.clone())
                        .collect();
                    if gguf_files.is_empty() {
                        Err("no gguf".to_string())
                    } else {
                        Ok(gguf_files)
                    }
                }
                Err(e) => Err(e),
            }
        };

        match try_repo(&repo_id) {
            Ok(gguf_files) => (
                pick_recommended_filename(&gguf_files),
                repo_id.clone(),
                pick_companion_filename(&gguf_files),
            ),
            Err(_) => {
                // Try GGUF variant: "Qwen/Qwen2.5-0.5B-Instruct" -> "Qwen/Qwen2.5-0.5B-Instruct-GGUF"
                let gguf_variant = format!("{}-GGUF", repo_id);
                match try_repo(&gguf_variant) {
                    Ok(gguf_files) => (
                        pick_recommended_filename(&gguf_files),
                        gguf_variant,
                        pick_companion_filename(&gguf_files),
                    ),
                    Err(_) => return Err("该仓库中没有找到 .gguf 文件".to_string()),
                }
            }
        }
    } else {
        (filename.trim().to_string(), repo_id.clone(), None)
    };

    let local_filename = if resolved_filename.is_empty() {
        format!("{}.gguf", actual_repo_id.rsplit('/').next().unwrap_or("model"))
    } else {
        resolved_filename.clone()
    };

    // Compute the local download directory
    let local_dir = get_models_download_dir(&app)?;

    let model = LocalModel {
        id: model_id.clone(),
        repo_id: Some(actual_repo_id.clone()),
        filename: local_filename.clone(),
        local_path: String::new(),
        size_bytes: 0,
        quantization: None,
        downloaded_at: now,
        metadata: crate::models::model::ModelMetadata {
            description: None,
            tags: vec!["downloading".to_string()],
            mmproj_path: None,
        },
    };

    model_store::save(&app, &model)?;

    // Seed progress
    let seed_payload = serde_json::json!({
        "modelId": model_id,
        "repoId": actual_repo_id,
        "current": 0u64,
        "total": 0u64,
        "speed": 0u64,
        "status": "downloading",
        "localPath": local_dir,
    });
    let _ = app.emit("download-progress", seed_payload);

    let app_clone = app.clone();
    let state_inner = state.inner().clone();
    let m_id = model_id.clone();
    let r_id = actual_repo_id.clone();
    let f_name = if resolved_filename.is_empty() {
        "*.gguf".to_string()
    } else {
        resolved_filename
    };
    let l_dir = local_dir.clone();
    // Prefer an explicitly selected companion; otherwise fall back to the
    // mmproj file auto-detected from the repo file list.
    let companion = companion_filename
        .or(auto_companion)
        .map(|c| c.trim().to_string())
        .filter(|c| !c.is_empty() && !c.eq_ignore_ascii_case(&f_name));

    tauri::async_runtime::spawn(async move {
        if let Err(e) =
            run_python_download(app_clone.clone(), state_inner, m_id.clone(), r_id.clone(), f_name.clone(), l_dir.clone(), companion).await
        {
            let err_payload = serde_json::json!({
                "modelId": m_id,
                "repoId": r_id,
                "current": 0u64,
                "total": 0u64,
                "speed": 0u64,
                "status": "error",
                "errorMessage": e,
                "localPath": l_dir,
            });
            let _ = app_clone.emit("download-error", err_payload);
        }
    });

    Ok(model_id)
}

/// Internal: spawn Python subprocess and relay events.
///
/// The child process is kept in shared state (`PythonDownloadState.child`) for
/// its entire lifetime so that `pause_download` / `cancel_download` can kill it
/// at any time.  A dedicated *wait task* takes the child out of shared state
/// only after the process has exited (or been killed) and handles cleanup.
async fn run_python_download(
    app: AppHandle,
    state: PythonDownloadState,
    model_id: String,
    repo_id: String,
    filename: String,
    local_dir: String,
    companion: Option<String>,
) -> Result<(), String> {
    use tokio::io::{AsyncBufReadExt, AsyncReadExt};
    use tokio::process::Command;
    use tokio_stream::wrappers::LinesStream;
    use tokio_stream::StreamExt;

    // Reset the intentional-stop flag for this download cycle.
    state.reset();

    // ── 1. Spawn the child process (kept inside shared state) ──────────
    {
        let mut child_guard = state
            .child
            .lock()
            .map_err(|e| format!("获取下载锁失败: {}", e))?;
        if child_guard.is_some() {
            return Err("已有下载任务正在运行，请先取消".to_string());
        }

        let resource_dir = app
            .path()
            .resource_dir()
            .map_err(|e| format!("获取资源目录失败: {}", e))?;
        let script_path = resource_dir.join("python").join("download_model.py");

        let mut cmd = Command::new("python");
        cmd.env("PYTHONIOENCODING", "utf-8")
            .env("PYTHONUNBUFFERED", "1")    // force stderr to be unbuffered
            .env("TQDM_MININTERVAL", "1")   // tqdm: at most 1 update/sec
            .arg(script_path.to_str().unwrap_or("download_model.py"))
            .arg(&repo_id)
            .arg(&local_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped());
        hide_window_tokio(&mut cmd);

        // Pass filename as named arg
        if !filename.is_empty() && filename != "*.gguf" {
            cmd.arg("--filename").arg(&filename);
        }

        // Pass companion file (mmproj for vision models) as named arg
        if let Some(ref comp) = companion {
            cmd.arg("--companion").arg(comp);
        }

        let child = cmd
            .spawn()
            .map_err(|e| format!("启动下载进程失败: {}", e))?;

        // Store PID so cancel_download can kill by PID even if the child
        // handle has been taken by the wait-task.
        state.set_pid(child.id().unwrap_or(0));

        *child_guard = Some(child);
    }

    // ── 2. Take stdout / stderr out of the child (still in shared state) ─
    let (stdout, stderr_pipe) = {
        let mut guard = state
            .child
            .lock()
            .map_err(|e| e.to_string())?;
        let child = guard.as_mut().ok_or("下载进程已丢失")?;
        let stdout = child.stdout.take().ok_or("无法获取下载进程输出")?;
        let stderr = child.stderr.take();
        (stdout, stderr)
    };

    let mut reader = LinesStream::new(tokio::io::BufReader::new(stdout).lines());
    // Keep stderr as raw pipe — tqdm uses \r (not \n), so we can't use line-based reading.
    let stderr_raw = stderr_pipe;

    let app_read = app.clone();
    let repo_read = repo_id.clone();
    let mid_read = model_id.clone();
    let local_path_read = local_dir.clone();

    // ── 3. Spawn stdout reader task ────────────────────────────────────
    tauri::async_runtime::spawn(async move {
        while let Some(Ok(line)) = reader.next().await {
            let base: serde_json::Value = match serde_json::from_str(&line) {
                Ok(v) => v,
                Err(_) => {
                    // Plain text → log message
                    let payload = serde_json::json!({
                        "modelId": mid_read,
                        "repoId": repo_read,
                        "message": line,
                        "level": "info",
                        "status": "downloading",
                        "localPath": local_path_read,
                        "isLog": true,
                    });
                    let _ = app_read.emit("download-progress", payload);
                    continue;
                }
            };

            let mut obj = match base {
                serde_json::Value::Object(o) => o,
                _ => continue,
            };

            // Inject modelId (always override with Rust-side UUID)
            obj.insert(
                "modelId".to_string(),
                serde_json::Value::String(mid_read.clone()),
            );

            // Convert snake_case → camelCase: repo_id → repoId
            obj.remove("repo_id");
            obj.insert(
                "repoId".to_string(),
                serde_json::Value::String(repo_read.clone()),
            );

            // Convert snake_case → camelCase: local_path → localPath
            obj.remove("local_path");
            obj.insert(
                "localPath".to_string(),
                serde_json::Value::String(local_path_read.clone()),
            );

            // Determine message type
            let msg_type = obj
                .get("type")
                .and_then(|v| v.as_str())
                .unwrap_or("progress");

            match msg_type {
                "log" => {
                    let message = obj
                        .get("message")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    let level = obj
                        .get("level")
                        .and_then(|v| v.as_str())
                        .unwrap_or("info")
                        .to_string();
                    let payload = serde_json::json!({
                        "modelId": mid_read,
                        "repoId": repo_read,
                        "message": message,
                        "level": level,
                        "status": "downloading",
                        "localPath": local_path_read,
                        "isLog": true,
                    });
                    let _ = app_read.emit("download-progress", payload);
                }
                "complete" => {
                    obj.insert(
                        "status".to_string(),
                        serde_json::Value::String("completed".to_string()),
                    );

                    // Update model record with completed info
                    if let Some(path) = obj.get("path").and_then(|v| v.as_str()) {
                        if let Some(mut model) = model_store::load(&app_read, &mid_read) {
                            model.local_path = path.to_string();
                            if let Ok(metadata) = fs::metadata(path) {
                                model.size_bytes = metadata.len();
                            }
                            model.metadata.tags = vec!["downloaded".to_string()];
                            let fname = model.filename.to_ascii_uppercase();
                            for q in &["Q4_K_M", "Q4_0", "Q5_K_M", "Q6_K", "Q8_0", "IQ4_XS", "IQ4_NL", "Q4_K_S", "Q5_K_S", "Q2_K", "Q3_K_S", "Q3_K_M", "Q3_K_L"] {
                                if fname.contains(q) {
                                    model.quantization = Some(q.to_string());
                                    break;
                                }
                            }
                            // Record the multimodal projector path if a companion
                            // file was downloaded alongside this model.
                            if let Some(comp) = obj.get("companionPath").and_then(|v| v.as_str()) {
                                if !comp.trim().is_empty() {
                                    model.metadata.mmproj_path = Some(comp.trim().to_string());
                                }
                            }
                            let _ = model_store::save(&app_read, &model);
                        }
                    }

                    let _ = app_read.emit(
                        "download-complete",
                        serde_json::json!({ "modelId": mid_read }),
                    );
                    let _ = app_read.emit("download-progress", serde_json::Value::Object(obj));
                }
                "error" => {
                    let error = obj
                        .get("error")
                        .and_then(|v| v.as_str())
                        .unwrap_or("Unknown error")
                        .to_string();
                    let _ = app_read.emit(
                        "download-error",
                        serde_json::json!({
                            "modelId": mid_read,
                            "repoId": repo_read,
                            "status": "error",
                            "errorMessage": error,
                            "localPath": local_path_read,
                        }),
                    );
                }
                _ => {
                    if !obj.contains_key("status") {
                        obj.insert(
                            "status".to_string(),
                            serde_json::Value::String("downloading".to_string()),
                        );
                    }
                    let _ = app_read.emit("download-progress", serde_json::Value::Object(obj));
                }
            }
        }
    });

    // ── 4. Drain stderr ────────────────────────────────────────────────
    //
    // IMPORTANT: tqdm uses \r (carriage return) to overwrite the same line,
    // NOT \n (newline). The previous line-based reader (BufReader::lines())
    // only splits on \n, so all tqdm output was buffered until the process
    // exited and the pipe closed.
    //
    // Fix: read raw chunks from stderr and split on BOTH \r and \n.
    if let Some(mut stderr_pipe) = stderr_raw {
        let app_err = app.clone();
        let mid_err = model_id.clone();
        let repo_err = repo_id.clone();
        let local_path_err = local_dir.clone();
        tauri::async_runtime::spawn(async move {
            let mut buf = [0u8; 4096];
            let mut leftover = String::new();
            // Dedup state: track last emitted (file, pct) for tqdm lines
            let mut last_tqdm_file = String::new();
            let mut last_tqdm_pct: i32 = -1;

            loop {
                match stderr_pipe.read(&mut buf).await {
                    Ok(0) => break, // EOF
                    Ok(n) => {
                        // Decode chunk as UTF-8 (lossy for partial chars)
                        leftover.push_str(&String::from_utf8_lossy(&buf[..n]));

                        // Split on \r and \n — tqdm uses \r, regular logs use \n
                        let segments: Vec<String> =
                            leftover.split(|c| c == '\r' || c == '\n').map(|s| s.to_string()).collect();

                        // Last segment may be incomplete — keep for next iteration
                        leftover = segments.last().cloned().unwrap_or_default();

                        // Process all complete segments
                        for segment in segments.iter().take(segments.len().saturating_sub(1)) {
                            let trimmed = segment.trim();
                            if trimmed.is_empty() {
                                continue;
                            }

                            // ── Detect tqdm progress lines ──
                            if trimmed.contains('%') && trimmed.contains('|') {
                                let pct = extract_tqdm_pct(trimmed);
                                let file = extract_tqdm_file(trimmed);

                                // Deduplicate: only emit when pct changes by >= 1%
                                if file == last_tqdm_file && (pct - last_tqdm_pct).abs() < 1 {
                                    continue;
                                }
                                last_tqdm_file = file.clone();
                                last_tqdm_pct = pct;

                                let speed = extract_tqdm_speed(trimmed);
                                let msg = if !file.is_empty() && !speed.is_empty() {
                                    format!("{} — {}% ({})", file, pct, speed)
                                } else if !file.is_empty() {
                                    format!("{} — {}%", file, pct)
                                } else {
                                    format!("下载进度: {}%", pct)
                                };

                                let payload = serde_json::json!({
                                    "modelId": mid_err,
                                    "repoId": repo_err,
                                    "message": msg,
                                    "level": "info",
                                    "status": "downloading",
                                    "localPath": local_path_err,
                                    "isLog": true,
                                });
                                let _ = app_err.emit("download-progress", payload);
                                continue;
                            }

                            // ── Non-tqdm: forward as log message ──
                            let payload = serde_json::json!({
                                "modelId": mid_err,
                                "repoId": repo_err,
                                "message": trimmed,
                                "level": "stderr",
                                "status": "downloading",
                                "localPath": local_path_err,
                                "isLog": true,
                            });
                            let _ = app_err.emit("download-progress", payload);
                        }
                    }
                    Err(e) => {
                        eprintln!("[stderr] Read error: {}", e);
                        break;
                    }
                }
            }
        });
    }

    // ── 5. Spawn wait-task: waits for child exit, then cleans up ───────
    //
    // The child stays in shared state so that pause / cancel can kill it.
    // Once the child exits (naturally or via kill), this task takes it out
    // of shared state, waits for the exit status, and emits the appropriate
    // event — unless the stop was intentional (pause / cancel).
    let wait_state = state.clone();
    let wait_app = app.clone();
    let wait_mid = model_id.clone();
    let wait_repo = repo_id.clone();
    let wait_dir = local_dir.clone();

    tauri::async_runtime::spawn(async move {
        // Take the child out of shared state (blocks until pause/cancel
        // releases the lock, if it's currently held).
        let mut child = {
            let mut guard = wait_state.child.lock().unwrap_or_else(|e| e.into_inner());
            guard.take()
        };

        if let Some(ref mut c) = child {
            // Wait for the process to actually exit.
            let status = c.wait().await;

            // Clear shared state.
            {
                let mut guard = wait_state.child.lock().unwrap_or_else(|e| e.into_inner());
                *guard = None;
            }

            // If the stop was intentional (pause / cancel), skip error events.
            if wait_state.was_stopped() {
                return;
            }

            match status {
                Ok(s) if s.success() => { /* already handled by stdout reader */ }
                Ok(s) => {
                    let _ = wait_app.emit(
                        "download-error",
                        serde_json::json!({
                            "modelId": wait_mid,
                            "repoId": wait_repo,
                            "status": "error",
                            "errorMessage": format!("下载进程退出，退出码: {:?}", s.code()),
                            "localPath": wait_dir,
                        }),
                    );
                }
                Err(e) => {
                    let _ = wait_app.emit(
                        "download-error",
                        serde_json::json!({
                            "modelId": wait_mid,
                            "repoId": wait_repo,
                            "status": "error",
                            "errorMessage": format!("等待下载进程失败: {}", e),
                            "localPath": wait_dir,
                        }),
                    );
                }
            }
        } else {
            // Child was already taken (shouldn't normally happen).
            let mut guard = wait_state.child.lock().unwrap_or_else(|e| e.into_inner());
            *guard = None;
        }
    });

    Ok(())
}

// ── tqdm parsing helpers ──────────────────────────────────────────────
//
// tqdm writes progress to stderr in formats like:
//   "filename:  45%|████▌     | 450M/1.0G [00:30<00:37, 14.8MB/s]"
//   "Downloading: 45%|████▌     | 450M/1.0G [00:30<00:37, 14.8MB/s]"
//   " 45%|████▌     | 450M/1.0G [00:30<00:37, 14.8MB/s]"

/// Extract the percentage integer from a tqdm line.
fn extract_tqdm_pct(line: &str) -> i32 {
    // Find the first occurrence of "NN%" where NN is a number
    let mut chars = line.chars().peekable();
    let mut num_buf = String::new();
    while let Some(c) = chars.next() {
        if c.is_ascii_digit() {
            num_buf.push(c);
            if chars.peek() == Some(&'%') {
                return num_buf.parse().unwrap_or(0);
            }
        } else {
            num_buf.clear();
        }
    }
    0
}

/// Extract the filename / description from a tqdm line.
/// This is the text before the percentage and '|' separator.
fn extract_tqdm_file(line: &str) -> String {
    // Find the first '%' and work backwards to get the description
    if let Some(pct_pos) = line.find('%') {
        // Get everything before the percentage
        let before_pct = &line[..pct_pos].trim_end();
        // Remove trailing ':' if present
        let desc = before_pct.trim_end_matches(':').trim();
        // If desc looks like a progress bar (contains '█' or is empty), skip
        if desc.is_empty() || desc.contains('█') || desc.contains('━') {
            return String::new();
        }
        // Take only the last path component (cross-platform)
        let file = std::path::Path::new(desc)
            .file_name()
            .and_then(|f| f.to_str())
            .unwrap_or(desc);
        // Truncate if too long
        if file.len() > 50 {
            return format!("...{}", &file[file.len() - 47..]);
        }
        return file.to_string();
    }
    String::new()
}

/// Extract the speed string from a tqdm line (e.g., "14.8MB/s").
fn extract_tqdm_speed(line: &str) -> String {
    // Speed is usually at the end in the [...] section, after the last comma
    // Format: [00:30<00:37, 14.8MB/s]
    if let Some(bracket_start) = line.rfind('[') {
        let bracket_content = &line[bracket_start..];
        if let Some(comma_pos) = bracket_content.rfind(',') {
            let speed_part = &bracket_content[comma_pos + 1..];
            let speed = speed_part.trim().trim_end_matches(']').trim();
            if !speed.is_empty() && !speed.contains('<') {
                return speed.to_string();
            }
        }
    }
    String::new()
}

/// Cancel a model download and clean up cache.
///
/// Uses the stored PID as the primary kill mechanism — this works even when
/// the child handle has been taken by the wait-task. On Windows, kills the
/// entire process tree via `taskkill /T /F`, verifies death via `tasklist`,
/// and retries if the process survives.
#[tauri::command]
pub async fn cancel_download(
    app: AppHandle,
    state: State<'_, PythonDownloadState>,
    id: String,
) -> Result<(), String> {
    // Phase 1: Mark as intentional stop so the wait-task won't emit errors.
    state.mark_stopped();

    let pid = state.get_pid();
    eprintln!("[cancel] Stored PID: {}", pid);

    // Phase 2: Try to take the child handle (may already be taken by wait-task).
    let child = {
        let mut guard = state
            .child
            .lock()
            .map_err(|e| e.to_string())?;
        guard.take()
    };

    if let Some(mut child) = child {
        eprintln!("[cancel] Got child handle, PID: {:?}", child.id());

        #[cfg(target_os = "windows")]
        {
            let pid_val = child.id().unwrap_or(pid);
            if pid_val > 0 {
                let killed = kill_process_tree_win(pid_val).await;
                if !killed {
                    eprintln!("[cancel] taskkill failed, trying child.kill()");
                    let _ = child.kill().await;
                }
            } else {
                let _ = child.kill().await;
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            let _ = child.kill().await;
        }

        let _ = child.wait().await;
        eprintln!("[cancel] child.wait() returned");
    } else if pid > 0 {
        // Child handle was taken by wait-task — kill by PID directly.
        eprintln!("[cancel] No child handle, killing by PID: {}", pid);

        #[cfg(target_os = "windows")]
        {
            let killed = kill_process_tree_win(pid).await;
            if !killed {
                eprintln!("[cancel] taskkill by PID failed, retrying in 1s");
                tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                let _ = kill_process_tree_win(pid).await;
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // On Unix, try kill via nix or command
            let _ = std::process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .status();
        }
    } else {
        eprintln!("[cancel] No child handle and no PID — process may have already exited");
    }

    // Phase 3: Verify process is dead and clean up state (Windows).
    #[cfg(target_os = "windows")]
    if pid > 0 {
        // Give the OS a moment to reap the process.
        tokio::time::sleep(std::time::Duration::from_millis(500)).await;

        if is_process_alive_win(pid).await {
            eprintln!("[cancel] PID {} STILL alive! Final kill attempt", pid);
            kill_process_tree_win(pid).await;
            tokio::time::sleep(std::time::Duration::from_secs(2)).await;

            if is_process_alive_win(pid).await {
                eprintln!("[cancel] CRITICAL: PID {} CANNOT be killed!", pid);
            } else {
                eprintln!("[cancel] PID {} confirmed dead after retry", pid);
                state.set_pid(0);
            }
        } else {
            eprintln!("[cancel] PID {} confirmed dead", pid);
            state.set_pid(0);
        }
    }

    // Clean up partial download files (must happen BEFORE model record deletion
    // so cleanup_download_cache can read the model's repo_id and filename).
    cleanup_download_cache(&app, &id);

    // Remove model record
    let _ = model_store::delete(&app, &id);

    let _ = app.emit(
        "download-error",
        serde_json::json!({
            "modelId": id,
            "status": "cancelled",
            "errorMessage": "下载已取消",
        }),
    );

    Ok(())
}

/// Windows: kill a process tree using `taskkill /T /F /PID`.
/// Returns true if the command succeeded.
#[cfg(target_os = "windows")]
async fn kill_process_tree_win(pid: u32) -> bool {
    use tokio::process::Command;
    eprintln!("[cancel] Running: taskkill /T /F /PID {}", pid);
    match Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .status()
        .await
    {
        Ok(status) => {
            let ok = status.success();
            eprintln!("[cancel] taskkill exited: success={}", ok);
            ok
        }
        Err(e) => {
            eprintln!("[cancel] taskkill error: {}", e);
            false
        }
    }
}

/// Windows: check if a process is still alive using `tasklist`.
#[cfg(target_os = "windows")]
async fn is_process_alive_win(pid: u32) -> bool {
    use tokio::process::Command;
    let output = Command::new("tasklist")
        .args(["/FI", &format!("PID eq {}", pid), "/NH"])
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .creation_flags(0x08000000)
        .output()
        .await;

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            // tasklist outputs a line with the PID if the process exists
            let alive = stdout.contains(&pid.to_string());
            eprintln!("[cancel] tasklist check PID {}: alive={}", pid, alive);
            alive
        }
        Err(_) => false, // assume dead if we can't check
    }
}

/// Delete a failed/incomplete download and clean up all cache.
#[tauri::command]
pub fn delete_paused_download(app: AppHandle, id: String) -> Result<(), String> {
    // Clean up cache
    cleanup_download_cache(&app, &id);

    // Remove model record (ignore error if already gone)
    let _ = model_store::delete(&app, &id);

    let _ = app.emit(
        "download-progress",
        serde_json::json!({
            "modelId": id,
            "status": "deleted",
        }),
    );

    Ok(())
}

/// Clean up partial download files and ModelScope cache for a model.
fn cleanup_download_cache(app: &AppHandle, model_id: &str) {
    // 1. Clean up files in the models directory
    if let Ok(local_dir) = get_models_download_dir(app) {
        let dir_path = std::path::Path::new(&local_dir);
        if dir_path.exists() {
            // Remove any partial files (files that might have been downloaded)
            if let Ok(entries) = fs::read_dir(dir_path) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    // Remove .gguf files that might be partial downloads
                    if path.is_file() {
                        if let Some(ext) = path.extension() {
                            if ext == "gguf" || ext == "bin" || ext == "safetensors" {
                                // Check if this file belongs to our model
                                if let Some(model) = model_store::load(app, model_id) {
                                    if path
                                        .file_name()
                                        .and_then(|n| n.to_str())
                                        .map(|n| n == model.filename || n.starts_with(&model.filename))
                                        .unwrap_or(false)
                                    {
                                        let _ = fs::remove_file(&path);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // 2. Clean up ModelScope cache for the repo
    // Try to use Python to clean the cache
    if let Some(model) = model_store::load(app, model_id) {
        if let Some(repo_id) = &model.repo_id {
            let resource_dir = app.path().resource_dir().ok();
            if let Some(res_dir) = resource_dir {
                let cleanup_script = res_dir.join("python").join("cleanup_cache.py");
                if cleanup_script.exists() {
                    let mut cmd = std::process::Command::new("python");
                    cmd.env("PYTHONIOENCODING", "utf-8")
                        .arg(cleanup_script.to_str().unwrap_or("cleanup_cache.py"))
                        .arg(repo_id)
                        .stdout(std::process::Stdio::null())
                        .stderr(std::process::Stdio::null());
                    hide_window(&mut cmd);
                    let _ = cmd.status();
                }
            }
        }
    }
}

/// Search for models on ModelScope using the Python modelscope library.
#[tauri::command]
pub fn search_hf_models(app: AppHandle, query: String) -> Result<Vec<HFModelInfo>, String> {
    if query.trim().is_empty() {
        return Err("搜索关键词不能为空".to_string());
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("获取资源目录失败: {}", e))?;
    let script_path = resource_dir.join("python").join("search_models.py");

    let mut cmd = std::process::Command::new("python");
    cmd.env("PYTHONIOENCODING", "utf-8")
        .arg(script_path.to_str().unwrap_or("search_models.py"))
        .arg(query.trim())
        .arg("--limit")
        .arg("20")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    hide_window(&mut cmd);

    let output = cmd.output().map_err(|e| format!("启动 Python 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
            if let Some(err) = json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("搜索失败: {}", err));
            }
        }
        return Err(format!("搜索失败: {}", stderr));
    }

    // Log stderr for debugging (Python script writes progress/info to stderr)
    let stderr = String::from_utf8_lossy(&output.stderr);
    for line in stderr.lines() {
        eprintln!("[search_models] {}", line);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("解析搜索结果失败: {}", e))?;

    if let Some(err) = parsed.get("error").and_then(|e| e.as_str()) {
        return Err(format!("搜索失败: {}", err));
    }

    let arr = parsed
        .as_array()
        .ok_or_else(|| "搜索结果格式异常".to_string())?;

    let models: Vec<HFModelInfo> = arr
        .iter()
        .filter_map(|item| {
            let model_id = item.get("model_id")?.as_str()?.to_string();
            if model_id.is_empty() {
                return None;
            }
            Some(HFModelInfo {
                model_id: model_id.clone(),
                repo_id: model_id,
                author: item.get("author").and_then(|v| v.as_str()).map(|s| s.to_string()),
                description: item.get("description").and_then(|v| v.as_str()).map(|s| s.to_string()),
                pipeline_tag: item.get("pipeline_tag").and_then(|v| v.as_str()).map(|s| s.to_string()),
                downloads: item.get("downloads").and_then(|v| v.as_i64()),
                likes: item.get("likes").and_then(|v| v.as_i64()),
                tags: item.get("tags").and_then(|v| {
                    v.as_array().map(|arr| {
                        arr.iter()
                            .filter_map(|t| t.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                }),
                last_modified: item.get("last_modified").and_then(|v| v.as_str()).map(|s| s.to_string()),
                total_size_bytes: item.get("total_size_bytes").and_then(|v| v.as_u64()),
            })
        })
        .collect();

    Ok(models)
}

/// List all files in a ModelScope repository.
///
/// Uses the Python `modelscope` library to fetch the real file list,
/// so the frontend can show actual available files for the user to choose from.
#[tauri::command]
pub fn list_repo_files(app: AppHandle, repo_id: String) -> Result<Vec<HFRepoFile>, String> {
    if repo_id.trim().is_empty() {
        return Err("仓库 ID 不能为空".to_string());
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("获取资源目录失败: {}", e))?;
    let script_path = resource_dir.join("python").join("list_repo_files.py");

    let mut cmd = std::process::Command::new("python");
    cmd.env("PYTHONIOENCODING", "utf-8")
        .arg(script_path.to_str().unwrap_or("list_repo_files.py"))
        .arg(repo_id.trim())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    hide_window(&mut cmd);

    let output = cmd.output().map_err(|e| format!("启动 Python 失败: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Try to parse error from stdout (our script outputs JSON errors)
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
            if let Some(err) = json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("获取文件列表失败: {}", err));
            }
        }
        return Err(format!("获取文件列表失败: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("解析文件列表失败: {}", e))?;

    // Check for error in the JSON response
    if let Some(err) = parsed.get("error").and_then(|e| e.as_str()) {
        return Err(format!("获取文件列表失败: {}", err));
    }

    let arr = parsed
        .as_array()
        .ok_or_else(|| "文件列表格式异常".to_string())?;

    let files: Vec<HFRepoFile> = arr
        .iter()
        .filter_map(|item| {
            let filename = item.get("filename")?.as_str()?.to_string();
            let size = item.get("size").and_then(|s| s.as_u64());
            Some(HFRepoFile { filename, size })
        })
        .collect();

    Ok(files)
}

/// Cached catalog entry returned to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct CachedCatalogEntry {
    pub repo_id: String,
    pub valid: bool,
    pub gguf_files: Vec<HFRepoFile>,
    pub actual_repo_id: Option<String>,
    pub error: Option<String>,
    pub checked_at: u64,
}

/// Refresh the model catalog cache by validating all repos against ModelScope.
///
/// Accepts a list of repo IDs, runs the Python check script, and saves
/// the results to a local JSON cache file. Returns the updated cache.
#[tauri::command]
pub async fn refresh_model_catalog(
    app: AppHandle,
    repo_ids: Vec<String>,
) -> Result<Vec<CachedCatalogEntry>, String> {
    use crate::storage::catalog_cache::{CachedGgufFile, CachedRepoInfo, CatalogCache};
    use tokio::process::Command;

    if repo_ids.is_empty() {
        // Return existing cache
        let cache = catalog_cache::load(&app);
        return Ok(cache_to_entries(cache));
    }

    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("获取资源目录失败: {}", e))?;
    let script_path = resource_dir.join("python").join("check_model_catalog.py");

    let repos_json = serde_json::to_string(&repo_ids).map_err(|e| e.to_string())?;

    let mut cmd = Command::new("python");
    cmd.env("PYTHONIOENCODING", "utf-8")
        .arg(script_path.to_str().unwrap_or("check_model_catalog.py"))
        .arg("--repos")
        .arg(&repos_json)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());
    hide_window_tokio(&mut cmd);

    let output = cmd.output().await.map_err(|e| format!("启动 Python 失败: {}", e))?;

    // Forward stderr to console for debugging
    let stderr = String::from_utf8_lossy(&output.stderr);
    for line in stderr.lines() {
        eprintln!("[check_catalog] {}", line);
    }

    if !output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout);
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&stdout) {
            if let Some(err) = json.get("error").and_then(|e| e.as_str()) {
                return Err(format!("验证模型目录失败: {}", err));
            }
        }
        return Err(format!("验证模型目录失败: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let parsed: serde_json::Value =
        serde_json::from_str(&stdout).map_err(|e| format!("解析验证结果失败: {}", e))?;

    if let Some(err) = parsed.get("error").and_then(|e| e.as_str()) {
        return Err(format!("验证模型目录失败: {}", err));
    }

    // Build the cache from the Python output
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    let obj = parsed.as_object().ok_or("验证结果格式异常")?;
    let mut cache = CatalogCache::default();
    cache.refreshed_at = now;

    for (repo_id, value) in obj {
        let valid = value.get("valid").and_then(|v| v.as_bool()).unwrap_or(false);
        let actual_repo_id = value
            .get("actualRepoId")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let error = value
            .get("error")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let gguf_files: Vec<CachedGgufFile> = value
            .get("ggufFiles")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        let filename = item.get("filename")?.as_str()?.to_string();
                        let size = item.get("size").and_then(|s| s.as_u64());
                        Some(CachedGgufFile { filename, size })
                    })
                    .collect()
            })
            .unwrap_or_default();

        cache.repos.insert(
            repo_id.clone(),
            CachedRepoInfo {
                valid,
                gguf_files,
                actual_repo_id,
                error,
                checked_at: now,
            },
        );
    }

    // Save to disk
    catalog_cache::save(&app, &cache)?;

    Ok(cache_to_entries(cache))
}

/// Get the cached model catalog without refreshing.
#[tauri::command]
pub fn get_cached_catalog(app: AppHandle) -> Vec<CachedCatalogEntry> {
    let cache = catalog_cache::load(&app);
    cache_to_entries(cache)
}

/// Convert CatalogCache to a Vec of entries for the frontend.
fn cache_to_entries(
    cache: crate::storage::catalog_cache::CatalogCache,
) -> Vec<CachedCatalogEntry> {
    cache
        .repos
        .into_iter()
        .map(|(repo_id, info)| CachedCatalogEntry {
            repo_id,
            valid: info.valid,
            gguf_files: info
                .gguf_files
                .into_iter()
                .map(|f| HFRepoFile {
                    filename: f.filename,
                    size: f.size,
                })
                .collect(),
            actual_repo_id: info.actual_repo_id,
            error: info.error,
            checked_at: info.checked_at,
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pick_recommended_filename_q4km() {
        let files = vec![
            "model-Q4_K_M.gguf".to_string(),
            "model-Q8_0.gguf".to_string(),
        ];
        assert_eq!(pick_recommended_filename(&files), "model-Q4_K_M.gguf");
    }

    #[test]
    fn test_pick_recommended_filename_fallback() {
        let files = vec![
            "model-Q8_0.gguf".to_string(),
            "model-fp16.gguf".to_string(),
        ];
        assert_eq!(pick_recommended_filename(&files), "model-Q8_0.gguf");
    }

    #[test]
    fn test_pick_recommended_filename_no_gguf() {
        let files: Vec<String> = vec![];
        assert_eq!(pick_recommended_filename(&files), "");
    }

    #[test]
    fn test_pick_companion_filename_finds_mmproj() {
        let files = vec![
            "Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf".to_string(),
            "mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf".to_string(),
        ];
        assert_eq!(
            pick_companion_filename(&files),
            Some("mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf".to_string())
        );
    }

    #[test]
    fn test_pick_companion_filename_case_insensitive() {
        let files = vec!["MMPROJ-model-f16.GGUF".to_string()];
        assert_eq!(
            pick_companion_filename(&files),
            Some("MMPROJ-model-f16.GGUF".to_string())
        );
    }

    #[test]
    fn test_pick_companion_filename_none_for_text_model() {
        let files = vec![
            "Qwen2.5-7B-Instruct-Q4_K_M.gguf".to_string(),
            "Qwen2.5-7B-Instruct-Q8_0.gguf".to_string(),
        ];
        assert_eq!(pick_companion_filename(&files), None);
    }

    #[test]
    fn test_pick_companion_filename_ignores_non_gguf() {
        let files = vec!["mmproj-model.pt".to_string(), "config.json".to_string()];
        assert_eq!(pick_companion_filename(&files), None);
    }
}
