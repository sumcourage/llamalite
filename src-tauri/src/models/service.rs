use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceConfig {
    pub id: String,
    pub name: String,
    pub model_path: String,
    pub parameters: HashMap<String, serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
    pub last_started_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStatusInfo {
    pub id: Option<String>,
    pub status: String, // "stopped", "running", "starting", "stopping", "error"
    pub model_name: Option<String>,
    pub pid: Option<u32>,
    pub port: Option<u16>,
    pub started_at: Option<String>,
    pub error_message: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_service_config_creation_and_field_access() {
        let mut params = HashMap::new();
        params.insert("port".to_string(), serde_json::json!(8080));
        params.insert("ctx_size".to_string(), serde_json::json!(2048));
        let config = ServiceConfig {
            id: "svc-001".to_string(),
            name: "Test Service".to_string(),
            model_path: "/models/test.gguf".to_string(),
            parameters: params,
            created_at: "2024-01-01 00:00:00".to_string(),
            updated_at: "2024-01-01 00:00:00".to_string(),
            last_started_at: None,
        };
        assert_eq!(config.id, "svc-001");
        assert_eq!(config.name, "Test Service");
        assert_eq!(config.model_path, "/models/test.gguf");
        assert_eq!(config.parameters.len(), 2);
        assert!(config.last_started_at.is_none());
        assert_eq!(config.created_at, "2024-01-01 00:00:00");
        assert_eq!(config.updated_at, "2024-01-01 00:00:00");
    }

    #[test]
    fn test_service_config_with_last_started() {
        let mut params = HashMap::new();
        params.insert("port".to_string(), serde_json::json!(8080));
        let config = ServiceConfig {
            id: "svc-002".to_string(),
            name: "Running Service".to_string(),
            model_path: "/models/model.gguf".to_string(),
            parameters: params,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-02".to_string(),
            last_started_at: Some("2024-01-02 10:00:00".to_string()),
        };
        assert_eq!(
            config.last_started_at,
            Some("2024-01-02 10:00:00".to_string())
        );
    }

    #[test]
    fn test_service_status_info_creation_and_field_access() {
        let status = ServiceStatusInfo {
            status: "running".to_string(),
            id: Some("svc-001".to_string()),
            model_name: Some("Test Service".to_string()),
            pid: Some(12345),
            port: Some(8080),
            started_at: Some("2024-01-01 12:00:00".to_string()),
            error_message: None,
        };
        assert_eq!(status.status, "running");
        assert_eq!(status.id, Some("svc-001".to_string()));
        assert_eq!(status.model_name, Some("Test Service".to_string()));
        assert_eq!(status.pid, Some(12345));
        assert_eq!(status.port, Some(8080));
        assert!(status.error_message.is_none());
    }

    #[test]
    fn test_service_status_info_stopped() {
        let status = ServiceStatusInfo {
            status: "stopped".to_string(),
            id: None,
            model_name: None,
            pid: None,
            port: None,
            started_at: None,
            error_message: Some("Process exited with code 1".to_string()),
        };
        assert_eq!(status.status, "stopped");
        assert!(status.id.is_none());
        assert!(status.pid.is_none());
        assert!(status.error_message.is_some());
    }

    #[test]
    fn test_service_config_serialization_roundtrip() {
        let mut params = HashMap::new();
        params.insert("port".to_string(), serde_json::json!(8080));
        params.insert("ctx_size".to_string(), serde_json::json!(4096));
        params.insert("verbose".to_string(), serde_json::json!(true));
        let config = ServiceConfig {
            id: "svc-003".to_string(),
            name: "Serialization Test".to_string(),
            model_path: "/models/test.gguf".to_string(),
            parameters: params,
            created_at: "2024-01-01".to_string(),
            updated_at: "2024-01-01".to_string(),
            last_started_at: None,
        };
        let json = serde_json::to_string(&config).unwrap();
        let deserialized: ServiceConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, config.id);
        assert_eq!(deserialized.name, config.name);
        assert_eq!(deserialized.model_path, config.model_path);
        assert_eq!(deserialized.parameters.len(), config.parameters.len());
        assert_eq!(
            deserialized.parameters.get("port"),
            config.parameters.get("port")
        );
        assert_eq!(
            deserialized.parameters.get("ctx_size"),
            config.parameters.get("ctx_size")
        );
    }

    #[test]
    fn test_service_status_serialization_roundtrip() {
        let status = ServiceStatusInfo {
            status: "error".to_string(),
            id: Some("svc-001".to_string()),
            model_name: Some("Broken Service".to_string()),
            pid: None,
            port: None,
            started_at: None,
            error_message: Some("Out of memory".to_string()),
        };
        let json = serde_json::to_string(&status).unwrap();
        let deserialized: ServiceStatusInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.status, status.status);
        assert_eq!(deserialized.id, status.id);
        assert_eq!(deserialized.error_message, status.error_message);
        assert!(deserialized.pid.is_none());
    }

    #[test]
    fn test_hashmap_parameters_handling() {
        let mut params = HashMap::new();
        params.insert("port".to_string(), serde_json::json!(8080));
        params.insert("ctx_size".to_string(), serde_json::json!(2048));
        params.insert("verbose".to_string(), serde_json::json!(true));
        params.insert("name".to_string(), serde_json::json!("llama-server"));
        params.insert("layers".to_string(), serde_json::json!(32));

        assert_eq!(params.get("port").unwrap().as_u64(), Some(8080));
        assert_eq!(params.get("ctx_size").unwrap().as_u64(), Some(2048));
        assert_eq!(params.get("verbose").unwrap().as_bool(), Some(true));
        assert_eq!(params.get("name").unwrap().as_str(), Some("llama-server"));
        assert_eq!(params.get("layers").unwrap().as_u64(), Some(32));
        assert!(params.get("nonexistent").is_none());
    }
}
