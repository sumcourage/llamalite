export interface HardwareInfo {
  cpuCores: number;
  totalMemory: number; // bytes
  availableMemory: number; // bytes
  gpuInfo: GPUInfo[];
}

export interface GPUInfo {
  name: string;
  memoryTotal: number; // bytes
  memoryFree: number; // bytes
  computeCapability?: string;
}

export type HardwareLevel = 'low' | 'medium' | 'high';

/** 模型基础定义（不含运行时评分） */
export interface ModelRecommendation {
  repoId: string;
  name: string;
  description: string;
  /** 模型参数量（十亿），如 1.5, 7, 14, 32, 70 */
  parameterCount: number;
  /** 推荐的最低 RAM（bytes） */
  minRam: number;
  /** 推荐的最低 VRAM（bytes），0 表示纯 CPU 可跑 */
  minVram: number;
  /** 该模型可用的量化级别，从小到大排列 */
  quantizations: string[];
  /** 每个量化级别对应的文件大小（bytes），与 quantizations 一一对应 */
  quantSizes: number[];
  /** 模型类别标签 */
  category: 'chat' | 'code' | 'reasoning' | 'multilingual' | 'general';
  /** 基础硬件档位（仅用于 UI 标签展示） */
  hardwareLevel: HardwareLevel;
  requiresGpu: boolean;
}

/** 带运行时评分的推荐结果 */
export interface ScoredRecommendation extends ModelRecommendation {
  /** 0-100 综合适配分 */
  fitScore: number;
  /** 根据当前硬件动态选定的量化级别 */
  dynamicQuantization: string;
  /** 动态选定的文件大小 */
  dynamicSize: number;
  /** 适配等级 */
  fitLevel: 'perfect' | 'good' | 'marginal';
}

/** 缓存的仓库 GGUF 文件信息 */
export interface CachedGgufFile {
  filename: string;
  size: number | null;
}

/** 缓存的模型目录条目 */
export interface CachedCatalogEntry {
  repoId: string;
  valid: boolean;
  ggufFiles: CachedGgufFile[];
  actualRepoId: string | null;
  error: string | null;
  checkedAt: number;
}

