use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HardwareInfo {
    pub cpu_cores: u32,
    pub total_memory_gb: f64,
    pub gpu_info: Vec<GpuInfo>,
    pub os: String,
    pub os_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GpuInfo {
    pub name: String,
    pub vram_gb: Option<f64>,
    pub driver_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelRecommendation {
    pub repo_id: String,
    pub name: String,
    pub description: String,
    pub min_ram_gb: f64,
    pub min_vram_gb: f64,
    pub quantization: String,
    pub file_size: String,
    pub tags: Vec<String>,
    pub performance: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hardware_info_creation_and_field_access() {
        let gpu = GpuInfo {
            name: "NVIDIA GeForce RTX 4090".to_string(),
            vram_gb: Some(24.0),
            driver_version: Some("535.98".to_string()),
        };
        let info = HardwareInfo {
            cpu_cores: 16,
            total_memory_gb: 32.0,
            gpu_info: vec![gpu],
            os: "Windows".to_string(),
            os_version: "10.0.22621".to_string(),
        };
        assert_eq!(info.cpu_cores, 16);
        assert_eq!(info.total_memory_gb, 32.0);
        assert_eq!(info.os, "Windows");
        assert_eq!(info.os_version, "10.0.22621");
        assert_eq!(info.gpu_info.len(), 1);
    }

    #[test]
    fn test_gpu_info_creation_and_field_access() {
        let gpu = GpuInfo {
            name: "NVIDIA GeForce RTX 4090".to_string(),
            vram_gb: Some(24.0),
            driver_version: Some("535.98".to_string()),
        };
        assert_eq!(gpu.name, "NVIDIA GeForce RTX 4090");
        assert_eq!(gpu.vram_gb, Some(24.0));
        assert_eq!(gpu.driver_version, Some("535.98".to_string()));

        let gpu_none = GpuInfo {
            name: "Integrated GPU".to_string(),
            vram_gb: None,
            driver_version: None,
        };
        assert!(gpu_none.vram_gb.is_none());
        assert!(gpu_none.driver_version.is_none());
    }

    #[test]
    fn test_model_recommendation_creation_and_field_access() {
        let rec = ModelRecommendation {
            repo_id: "TheBloke/TinyLlama-1.1B-Chat-GGUF".to_string(),
            name: "TinyLlama 1.1B".to_string(),
            description: "轻量级模型".to_string(),
            min_ram_gb: 2.0,
            min_vram_gb: 0.0,
            quantization: "Q4_K_M".to_string(),
            file_size: "~0.8 GB".to_string(),
            tags: vec!["chat".to_string(), "轻量".to_string()],
            performance: "快速".to_string(),
        };
        assert_eq!(rec.repo_id, "TheBloke/TinyLlama-1.1B-Chat-GGUF");
        assert_eq!(rec.name, "TinyLlama 1.1B");
        assert_eq!(rec.min_ram_gb, 2.0);
        assert_eq!(rec.min_vram_gb, 0.0);
        assert_eq!(rec.quantization, "Q4_K_M");
        assert_eq!(rec.tags.len(), 2);
        assert_eq!(rec.performance, "快速");
    }

    #[test]
    fn test_hardware_info_serialization_roundtrip() {
        let gpu = GpuInfo {
            name: "NVIDIA GeForce RTX 4090".to_string(),
            vram_gb: Some(24.0),
            driver_version: Some("535.98".to_string()),
        };
        let info = HardwareInfo {
            cpu_cores: 16,
            total_memory_gb: 32.0,
            gpu_info: vec![gpu],
            os: "Windows".to_string(),
            os_version: "10.0.22621".to_string(),
        };
        let serialized = serde_json::to_string(&info).unwrap();
        let deserialized: HardwareInfo = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.cpu_cores, info.cpu_cores);
        assert_eq!(deserialized.total_memory_gb, info.total_memory_gb);
        assert_eq!(deserialized.os, info.os);
        assert_eq!(deserialized.gpu_info.len(), 1);
        assert_eq!(deserialized.gpu_info[0].name, "NVIDIA GeForce RTX 4090");
        assert_eq!(deserialized.gpu_info[0].vram_gb, Some(24.0));
    }

    #[test]
    fn test_recommendation_serialization_roundtrip() {
        let rec = ModelRecommendation {
            repo_id: "test/repo".to_string(),
            name: "Test Model".to_string(),
            description: "A test model".to_string(),
            min_ram_gb: 4.0,
            min_vram_gb: 2.0,
            quantization: "Q4_K_M".to_string(),
            file_size: "~4 GB".to_string(),
            tags: vec!["test".to_string()],
            performance: "fast".to_string(),
        };
        let serialized = serde_json::to_string(&rec).unwrap();
        let deserialized: ModelRecommendation = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized.repo_id, rec.repo_id);
        assert_eq!(deserialized.min_ram_gb, rec.min_ram_gb);
        assert_eq!(deserialized.min_vram_gb, rec.min_vram_gb);
        assert_eq!(deserialized.tags, rec.tags);
        assert_eq!(deserialized.performance, rec.performance);
    }
}
