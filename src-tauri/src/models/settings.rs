use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    #[serde(alias = "models_dir")]
    pub models_dir: Option<String>,
    #[serde(alias = "llama_server_path")]
    pub llama_server_path: Option<String>,
    pub theme: String,
    pub language: String,
    #[serde(alias = "first_run")]
    pub first_run: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            models_dir: None,
            llama_server_path: None,
            theme: "dark".to_string(),
            language: "zh-CN".to_string(),
            first_run: true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_settings_default_returns_correct_defaults() {
        let settings = AppSettings::default();
        assert!(settings.models_dir.is_none());
        assert!(settings.llama_server_path.is_none());
        assert_eq!(settings.theme, "dark");
        assert_eq!(settings.language, "zh-CN");
        assert!(settings.first_run);
    }

    #[test]
    fn test_app_settings_creation_and_field_access() {
        let settings = AppSettings {
            models_dir: Some("/models".to_string()),
            llama_server_path: Some("/usr/bin/llama-server".to_string()),
            theme: "light".to_string(),
            language: "en".to_string(),
            first_run: false,
        };
        assert_eq!(settings.models_dir, Some("/models".to_string()));
        assert_eq!(
            settings.llama_server_path,
            Some("/usr/bin/llama-server".to_string())
        );
        assert_eq!(settings.theme, "light");
        assert_eq!(settings.language, "en");
        assert!(!settings.first_run);
    }

    #[test]
    fn test_serialization_roundtrip() {
        let settings = AppSettings {
            models_dir: Some("/models".to_string()),
            llama_server_path: None,
            theme: "dark".to_string(),
            language: "zh-CN".to_string(),
            first_run: false,
        };
        let json = serde_json::to_string(&settings).unwrap();
        let deserialized: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.models_dir, settings.models_dir);
        assert_eq!(deserialized.llama_server_path, settings.llama_server_path);
        assert_eq!(deserialized.theme, settings.theme);
        assert_eq!(deserialized.language, settings.language);
        assert_eq!(deserialized.first_run, settings.first_run);
    }

    #[test]
    fn test_camel_case_field_mapping() {
        let settings = AppSettings {
            models_dir: Some("/models".to_string()),
            llama_server_path: Some("/usr/bin/llama-server".to_string()),
            theme: "dark".to_string(),
            language: "zh-CN".to_string(),
            first_run: true,
        };
        let json = serde_json::to_string(&settings).unwrap();
        // Verify camelCase field names in serialized output
        assert!(
            json.contains("\"modelsDir\""),
            "Expected camelCase 'modelsDir'"
        );
        assert!(
            json.contains("\"llamaServerPath\""),
            "Expected camelCase 'llamaServerPath'"
        );
        assert!(
            json.contains("\"firstRun\""),
            "Expected camelCase 'firstRun'"
        );
        assert!(json.contains("\"theme\""), "Expected 'theme'");
        assert!(json.contains("\"language\""), "Expected 'language'");

        // Deserialize from camelCase JSON
        let deserialized: AppSettings = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.models_dir, settings.models_dir);
        assert_eq!(deserialized.theme, settings.theme);
    }

    #[test]
    fn test_deserialize_with_snake_case_aliases() {
        // Test that snake_case aliases (via #[serde(alias)]) also work
        let snake_json = r#"{
            "models_dir": "/models",
            "llama_server_path": "/usr/bin/llama-server",
            "theme": "dark",
            "language": "zh-CN",
            "first_run": false
        }"#;
        let settings: AppSettings = serde_json::from_str(snake_json).unwrap();
        assert_eq!(settings.models_dir, Some("/models".to_string()));
        assert_eq!(
            settings.llama_server_path,
            Some("/usr/bin/llama-server".to_string())
        );
        assert_eq!(settings.theme, "dark");
        assert_eq!(settings.language, "zh-CN");
        assert!(!settings.first_run);
    }
}
