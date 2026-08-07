import { describe, it, expect } from 'vitest';
import type { HardwareInfo, GPUInfo, HardwareLevel, ModelRecommendation } from '../../types';

describe('Hardware Types', () => {
  describe('HardwareInfo', () => {
    it('should create a valid hardware info', () => {
      const info: HardwareInfo = {
        cpuCores: 8,
        totalMemory: 16_000_000_000,
        availableMemory: 12_000_000_000,
        gpuInfo: [],
      };
      expect(info.cpuCores).toBe(8);
      expect(info.totalMemory).toBeGreaterThan(info.availableMemory);
    });

    it('should support GPU info', () => {
      const gpu: GPUInfo = {
        name: 'NVIDIA GeForce RTX 4060',
        memoryTotal: 8_000_000_000,
        memoryFree: 6_000_000_000,
        computeCapability: '8.9',
      };
      const info: HardwareInfo = {
        cpuCores: 8,
        totalMemory: 32_000_000_000,
        availableMemory: 24_000_000_000,
        gpuInfo: [gpu],
      };
      expect(info.gpuInfo).toHaveLength(1);
      expect(info.gpuInfo[0].name).toContain('NVIDIA');
    });
  });

  describe('HardwareLevel', () => {
    it('should support all hardware levels', () => {
      const levels: HardwareLevel[] = ['low', 'medium', 'high'];
      expect(levels).toHaveLength(3);
    });
  });

  describe('ModelRecommendation', () => {
    it('should create a valid recommendation', () => {
      const rec: ModelRecommendation = {
        repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
        name: 'Qwen2.5-7B',
        description: '通义千问 2.5 7B 指令模型',
        parameterCount: 7,
        minRam: 8_000_000_000,
        minVram: 4_000_000_000,
        quantizations: ['Q3_K_M', 'Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
        quantSizes: [3.2e9, 4.3e9, 5.0e9, 5.9e9, 7.4e9],
        category: 'chat',
        hardwareLevel: 'medium',
        requiresGpu: true,
      };
      expect(rec.hardwareLevel).toBe('medium');
      expect(rec.minRam).toBeGreaterThan(0);
      expect(rec.requiresGpu).toBe(true);
      expect(rec.quantizations).toHaveLength(5);
    });

    it('should support CPU-only recommendations', () => {
      const rec: ModelRecommendation = {
        repoId: 'Qwen/Qwen2.5-1.5B-Instruct-GGUF',
        name: 'Qwen2.5-1.5B',
        description: '轻量级模型',
        parameterCount: 1.5,
        minRam: 4_000_000_000,
        minVram: 0,
        quantizations: ['Q4_K_M', 'Q5_K_M', 'Q6_K', 'Q8_0'],
        quantSizes: [1.0e9, 1.2e9, 1.4e9, 1.8e9],
        category: 'chat',
        hardwareLevel: 'low',
        requiresGpu: false,
      };
      expect(rec.requiresGpu).toBe(false);
      expect(rec.minVram).toBe(0);
    });
  });
});
