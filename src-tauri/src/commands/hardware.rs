use crate::models::hardware::{GpuInfo, HardwareInfo, ModelRecommendation};
use sysinfo::System;

/// Detect the current system's hardware configuration.
///
/// Detects CPU cores, total physical memory, and operating system information.
/// GPU detection is best-effort and may return an empty list if no GPU drivers
/// are accessible from this process.
#[tauri::command]
pub fn detect_hardware() -> HardwareInfo {
    let mut sys = System::new_all();
    sys.refresh_all();

    let cpu_cores = sys.cpus().len() as u32;
    let total_memory_gb = sys.total_memory() as f64 / 1024.0 / 1024.0 / 1024.0;
    let os_version = System::long_os_version().unwrap_or_default();

    // GPU detection is limited in sysinfo; attempt to collect basic info.
    // In a production environment, consider using wmi (Windows) or nvidia-smi.
    let gpu_info: Vec<GpuInfo> = Vec::new();

    HardwareInfo {
        cpu_cores,
        total_memory_gb,
        gpu_info,
        os: std::env::consts::OS.to_string(),
        os_version,
    }
}

/// Get model recommendations based on the detected hardware.
///
/// Maps the system's total RAM to a set of suitable GGUF models.
/// Recommendations are ordered from smallest to largest.
#[tauri::command]
pub fn get_recommendations(hardware: HardwareInfo) -> Vec<ModelRecommendation> {
    let total_ram = hardware.total_memory_gb;
    let mut recommendations = Vec::new();

    // Universal: TinyLlama (works on almost any system >= 2GB RAM)
    recommendations.push(ModelRecommendation {
        repo_id: "TheBloke/TinyLlama-1.1B-Chat-GGUF".to_string(),
        name: "TinyLlama 1.1B".to_string(),
        description: "轻量级聊天模型，适合低配置设备，响应速度快".to_string(),
        min_ram_gb: 2.0,
        min_vram_gb: 0.0,
        quantization: "Q4_K_M".to_string(),
        file_size: "~0.8 GB".to_string(),
        tags: vec!["chat".to_string(), "轻量".to_string(), "快速".to_string()],
        performance: "快速".to_string(),
    });

    // 4GB+ RAM: Llama 2 7B / Qwen 7B
    if total_ram >= 4.0 {
        recommendations.push(ModelRecommendation {
            repo_id: "TheBloke/Llama-2-7B-Chat-GGUF".to_string(),
            name: "Llama 2 7B".to_string(),
            description: "Meta 的通用聊天模型，性能均衡，适合大多数场景".to_string(),
            min_ram_gb: 4.0,
            min_vram_gb: 0.0,
            quantization: "Q4_K_M".to_string(),
            file_size: "~4.0 GB".to_string(),
            tags: vec!["chat".to_string(), "通用".to_string(), "Meta".to_string()],
            performance: "中等".to_string(),
        });

        recommendations.push(ModelRecommendation {
            repo_id: "Qwen/Qwen2-7B-Instruct-GGUF".to_string(),
            name: "Qwen2 7B".to_string(),
            description: "通义千问 2 代，中文优化，指令遵循能力强".to_string(),
            min_ram_gb: 4.0,
            min_vram_gb: 0.0,
            quantization: "Q4_K_M".to_string(),
            file_size: "~4.5 GB".to_string(),
            tags: vec![
                "instruct".to_string(),
                "中文".to_string(),
                "阿里".to_string(),
            ],
            performance: "中等".to_string(),
        });
    }

    // 8GB+ RAM: CodeLlama / Mistral 7B
    if total_ram >= 8.0 {
        recommendations.push(ModelRecommendation {
            repo_id: "TheBloke/CodeLlama-7B-Instruct-GGUF".to_string(),
            name: "CodeLlama 7B".to_string(),
            description: "Meta 的代码生成模型，支持代码补全和解释".to_string(),
            min_ram_gb: 8.0,
            min_vram_gb: 0.0,
            quantization: "Q4_K_M".to_string(),
            file_size: "~4.0 GB".to_string(),
            tags: vec!["code".to_string(), "编程".to_string(), "Meta".to_string()],
            performance: "中等".to_string(),
        });

        recommendations.push(ModelRecommendation {
            repo_id: "TheBloke/Mistral-7B-Instruct-v0.3-GGUF".to_string(),
            name: "Mistral 7B v0.3".to_string(),
            description: "Mistral AI 的高性能指令模型，推理能力强".to_string(),
            min_ram_gb: 8.0,
            min_vram_gb: 0.0,
            quantization: "Q4_K_M".to_string(),
            file_size: "~4.2 GB".to_string(),
            tags: vec![
                "instruct".to_string(),
                "高性能".to_string(),
                "Mistral".to_string(),
            ],
            performance: "中等".to_string(),
        });
    }

    // 16GB+ RAM: Mixtral 8x7B / Llama 3 70B
    if total_ram >= 16.0 {
        recommendations.push(ModelRecommendation {
            repo_id: "TheBloke/Mixtral-8x7B-Instruct-v0.1-GGUF".to_string(),
            name: "Mixtral 8x7B".to_string(),
            description: "Mistral 的 MoE 混合专家模型，接近 GPT-3.5 的性能".to_string(),
            min_ram_gb: 16.0,
            min_vram_gb: 0.0,
            quantization: "Q4_K_M".to_string(),
            file_size: "~26 GB".to_string(),
            tags: vec![
                "instruct".to_string(),
                "高性能".to_string(),
                "MoE".to_string(),
            ],
            performance: "较慢".to_string(),
        });
    }

    // 32GB+ RAM: Llama 3 70B
    if total_ram >= 32.0 {
        recommendations.push(ModelRecommendation {
            repo_id: "TheBloke/Meta-Llama-3-70B-Instruct-GGUF".to_string(),
            name: "Llama 3 70B".to_string(),
            description: "Meta 最新旗舰模型，顶级性能，需大量内存".to_string(),
            min_ram_gb: 32.0,
            min_vram_gb: 0.0,
            quantization: "Q4_K_M".to_string(),
            file_size: "~40 GB".to_string(),
            tags: vec![
                "instruct".to_string(),
                "旗舰".to_string(),
                "Meta".to_string(),
            ],
            performance: "慢".to_string(),
        });
    }

    recommendations
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::hardware::{GpuInfo, HardwareInfo};

    #[test]
    fn test_get_recommendations_4gb_contains_tinyllama() {
        let hardware = HardwareInfo {
            cpu_cores: 4,
            total_memory_gb: 4.0,
            gpu_info: vec![],
            os: "Linux".to_string(),
            os_version: "".to_string(),
        };
        let recommendations = get_recommendations(hardware);
        // 4GB RAM should include TinyLlama (always present)
        assert!(
            recommendations.iter().any(|r| r.name.contains("TinyLlama")),
            "4GB RAM should include TinyLlama"
        );
    }

    #[test]
    fn test_get_recommendations_4gb_adds_llama2_and_qwen2() {
        let hardware = HardwareInfo {
            cpu_cores: 4,
            total_memory_gb: 4.0,
            gpu_info: vec![],
            os: "Linux".to_string(),
            os_version: "".to_string(),
        };
        let recommendations = get_recommendations(hardware);
        // 4GB RAM should include Llama 2 7B and Qwen2 7B
        assert!(
            recommendations.iter().any(|r| r.name.contains("Llama 2")),
            "4GB RAM should include Llama 2 7B"
        );
        assert!(
            recommendations.iter().any(|r| r.name.contains("Qwen2")),
            "4GB RAM should include Qwen2 7B"
        );
        // 4GB should NOT include 8GB+ models
        assert!(
            !recommendations.iter().any(|r| r.name.contains("CodeLlama")),
            "4GB RAM should NOT include CodeLlama"
        );
        assert!(
            !recommendations.iter().any(|r| r.name.contains("Mistral")),
            "4GB RAM should NOT include Mistral"
        );
    }

    #[test]
    fn test_get_recommendations_8gb_adds_codelama_and_mistral() {
        let hardware = HardwareInfo {
            cpu_cores: 8,
            total_memory_gb: 8.0,
            gpu_info: vec![],
            os: "Linux".to_string(),
            os_version: "".to_string(),
        };
        let recommendations = get_recommendations(hardware);
        // 8GB RAM should include CodeLlama and Mistral
        assert!(
            recommendations.iter().any(|r| r.name.contains("CodeLlama")),
            "8GB RAM should include CodeLlama"
        );
        assert!(
            recommendations.iter().any(|r| r.name.contains("Mistral")),
            "8GB RAM should include Mistral"
        );
        // 8GB should NOT include 16GB+ models
        assert!(
            !recommendations.iter().any(|r| r.name.contains("Mixtral")),
            "8GB RAM should NOT include Mixtral"
        );
    }

    #[test]
    fn test_get_recommendations_16gb_adds_mixtral() {
        let hardware = HardwareInfo {
            cpu_cores: 16,
            total_memory_gb: 16.0,
            gpu_info: vec![],
            os: "Linux".to_string(),
            os_version: "".to_string(),
        };
        let recommendations = get_recommendations(hardware);
        // 16GB RAM should include Mixtral
        assert!(
            recommendations.iter().any(|r| r.name.contains("Mixtral")),
            "16GB RAM should include Mixtral"
        );
        // 16GB should NOT include 32GB+ models
        assert!(
            !recommendations
                .iter()
                .any(|r| r.name.contains("Llama 3 70B")),
            "16GB RAM should NOT include Llama 3 70B"
        );
    }

    #[test]
    fn test_get_recommendations_32gb_adds_llama3_70b() {
        let hardware = HardwareInfo {
            cpu_cores: 32,
            total_memory_gb: 32.0,
            gpu_info: vec![],
            os: "Linux".to_string(),
            os_version: "".to_string(),
        };
        let recommendations = get_recommendations(hardware);
        // 32GB RAM should include Llama 3 70B
        assert!(
            recommendations
                .iter()
                .any(|r| r.name.contains("Llama 3 70B")),
            "32GB RAM should include Llama 3 70B"
        );
        // All previous tiers should also be included
        assert!(recommendations.iter().any(|r| r.name.contains("TinyLlama")));
        assert!(recommendations.iter().any(|r| r.name.contains("Mixtral")));
    }

    #[test]
    fn test_get_recommendations_returns_valid_struct() {
        let hardware = HardwareInfo {
            cpu_cores: 2,
            total_memory_gb: 2.0,
            gpu_info: vec![],
            os: "Linux".to_string(),
            os_version: "".to_string(),
        };
        let recommendations = get_recommendations(hardware);
        // 2GB RAM should only return TinyLlama
        assert_eq!(
            recommendations.len(),
            1,
            "2GB RAM should only return 1 recommendation"
        );
        assert!(recommendations[0].name.contains("TinyLlama"));
        // Verify all fields are populated
        let rec = &recommendations[0];
        assert!(!rec.repo_id.is_empty());
        assert!(!rec.name.is_empty());
        assert!(!rec.description.is_empty());
        assert!(!rec.quantization.is_empty());
        assert!(!rec.file_size.is_empty());
        assert!(!rec.tags.is_empty());
        assert!(!rec.performance.is_empty());
    }
}
