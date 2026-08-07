import type {
  ModelRecommendation,
  ScoredRecommendation,
  CachedCatalogEntry,
} from '../types';

const GB = 1073741824;

// ─── 完整模型目录 ──────────────────────────────────────────────────────────
// 所有模型集中定义，按参数量从小到大排列
// quantizations / quantSizes 对应 QUANT_LEVELS 中的子集
export const MODEL_CATALOG: ModelRecommendation[] = [
  // ── 1B-2B 轻量级 ──────────────────────────────────────────────────────
  {
    repoId: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
    name: 'Qwen2.5-1.5B',
    description: '通义千问 2.5 1.5B，轻量高效，适合基础对话和文本生成',
    parameterCount: 1.5,
    minRam: 4 * GB,
    minVram: 0,
    quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [1.0 * GB, 1.2 * GB, 1.4 * GB, 1.8 * GB],
    category: 'chat',
    hardwareLevel: 'low',
    requiresGpu: false,
  },
  {
    repoId: 'unsloth/Llama-3.2-1B-Instruct-GGUF',
    name: 'Llama-3.2-1B',
    description: 'Meta Llama 3.2 1B，低资源设备流畅运行',
    parameterCount: 1,
    minRam: 3 * GB,
    minVram: 0,
    quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [0.7 * GB, 0.85 * GB, 1.0 * GB, 1.2 * GB],
    category: 'general',
    hardwareLevel: 'low',
    requiresGpu: false,
  },
  {
    repoId: 'second-state/gemma-2-2b-it-GGUF',
    name: 'Gemma-2-2B',
    description: 'Google Gemma 2 2B，基于 Google 最新研究成果',
    parameterCount: 2,
    minRam: 4 * GB,
    minVram: 0,
    quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [1.5 * GB, 1.8 * GB, 2.1 * GB, 2.6 * GB],
    category: 'general',
    hardwareLevel: 'low',
    requiresGpu: false,
  },
  // ── 3B-4B 中等轻量 ────────────────────────────────────────────────────
  {
    repoId: 'microsoft/Phi-3-mini-4k-instruct-gguf',
    name: 'Phi-3-mini',
    description: '微软 Phi-3 3.8B，代码和推理能力出色',
    parameterCount: 3.8,
    minRam: 6 * GB,
    minVram: 0,
    quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [2.3 * GB, 2.7 * GB, 3.2 * GB, 4.0 * GB],
    category: 'reasoning',
    hardwareLevel: 'low',
    requiresGpu: false,
  },
  // ── 7B-8B 主流级 ──────────────────────────────────────────────────────
  {
    repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
    name: 'Qwen2.5-7B',
    description: '通义千问 2.5 7B，中英文能力均衡，综合性能优异',
    parameterCount: 7,
    minRam: 8 * GB,
    minVram: 4 * GB,
    quantizations: ['Q3_K_M', 'Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [3.2 * GB, 4.3 * GB, 5.0 * GB, 5.9 * GB, 7.4 * GB],
    category: 'chat',
    hardwareLevel: 'medium',
    requiresGpu: true,
  },
  {
    repoId: 'LLM-Research/Meta-Llama-3.1-8B-Instruct-GGUF',
    name: 'Llama-3.1-8B',
    description: 'Meta Llama 3.1 8B，开源社区标杆，多语言支持优秀',
    parameterCount: 8,
    minRam: 8 * GB,
    minVram: 4 * GB,
    quantizations: ['Q3_K_M', 'Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [3.6 * GB, 4.9 * GB, 5.7 * GB, 6.7 * GB, 8.4 * GB],
    category: 'multilingual',
    hardwareLevel: 'medium',
    requiresGpu: true,
  },
  {
    repoId: 'MaziyarPanahi/Mistral-7B-Instruct-v0.3-GGUF',
    name: 'Mistral-7B',
    description: 'Mistral AI 7B，以高效架构和强大性能著称',
    parameterCount: 7,
    minRam: 8 * GB,
    minVram: 4 * GB,
    quantizations: ['Q3_K_M', 'Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [3.1 * GB, 4.3 * GB, 5.0 * GB, 5.9 * GB, 7.4 * GB],
    category: 'general',
    hardwareLevel: 'medium',
    requiresGpu: true,
  },
  {
    repoId: 'Qwen/Qwen2.5-Coder-7B-Instruct-GGUF',
    name: 'Qwen2.5-Coder-7B',
    description: '通义千问 2.5 Coder 7B，代码生成和编程能力突出，支持多种编程语言',
    parameterCount: 7,
    minRam: 8 * GB,
    minVram: 4 * GB,
    quantizations: ['Q3_K_M', 'Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [3.2 * GB, 4.5 * GB, 5.2 * GB, 6.1 * GB, 7.7 * GB],
    category: 'code',
    hardwareLevel: 'medium',
    requiresGpu: true,
  },
  // ── 14B 高性能 ────────────────────────────────────────────────────────
  {
    repoId: 'Qwen/Qwen2.5-14B-Instruct-GGUF',
    name: 'Qwen2.5-14B',
    description: '通义千问 2.5 14B，更强的理解和生成能力，适合复杂任务',
    parameterCount: 14,
    minRam: 16 * GB,
    minVram: 8 * GB,
    quantizations: ['Q3_K_M', 'Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [6.5 * GB, 8.8 * GB, 10.2 * GB, 12.0 * GB, 15.1 * GB],
    category: 'chat',
    hardwareLevel: 'high',
    requiresGpu: true,
  },
  // ── 32B 专业级 ────────────────────────────────────────────────────────
  {
    repoId: 'Qwen/Qwen2.5-32B-Instruct-GGUF',
    name: 'Qwen2.5-32B',
    description: '通义千问 2.5 32B，接近闭源大模型性能，适合专业级应用',
    parameterCount: 32,
    minRam: 24 * GB,
    minVram: 12 * GB,
    quantizations: ['Q3_K_M', 'Q4_K_M', 'Q5_K_M', 'Q6_K'],
    quantSizes: [14.5 * GB, 19.2 * GB, 22.4 * GB, 26.4 * GB],
    category: 'general',
    hardwareLevel: 'high',
    requiresGpu: true,
  },
  // ── 70B 旗舰级 ────────────────────────────────────────────────────────
  {
    repoId: 'lmstudio-community/Llama-3.3-70B-Instruct-GGUF',
    name: 'Llama-3.3-70B',
    description: 'Meta Llama 3.3 70B，顶级开源模型，性能接近 GPT-4 级别',
    parameterCount: 70,
    minRam: 48 * GB,
    minVram: 24 * GB,
    quantizations: ['Q3_K_L', 'Q4_K_M', 'Q6_K', 'Q8_0'],
    quantSizes: [33 * GB, 40 * GB, 48 * GB, 56 * GB],
    category: 'general',
    hardwareLevel: 'high',
    requiresGpu: true,
  },
];

// ─── 缓存覆盖 ─────────────────────────────────────────────────────────────

/**
 * 用本地缓存的真实数据覆盖硬编码的模型目录。
 *
 * - 如果缓存中 repoId 对应的仓库无效（valid=false），从目录中移除该模型
 * - 如果缓存中有 GGUF 文件大小信息，用它来更新 quantSizes
 * - 如果 actualRepoId 不同（使用了 -GGUF 变体），更新 repoId
 */
export function applyCatalogCache(
  catalog: ModelRecommendation[],
  cache: CachedCatalogEntry[],
): ModelRecommendation[] {
  if (!cache || cache.length === 0) {
    return catalog;
  }

  // Build a lookup map: repoId -> cache entry
  const cacheMap = new Map<string, CachedCatalogEntry>();
  for (const entry of cache) {
    cacheMap.set(entry.repoId, entry);
  }

  const result: ModelRecommendation[] = [];

  for (const model of catalog) {
    const cached = cacheMap.get(model.repoId);

    if (cached) {
      // If the cache says this repo is invalid, skip it
      if (!cached.valid) {
        continue;
      }

      // Build updated model
      const updated = { ...model };

      // Update repoId if actualRepoId differs
      if (cached.actualRepoId) {
        updated.repoId = cached.actualRepoId;
      }

      // Update quantSizes from real GGUF file sizes if available
      if (cached.ggufFiles && cached.ggufFiles.length > 0) {
        // Build a map of quantization -> file size from cache
        const quantSizeMap = new Map<string, number>();
        for (const file of cached.ggufFiles) {
          if (file.size == null) continue;
          const fname = file.filename.toUpperCase();
          // Match quantization level from filename
          for (const quant of model.quantizations) {
            const qUpper = quant.toUpperCase();
            // Check various filename patterns: Q4_K_M, q4_k_m, Q4-K-M, etc.
            if (
              fname.includes(qUpper) ||
              fname.includes(qUpper.replace(/_/g, '-')) ||
              fname.includes(qUpper.replace(/_/g, ''))
            ) {
              quantSizeMap.set(quant, file.size);
              break;
            }
          }
        }

        // Update quantSizes where we have real data
        if (quantSizeMap.size > 0) {
          updated.quantSizes = model.quantizations.map((q) => {
            const realSize = quantSizeMap.get(q);
            return realSize ?? model.quantSizes[model.quantizations.indexOf(q)] ?? 0;
          });
        }
      }

      result.push(updated);
    } else {
      // No cache entry for this model — keep it as-is (cache may be partial)
      result.push(model);
    }
  }

  return result;
}

// ─── 动态量化选择 ──────────────────────────────────────────────────────────

/**
 * 根据可用 VRAM 和模型参数量，选择最佳量化级别。
 *
 * 策略：
 * - 有 GPU 时：选 VRAM 能装下的最大量化（质量优先）
 * - 无 GPU 时：选 RAM 能装下的最大量化（CPU 推理，内存受限）
 * - 预留 15% 系统开销（KV cache、上下文等）
 */
export function selectQuantization(
  model: ModelRecommendation,
  availableVramBytes: number,
  availableRamBytes: number,
  hasGpu: boolean,
): { quantization: string; size: number } {
  const usableVram = availableVramBytes * 0.85;
  const usableRam = availableRamBytes * 0.85;

  // 从大到小遍历，选第一个能装下的
  for (let i = model.quantizations.length - 1; i >= 0; i--) {
    const quant = model.quantizations[i];
    const size = model.quantSizes[i];

    if (hasGpu && model.requiresGpu) {
      // GPU 推理：VRAM 为主要约束
      if (size <= usableVram) {
        return { quantization: quant, size };
      }
    } else {
      // CPU 推理：RAM 为主要约束
      if (size <= usableRam) {
        return { quantization: quant, size };
      }
    }
  }

  // 兜底：选最小量化（即使可能不够）
  return {
    quantization: model.quantizations[0],
    size: model.quantSizes[0],
  };
}

// ─── 评分算法 ──────────────────────────────────────────────────────────────

/**
 * 计算单个模型在给定硬件下的适配分数（0-100）。
 *
 * 评分维度：
 * 1. 内存充裕度（30 分）：可用内存 / 模型需求，越多越好但有上限
 * 2. VRAM 匹配度（30 分）：GPU 用户看 VRAM 匹配，无 GPU 看 CPU 推理可行性
 * 3. 模型能力（25 分）：参数量越大能力越强，但不能超出硬件承受范围
 * 4. CPU 优化加分（15 分）：多核 CPU 对纯 CPU 推理有额外加分
 */
function scoreModel(
  model: ModelRecommendation,
  hw: {
    totalRamGb: number;
    availRamGb: number;
    vramGb: number;
    cpuCores: number;
    hasGpu: boolean;
    gpuName: string;
  },
): { score: number; fitLevel: 'perfect' | 'good' | 'marginal' } {
  const { quantization: _q, size } = selectQuantization(
    model,
    hw.hasGpu ? hw.vramGb * GB : 0,
    hw.availRamGb * GB,
    hw.hasGpu,
  );
  void _q;

  // ── 硬性过滤：完全跑不了的模型直接 0 分 ──
  const minRamGb = model.minRam / GB;
  if (hw.availRamGb < minRamGb * 0.5) {
    return { score: 0, fitLevel: 'marginal' };
  }
  if (model.requiresGpu && !hw.hasGpu && hw.availRamGb < minRamGb * 1.5) {
    return { score: 0, fitLevel: 'marginal' };
  }

  let score = 0;

  // ── 1. 内存充裕度（30 分） ──
  const ramRatio = hw.availRamGb / minRamGb;
  if (ramRatio >= 2.0) {
    score += 30;
  } else if (ramRatio >= 1.5) {
    score += 25;
  } else if (ramRatio >= 1.0) {
    score += 18;
  } else if (ramRatio >= 0.75) {
    score += 8;
  } else {
    score += 2;
  }

  // ── 2. VRAM 匹配度（30 分） ──
  if (model.requiresGpu && hw.hasGpu) {
    // GPU 场景：VRAM 越充裕越好
    const minVramGb = model.minVram / GB;
    const vramRatio = hw.vramGb / minVramGb;
    if (vramRatio >= 2.0) {
      score += 30;
    } else if (vramRatio >= 1.5) {
      score += 25;
    } else if (vramRatio >= 1.0) {
      score += 18;
    } else if (vramRatio >= 0.75) {
      score += 8;
    } else {
      score += 2;
    }
  } else if (!model.requiresGpu) {
    // 纯 CPU 模型：不需要 VRAM，直接满分
    score += 30;
  } else {
    // 需要 GPU 但没有 GPU
    score += 5;
  }

  // ── 3. 模型能力（25 分） ──
  // 参数量越大能力越强，但不能超出硬件合理范围
  const idealParams = hw.hasGpu
    ? hw.vramGb * 1.8  // GPU 用户：每 GB VRAM 约 1.8B 参数
    : hw.availRamGb * 0.8;  // CPU 用户：每 GB RAM 约 0.8B 参数

  const paramRatio = model.parameterCount / idealParams;
  if (paramRatio >= 0.5 && paramRatio <= 1.2) {
    // 在理想范围内
    score += 25;
  } else if (paramRatio > 1.2 && paramRatio <= 1.8) {
    // 稍大但可接受
    score += 20;
  } else if (paramRatio >= 0.2 && paramRatio < 0.5) {
    // 偏小，能力不够
    score += 12;
  } else if (paramRatio > 1.8) {
    // 太大，跑不动
    score += 5;
  } else {
    score += 8;
  }

  // ── 4. CPU 优化加分（15 分） ──
  if (!model.requiresGpu || !hw.hasGpu) {
    // CPU 推理场景：核心数越多越好
    if (hw.cpuCores >= 12) {
      score += 15;
    } else if (hw.cpuCores >= 8) {
      score += 12;
    } else if (hw.cpuCores >= 6) {
      score += 8;
    } else if (hw.cpuCores >= 4) {
      score += 5;
    } else {
      score += 2;
    }
  } else {
    // GPU 推理场景：CPU 核心数不那么重要，但多核有助于预处理
    if (hw.cpuCores >= 8) {
      score += 15;
    } else if (hw.cpuCores >= 6) {
      score += 12;
    } else if (hw.cpuCores >= 4) {
      score += 8;
    } else {
      score += 5;
    }
  }

  // ── 适配等级 ──
  const fitLevel: 'perfect' | 'good' | 'marginal' =
    score >= 75 ? 'perfect' : score >= 50 ? 'good' : 'marginal';

  return { score: Math.min(100, Math.round(score)), fitLevel };
}

// ─── 主推荐函数 ─────────────────────────────────────────────────────────────

/**
 * 根据完整硬件信息动态推荐模型。
 *
 * 流程：
 * 1. 对目录中每个模型打分
 * 2. 过滤掉分数为 0 的不可行模型
 * 3. 按分数从高到低排序
 * 4. 返回最多 6 个推荐
 */
export function getRecommendationsForHardware(
  totalMemoryGb: number,
  vramGb: number,
  cpuCores: number = 4,
  availableMemoryGb?: number,
  hasGpu?: boolean,
  gpuName?: string,
  catalogOverride?: ModelRecommendation[],
): ScoredRecommendation[] {
  const availRamGb = availableMemoryGb ?? totalMemoryGb * 0.75;
  const gpu = hasGpu ?? vramGb > 0;

  const hw = {
    totalRamGb: totalMemoryGb,
    availRamGb,
    vramGb,
    cpuCores,
    hasGpu: gpu,
    gpuName: gpuName ?? '',
  };

  const catalog = catalogOverride ?? MODEL_CATALOG;
  const scored: ScoredRecommendation[] = [];

  for (const model of catalog) {
    const { score, fitLevel } = scoreModel(model, hw);
    if (score === 0) continue;

    const { quantization, size } = selectQuantization(
      model,
      gpu ? vramGb * GB : 0,
      availRamGb * GB,
      gpu,
    );

    scored.push({
      ...model,
      fitScore: score,
      dynamicQuantization: quantization,
      dynamicSize: size,
      fitLevel,
    });
  }

  // 按分数降序排列
  scored.sort((a, b) => b.fitScore - a.fitScore);

  // 最多返回 6 个
  return scored.slice(0, 6);
}

/**
 * 向后兼容：保留旧的 tier 函数（供旧代码引用）
 */
export function getHardwareTier(
  totalMemoryGb: number,
  vramGb: number,
): 'low' | 'medium' | 'high' {
  if (totalMemoryGb > 16 || vramGb > 8) {
    return 'high';
  }
  if (totalMemoryGb >= 8 || vramGb >= 4) {
    return 'medium';
  }
  return 'low';
}

/**
 * 向后兼容：旧的 RECOMMENDATIONS 导出
 */
export const RECOMMENDATIONS: Record<string, ModelRecommendation[]> = {
  low: MODEL_CATALOG.filter((m) => m.hardwareLevel === 'low'),
  medium: MODEL_CATALOG.filter((m) => m.hardwareLevel === 'medium'),
  high: MODEL_CATALOG.filter((m) => m.hardwareLevel === 'high'),
};
