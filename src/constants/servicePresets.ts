import type { ParameterValues } from '../types';

/** 快速配置的使用场景预设 */
export interface ServiceScenario {
  key: string;
  label: string;
  description: string;
  /** 该场景需要覆盖的参数（其余参数沿用默认值或硬件推荐值） */
  values: ParameterValues;
}

export const SERVICE_SCENARIOS: ServiceScenario[] = [
  {
    key: 'chat',
    label: '通用对话',
    description: '日常问答、翻译、总结，输出自然均衡',
    values: {
      temperature: 0.7,
      'top-p': 0.9,
      'top-k': 40,
      'min-p': 0.05,
      'repeat-penalty': 1.1,
      embedding: false,
      jinja: true,
    },
  },
  {
    key: 'code',
    label: '代码助手',
    description: '代码生成与补全，输出更严谨稳定',
    values: {
      temperature: 0.2,
      'top-p': 0.95,
      'top-k': 40,
      'min-p': 0.05,
      'repeat-penalty': 1.0,
      embedding: false,
      jinja: true,
    },
  },
  {
    key: 'long-context',
    label: '长文本分析',
    description: '长文档摘要、检索问答等长上下文任务',
    values: {
      temperature: 0.3,
      'top-p': 0.9,
      'top-k': 40,
      'min-p': 0.05,
      'repeat-penalty': 1.05,
      embedding: false,
      jinja: true,
    },
  },
  {
    key: 'creative',
    label: '创意写作',
    description: '故事、文案、头脑风暴，输出更发散',
    values: {
      temperature: 1.0,
      'top-p': 0.95,
      'top-k': 60,
      'min-p': 0.02,
      'repeat-penalty': 1.15,
      embedding: false,
      jinja: true,
    },
  },
  {
    key: 'embedding',
    label: '向量嵌入',
    description: '为知识库/检索提供文本向量，不输出对话',
    values: {
      embedding: true,
      pooling: 'mean',
      'ctx-size': 512,
      'batch-size': 2048,
      'ubatch-size': 512,
      jinja: false,
    },
  },
];

export const DEFAULT_SCENARIO_KEY = 'chat';

/** 快速配置中可选的上下文长度（必须为 256 的倍数） */
export const CONTEXT_SIZE_OPTIONS = [512, 2048, 4096, 8192, 16384, 32768];

/** 快速配置预览中展示的关键参数 */
export const QUICK_SUMMARY_KEYS = [
  'ctx-size',
  'n-gpu-layers',
  'threads',
  'batch-size',
  'flash-attn',
  'jinja',
  'temperature',
  'top-p',
  'port',
];

export interface HardwareProfile {
  cpuCores: number;
  totalMemoryGb: number;
  availableMemoryGb: number;
  vramGb: number;
  hasGpu: boolean;
}

/** 把持久化的值归一化，便于跨类型比较（"0.7" 与 0.7、"false" 与 false 视为相同） */
function normalize(value: unknown): boolean | number | string {
  if (typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed !== '' && !Number.isNaN(Number(trimmed))) return Number(trimmed);
    return trimmed;
  }
  return String(value);
}

function sameValue(a: unknown, b: unknown): boolean {
  const normalizedA = normalize(a);
  const normalizedB = normalize(b);
  if (typeof normalizedA === 'boolean' || typeof normalizedB === 'boolean') {
    return normalizedA === normalizedB;
  }
  if (typeof normalizedA === 'number' && typeof normalizedB === 'number') {
    return normalizedA === normalizedB;
  }
  return String(normalizedA) === String(normalizedB);
}

/** 在已保存的参数中识别当前命中的场景，未命中返回 undefined */
export function matchScenario(values: ParameterValues): string | undefined {
  const hit = SERVICE_SCENARIOS.find((scenario) =>
    Object.entries(scenario.values).every(([key, expected]) =>
      sameValue(values[key], expected),
    ),
  );
  return hit?.key;
}

/** 将场景参数合并到现有参数上（只覆盖场景声明的键） */
export function applyScenario(
  values: ParameterValues,
  scenario: ServiceScenario,
): ParameterValues {
  return { ...values, ...scenario.values };
}

/**
 * 根据硬件生成推荐参数。
 * 目标是在用户不关心参数细节时给出一套可用的配置：
 * 线程数跟随 CPU、显存足够时把模型全部卸载到 GPU 并开启 Flash Attention、
 * 上下文长度按显存/内存分档。
 */
export function buildHardwareDefaults(profile: HardwareProfile | null): ParameterValues {
  if (!profile) return {};

  const threads = Math.max(1, Math.min(profile.cpuCores || 1, 64));
  const lowMemory = !profile.hasGpu && profile.availableMemoryGb < 8;

  let ctxSize = 2048;
  if (profile.vramGb >= 16) ctxSize = 16384;
  else if (profile.vramGb >= 8) ctxSize = 8192;
  else if (profile.vramGb >= 4) ctxSize = 4096;
  else if (profile.availableMemoryGb >= 16) ctxSize = 4096;

  return {
    threads,
    'threads-batch': threads,
    'ctx-size': ctxSize,
    'n-gpu-layers': profile.hasGpu ? -1 : 0,
    'batch-size': lowMemory ? 1024 : 2048,
    'ubatch-size': lowMemory ? 256 : 512,
    'flash-attn': profile.hasGpu,
    'main-gpu': 0,
    parallel: 1,
    'cont-batching': true,
    jinja: true,
  };
}
