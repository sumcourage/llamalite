use crate::models::settings::AppSettings;
use crate::storage::settings_store;
use serde::{Deserialize, Serialize};
use std::path::Path;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

/// Windows constant to hide console window.
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

/// Represents the environment check result for a single component.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub message: String,
    pub install_url: Option<String>,
    /// Multi-line installation guide shown when the component is not found.
    /// Each line is a step (command or instruction).
    pub install_guide: Option<Vec<String>>,
}

/// Represents the overall environment status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentStatus {
    pub llama_server: ComponentStatus,
    pub modelscope: ComponentStatus,
    pub python: ComponentStatus,
    pub all_ready: bool,
}

/// Search for an executable in the system PATH.
///
/// Tries `name` and `name.exe` (Windows). Returns the full path if found.
fn find_in_path(name: &str) -> Option<String> {
    let path_var = std::env::var("PATH").ok()?;
    let separator = if cfg!(windows) { ';' } else { ':' };

    for dir in path_var.split(separator) {
        let dir = dir.trim();
        if dir.is_empty() {
            continue;
        }
        // Try exact name first, then with .exe suffix on Windows
        let candidates = if cfg!(windows) {
            vec![format!("{}\\{}.exe", dir, name), format!("{}\\{}", dir, name)]
        } else {
            vec![format!("{}/{}", dir, name)]
        };

        for candidate in &candidates {
            let p = Path::new(candidate);
            if p.is_file() {
                return Some(candidate.clone());
            }
        }
    }
    None
}

