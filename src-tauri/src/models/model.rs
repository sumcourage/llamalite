use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModel {
    pub id: String,
    pub repo_id: Option<String>,
    pub filename: String,
    pub local_path: String,
    pub size_bytes: u64,
    pub quantization: Option<String>,
    pub downloaded_at: String,
    pub metadata: ModelMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelMetadata {
    pub description: Option<String>,
    pub tags: Vec<String>,
    /// Local path of the multimodal projector downloaded alongside this model.
    /// Vision models (OCR, image understanding) need it to accept image input.
    #[serde(default)]
    pub mmproj_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HFModelInfo {
    pub model_id: String,
    /// Same as model_id, provided for frontend compatibility.
    pub repo_id: String,
    pub author: Option<String>,
    pub description: Option<String>,
    pub pipeline_tag: Option<String>,
    pub downloads: Option<i64>,
    pub likes: Option<i64>,
    pub tags: Option<Vec<String>>,
    pub last_modified: Option<String>,
    /// Total size of all .gguf files in the repo (bytes).
    pub total_size_bytes: Option<u64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_local_model_creation_and_field_access() {
        let metadata = ModelMetadata {
            description: Some("A test model".to_string()),
            tags: vec!["chat".to_string(), "test".to_string()],
            mmproj_path: None,
        };
        let model = LocalModel {
            id: "test-id-123".to_string(),
            repo_id: Some("test/repo".to_string()),
            filename: "model.gguf".to_string(),
            local_path: "/path/to/model.gguf".to_string(),
            size_bytes: 4_000_000_000,
            quantization: Some("Q4_K_M".to_string()),
            downloaded_at: "2024-01-01 12:00:00".to_string(),
            metadata,
        };
        assert_eq!(model.id, "test-id-123");
        assert_eq!(model.repo_id, Some("test/repo".to_string()));
        assert_eq!(model.filename, "model.gguf");
        assert_eq!(model.local_path, "/path/to/model.gguf");
        assert_eq!(model.size_bytes, 4_000_000_000);
        assert_eq!(model.quantization, Some("Q4_K_M".to_string()));
        assert_eq!(model.downloaded_at, "2024-01-01 12:00:00");
        assert!(model.metadata.description.is_some());
        assert_eq!(model.metadata.tags.len(), 2);
        assert!(model.metadata.mmproj_path.is_none());
    }

    #[test]
    fn test_local_model_optional_fields() {
        let metadata = ModelMetadata {
            description: None,
            tags: vec![],
            mmproj_path: None,
        };
        let model = LocalModel {
            id: "test-id".to_string(),
            repo_id: None,
            filename: "model.bin".to_string(),
            local_path: "/tmp/model.bin".to_string(),
            size_bytes: 0,
            quantization: None,
            downloaded_at: "2024-01-01".to_string(),
            metadata,
        };
        assert!(model.repo_id.is_none());
        assert!(model.quantization.is_none());
        assert!(model.metadata.description.is_none());
        assert!(model.metadata.tags.is_empty());
    }

    #[test]
    fn test_model_metadata_creation_and_field_access() {
        let metadata = ModelMetadata {
            description: Some("A description".to_string()),
            tags: vec!["tag1".to_string(), "tag2".to_string(), "tag3".to_string()],
            mmproj_path: Some("/path/to/mmproj.gguf".to_string()),
        };
        assert_eq!(metadata.description, Some("A description".to_string()));
        assert_eq!(metadata.tags.len(), 3);
        assert!(metadata.tags.contains(&"tag1".to_string()));
        assert_eq!(
            metadata.mmproj_path,
            Some("/path/to/mmproj.gguf".to_string())
        );
    }

    #[test]
    fn test_hf_model_info_creation_and_field_access() {
        let info = HFModelInfo {
            model_id: "test/model".to_string(),
            repo_id: "test/model".to_string(),
            author: Some("test-author".to_string()),
            description: Some("A test model".to_string()),
            pipeline_tag: Some("text-generation".to_string()),
            downloads: Some(1000),
            likes: Some(50),
            tags: Some(vec!["gguf".to_string(), "chat".to_string()]),
            last_modified: Some("2024-01-01T00:00:00Z".to_string()),
            total_size_bytes: Some(4_000_000_000),
        };
        assert_eq!(info.model_id, "test/model");
        assert_eq!(info.author, Some("test-author".to_string()));
        assert_eq!(info.pipeline_tag, Some("text-generation".to_string()));
        assert_eq!(info.downloads, Some(1000));
        assert_eq!(info.likes, Some(50));
        assert_eq!(info.tags.as_ref().unwrap().len(), 2);
        assert_eq!(info.total_size_bytes, Some(4_000_000_000));
    }

    #[test]
    fn test_hf_model_info_optional_fields() {
        let info = HFModelInfo {
            model_id: "test/model".to_string(),
            repo_id: "test/model".to_string(),
            author: None,
            description: None,
            pipeline_tag: None,
            downloads: None,
            likes: None,
            tags: None,
            last_modified: None,
            total_size_bytes: None,
        };
        assert!(info.pipeline_tag.is_none());
        assert!(info.downloads.is_none());
        assert!(info.author.is_none());
        assert!(info.total_size_bytes.is_none());
    }

    #[test]
    fn test_local_model_serialization_roundtrip() {
        let model = LocalModel {
            id: "test-id".to_string(),
            repo_id: Some("test/repo".to_string()),
            filename: "model.gguf".to_string(),
            local_path: "/path/to/model.gguf".to_string(),
            size_bytes: 1024,
            quantization: Some("Q4_0".to_string()),
            downloaded_at: "2024-01-01".to_string(),
            metadata: ModelMetadata {
                description: Some("desc".to_string()),
                tags: vec!["a".to_string()],
                mmproj_path: Some("/path/to/mmproj.gguf".to_string()),
            },
        };
        let json = serde_json::to_string(&model).unwrap();
        let deserialized: LocalModel = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.id, model.id);
        assert_eq!(deserialized.repo_id, model.repo_id);
        assert_eq!(deserialized.filename, model.filename);
        assert_eq!(deserialized.local_path, model.local_path);
        assert_eq!(deserialized.size_bytes, model.size_bytes);
        assert_eq!(
            deserialized.metadata.description,
            model.metadata.description
        );
        assert_eq!(deserialized.metadata.mmproj_path, model.metadata.mmproj_path);
    }

    #[test]
    fn test_model_metadata_deserializes_without_mmproj_path() {
        // Old records written before mmproj_path existed must still deserialize.
        let json = r#"{"description":"old","tags":["chat"]}"#;
        let metadata: ModelMetadata = serde_json::from_str(json).unwrap();
        assert_eq!(metadata.description, Some("old".to_string()));
        assert_eq!(metadata.tags, vec!["chat".to_string()]);
        assert!(metadata.mmproj_path.is_none());
    }

    #[test]
    fn test_hf_model_info_serialization_roundtrip() {
        let info = HFModelInfo {
            model_id: "test/model".to_string(),
            repo_id: "test/model".to_string(),
            author: Some("author".to_string()),
            description: Some("desc".to_string()),
            pipeline_tag: Some("text-generation".to_string()),
            downloads: Some(5000),
            likes: Some(200),
            tags: Some(vec!["gguf".to_string()]),
            last_modified: Some("2024-01-01".to_string()),
            total_size_bytes: Some(8_589_934_592),
        };
        let json = serde_json::to_string(&info).unwrap();
        let deserialized: HFModelInfo = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.model_id, info.model_id);
        assert_eq!(deserialized.pipeline_tag, info.pipeline_tag);
        assert_eq!(deserialized.downloads, info.downloads);
        assert_eq!(deserialized.likes, info.likes);
        assert_eq!(deserialized.total_size_bytes, info.total_size_bytes);
    }
}