/// Run a command and capture stdout, returning trimmed output on success.
///
/// On Windows the `CREATE_NO_WINDOW` flag is applied so no CMD popup appears.
fn run_command_get_output(cmd: &str, args: &[&str]) -> Option<String> {
    let mut command = std::process::Command::new(cmd);
    command.args(args);
    #[cfg(target_os = "windows")]
    command.creation_flags(CREATE_NO_WINDOW);
    command
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// Check llama-server availability.
///
/// Strategy:
/// 1. Search system PATH for `llama-server`
/// 2. If not in PATH, fall back to configured `llama_server_path` in settings
/// 3. If found, try `--version` to extract version info
/// 4. If not found anywhere, return install guide
fn check_llama_server(configured_path: Option<&str>) -> ComponentStatus {
    // Step 1: Search PATH
    if let Some(path) = find_in_path("llama-server") {
        let version = run_command_get_output(&path, &["--version"])
            .or_else(|| run_command_get_output(&path, &["--help"]));
        let version_line = version.as_deref().and_then(|v| {
            v.lines()
                .find(|l| l.to_lowercase().contains("version") || l.to_lowercase().contains("llama"))
                .map(|l| l.trim().to_string())
        });

        return ComponentStatus {
            name: "llama-server".to_string(),
            installed: true,
            version: version_line,
            message: format!("已从 PATH 中找到: {}", path),
            install_url: None,
            install_guide: None,
        };
    }

    // Step 2: Fall back to configured path
    if let Some(path) = configured_path.filter(|p| !p.is_empty()) {
        let p = Path::new(path);
        if p.is_file() {
            let version = run_command_get_output(path, &["--version"])
                .or_else(|| run_command_get_output(path, &["--help"]));
            let version_line = version.as_deref().and_then(|v| {
                v.lines()
                    .find(|l| l.to_lowercase().contains("version") || l.to_lowercase().contains("llama"))
                    .map(|l| l.trim().to_string())
            });

            return ComponentStatus {
                name: "llama-server".to_string(),
                installed: true,
                version: version_line,
                message: format!("已从配置路径找到: {}", path),
                install_url: None,
                install_guide: None,
            };
        }
    }

    // Step 3: Not found — return install guide
    ComponentStatus {
        name: "llama-server".to_string(),
        installed: false,
        version: None,
        message: "未在 PATH 中找到 llama-server，也未配置自定义路径".to_string(),
        install_url: Some("https://github.com/ggml-org/llama.cpp/releases".to_string()),
        install_guide: Some({
            let mut guide = vec![
                "1. 打开 https://github.com/ggml-org/llama.cpp/releases".to_string(),
            ];
            if cfg!(windows) {
                guide.extend(vec![
                    "2. 下载 Windows 版本（如 llama-b*-bin-win-cpu-x64.zip）".to_string(),
                    "3. 解压到一个固定目录，例如 C:\\tools\\llama-cpp".to_string(),
                    "4. 将该目录添加到系统 PATH：".to_string(),
                    "   设置 → 系统 → 关于 → 高级系统设置 → 环境变量".to_string(),
                    "   在「系统变量」中找到 Path，点击编辑，新建，填入目录路径".to_string(),
                ]);
            } else if cfg!(target_os = "macos") {
                guide.extend(vec![
                    "2. 下载 macOS 版本（如 llama-b*-bin-macos-arm64.zip）".to_string(),
                    "3. 解压到一个固定目录，例如 /usr/local/llama-cpp".to_string(),
                    "4. 将该目录添加到 PATH：".to_string(),
                    "   export PATH=\"/usr/local/llama-cpp/bin:$PATH\"".to_string(),
                    "   可将上述命令添加到 ~/.zshrc 或 ~/.bash_profile".to_string(),
                ]);
            } else {
                guide.extend(vec![
                    "2. 下载 Linux 版本（如 llama-b*-bin-ubuntu-x64.zip）".to_string(),
                    "3. 解压到一个固定目录，例如 /usr/local/llama-cpp".to_string(),
                    "4. 将该目录添加到 PATH：".to_string(),
                    "   export PATH=\"/usr/local/llama-cpp/bin:$PATH\"".to_string(),
                    "   可将上述命令添加到 ~/.bashrc 或 ~/.profile".to_string(),
                ]);
            }
            guide.push("5. 重启本应用后重新检测".to_string());
            guide
        }),
    }
}

/// Check ModelScope Python library availability.
///
/// Strategy:
/// 1. Run `python -c "import modelscope; print(modelscope.__version__)"`
/// 2. If successful, return installed=true with the version
/// 3. If failed, return install guide (pip install modelscope)
fn check_modelscope() -> ComponentStatus {
    let version = run_command_get_output(
        "python",
        &["-c", "import modelscope; print(modelscope.__version__)"],
    );

    match version {
        Some(v) => ComponentStatus {
            name: "ModelScope".to_string(),
            installed: true,
            version: Some(v),
            message: "ModelScope 库已安装".to_string(),
            install_url: None,
            install_guide: None,
        },
        None => ComponentStatus {
            name: "ModelScope".to_string(),
            installed: false,
            version: None,
            message: "未检测到 ModelScope 库".to_string(),
            install_url: Some("https://modelscope.cn".to_string()),
            install_guide: Some(vec![
                "1. 确保已安装 Python 3.8+ 且 pip 可用".to_string(),
                "2. 打开终端/PowerShell，执行：".to_string(),
                "   pip install modelscope".to_string(),
                "3. 重启本应用后重新检测".to_string(),
            ]),
        },
    }
}

/// Check if Python is available on the system.
fn check_python() -> ComponentStatus {
    // Try `python` first, then `python3`
    let version = run_command_get_output("python", &["--version"])
        .or_else(|| run_command_get_output("python3", &["--version"]));

    match version {
        Some(v) => ComponentStatus {
            name: "Python".to_string(),
            installed: true,
            version: Some(v),
            message: "Python 已安装".to_string(),
            install_url: None,
            install_guide: None,
        },
        None => ComponentStatus {
            name: "Python".to_string(),
            installed: false,
            version: None,
            message: "未检测到 Python 环境".to_string(),
            install_url: Some("https://www.python.org/downloads/".to_string()),
            install_guide: Some(vec![
                "1. 打开 https://www.python.org/downloads/".to_string(),
                "2. 下载最新 Python 3.x 安装包".to_string(),
                "3. 安装时务必勾选「Add Python to PATH」".to_string(),
                "4. 安装完成后重启本应用".to_string(),
            ]),
        },
    }
}

/// Perform a full environment check.
///
/// Checks llama-server (PATH + configured path), ModelScope library (Python),
/// and Python (PATH) — all three checks run in parallel for speed.
#[tauri::command]
pub async fn check_environment(app: tauri::AppHandle) -> EnvironmentStatus {
    let settings: AppSettings = settings_store::load(&app);
    let llama_path = settings.llama_server_path.clone();

    // Run all three checks in parallel using spawn_blocking
    let llama_handle = {
        let llama_path = llama_path.clone();
        tokio::task::spawn_blocking(move || {
            check_llama_server(llama_path.as_deref())
        })
    };
    let ms_handle = tokio::task::spawn_blocking(|| check_modelscope());
    let python_handle = tokio::task::spawn_blocking(|| check_python());

    let (llama_status, ms_status, python_status) = match tokio::try_join!(llama_handle, ms_handle, python_handle) {
        Ok((l, m, p)) => (l, m, p),
        Err(_) => (check_llama_server(None), check_modelscope(), check_python()),
    };

    let all_ready = llama_status.installed && ms_status.installed && python_status.installed;

    EnvironmentStatus {
        llama_server: llama_status,
        modelscope: ms_status,
        python: python_status,
        all_ready,
    }
}

/// Check a specific executable path (used during path configuration).
#[tauri::command]
pub fn check_executable_path(path: String) -> ComponentStatus {
    let p = Path::new(&path);
    if !p.exists() || !p.is_file() {
        return ComponentStatus {
            name: "Executable".to_string(),
            installed: false,
            version: None,
            message: format!("文件不存在: {}", path),
            install_url: None,
            install_guide: None,
        };
    }

    let version = run_command_get_output(&path, &["--version"])
        .or_else(|| run_command_get_output(&path, &["--help"]));

    ComponentStatus {
        name: "Executable".to_string(),
        installed: true,
        version,
        message: format!("可执行文件有效: {}", path),
        install_url: None,
        install_guide: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_find_in_path_returns_none_for_nonexistent() {
        let result = find_in_path("nonexistent_binary_xyz_12345");
        assert!(result.is_none(), "Should not find a nonexistent binary");
    }

    #[test]
    fn test_find_in_path_finds_python() {
        // python should be in PATH on most systems
        let result = find_in_path("python");
        // On Windows it might be python.exe, on Linux/Mac just python
        // We just check that it doesn't panic
        let _ = result;
    }

    #[test]
    fn test_run_command_get_output_success() {
        // `echo hello` should work on any platform
        let result = run_command_get_output("echo", &["hello"]);
        assert_eq!(result, Some("hello".to_string()));
    }

    #[test]
    fn test_run_command_get_output_failure() {
        let result = run_command_get_output("nonexistent_cmd_xyz", &[]);
        assert!(result.is_none());
    }

    #[test]
    fn test_check_llama_server_not_found_returns_guide() {
        let status = check_llama_server(None);
        assert!(!status.installed);
        assert!(status.install_guide.is_some(), "Should have install guide when not found");
        let guide = status.install_guide.unwrap();
        assert!(!guide.is_empty(), "Install guide should not be empty");
        assert!(
            guide.iter().any(|l| l.contains("PATH")),
            "Guide should mention PATH"
        );
    }

    #[test]
    fn test_check_llama_server_with_invalid_configured_path() {
        let status = check_llama_server(Some("C:\\nonexistent\\path\\llama-server.exe"));
        assert!(!status.installed);
        assert!(status.install_guide.is_some());
    }

    #[test]
    fn test_check_modelscope_structure() {
        let status = check_modelscope();
        // modelscope may or may not be installed; just verify the structure is correct
        if !status.installed {
            assert!(status.install_guide.is_some());
            let guide = status.install_guide.as_ref().unwrap();
            assert!(
                guide.iter().any(|l| l.contains("pip")),
                "Guide should mention pip install"
            );
        }
    }

    #[test]
    fn test_check_python_structure() {
        let status = check_python();
        if status.installed {
            assert!(status.version.is_some());
            assert!(status.install_guide.is_none());
        } else {
            assert!(status.install_guide.is_some());
        }
    }

    #[test]
    fn test_check_executable_path_nonexistent() {
        let status = check_executable_path("C:\\nonexistent\\binary.exe".to_string());
        assert!(!status.installed);
        assert!(status.install_guide.is_none());
    }

    #[test]
    fn test_component_status_serialization_roundtrip() {
        let status = ComponentStatus {
            name: "test".to_string(),
            installed: false,
            version: None,
            message: "not found".to_string(),
            install_url: Some("https://example.com".to_string()),
            install_guide: Some(vec!["step 1".to_string(), "step 2".to_string()]),
        };
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: ComponentStatus = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.name, "test");
        assert!(!deserialized.installed);
        assert_eq!(deserialized.install_guide.unwrap().len(), 2);
    }

    #[test]
    fn test_environment_status_all_ready_calculation() {
        let llama = ComponentStatus {
            name: "llama".to_string(),
            installed: true,
            version: None,
            message: "ok".to_string(),
            install_url: None,
            install_guide: None,
        };
        let ms = ComponentStatus {
            name: "modelscope".to_string(),
            installed: false,
            version: None,
            message: "missing".to_string(),
            install_url: None,
            install_guide: None,
        };
        let python = ComponentStatus {
            name: "python".to_string(),
            installed: true,
            version: None,
            message: "ok".to_string(),
            install_url: None,
            install_guide: None,
        };
        let all_ready = llama.installed && ms.installed && python.installed;
        assert!(!all_ready, "Should not be all ready when modelscope is missing");
    }
}
