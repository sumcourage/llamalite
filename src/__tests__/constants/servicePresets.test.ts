import { describe, it, expect } from 'vitest';
import {
  CONTEXT_SIZE_OPTIONS,
  DEFAULT_SCENARIO_KEY,
  QUICK_SUMMARY_KEYS,
  SERVICE_SCENARIOS,
  applyScenario,
  buildHardwareDefaults,
  matchScenario,
} from '../../constants/servicePresets';
import { getParameterByKey } from '../../constants/parameters';

describe('servicePresets', () => {
  describe('SERVICE_SCENARIOS', () => {
    it('should have unique keys and complete metadata', () => {
      const keys = SERVICE_SCENARIOS.map((s) => s.key);
      expect(new Set(keys).size).toBe(keys.length);
      SERVICE_SCENARIOS.forEach((scenario) => {
        expect(scenario.label.length).toBeGreaterThan(0);
        expect(scenario.description.length).toBeGreaterThan(0);
        expect(Object.keys(scenario.values).length).toBeGreaterThan(0);
      });
    });

    it('should only reference known parameter keys', () => {
      SERVICE_SCENARIOS.forEach((scenario) => {
        Object.keys(scenario.values).forEach((key) => {
          expect(getParameterByKey(key), `未知参数: ${key}`).toBeDefined();
        });
      });
    });

    it('should contain the default scenario', () => {
      expect(SERVICE_SCENARIOS.some((s) => s.key === DEFAULT_SCENARIO_KEY)).toBe(true);
    });

    it('should only reference known keys in the quick summary', () => {
      QUICK_SUMMARY_KEYS.forEach((key) => {
        expect(getParameterByKey(key), `未知参数: ${key}`).toBeDefined();
      });
    });
  });

  describe('matchScenario', () => {
    it('should detect the chat scenario from stored values', () => {
      const chat = SERVICE_SCENARIOS.find((s) => s.key === 'chat')!;
      expect(matchScenario({ ...chat.values })).toBe('chat');
    });

    it('should return undefined when sampling values do not match any scenario', () => {
      expect(matchScenario({ temperature: 1.7, 'top-p': 0.3 })).toBeUndefined();
    });

    it('should tolerate numeric strings from persisted configs', () => {
      const code = SERVICE_SCENARIOS.find((s) => s.key === 'code')!;
      const stored = Object.fromEntries(
        Object.entries(code.values).map(([key, value]) => [key, String(value)]),
      );
      expect(matchScenario(stored)).toBe('code');
    });
  });

  describe('applyScenario', () => {
    it('should override only the keys declared by the scenario', () => {
      const creative = SERVICE_SCENARIOS.find((s) => s.key === 'creative')!;
      const merged = applyScenario({ 'ctx-size': 4096, threads: 12 }, creative);

      expect(merged['ctx-size']).toBe(4096);
      expect(merged.threads).toBe(12);
      expect(merged.temperature).toBe(creative.values.temperature);
    });

    it('should not mutate the input values', () => {
      const values = { temperature: 0.1 };
      applyScenario(values, SERVICE_SCENARIOS[0]);
      expect(values.temperature).toBe(0.1);
    });
  });

  describe('buildHardwareDefaults', () => {
    it('should return an empty object without a hardware profile', () => {
      expect(buildHardwareDefaults(null)).toEqual({});
    });

    it('should keep CPU-only machines on CPU', () => {
      const defaults = buildHardwareDefaults({
        cpuCores: 8,
        totalMemoryGb: 16,
        availableMemoryGb: 12,
        vramGb: 0,
        hasGpu: false,
      });

      expect(defaults.threads).toBe(8);
      expect(defaults['threads-batch']).toBe(8);
      expect(defaults['n-gpu-layers']).toBe(0);
      expect(defaults['flash-attn']).toBe(false);
      expect(defaults['ctx-size']).toBe(2048);
    });

    it('should offload all layers and raise context size on a 8GB GPU', () => {
      const defaults = buildHardwareDefaults({
        cpuCores: 16,
        totalMemoryGb: 32,
        availableMemoryGb: 24,
        vramGb: 8,
        hasGpu: true,
      });

      expect(defaults['n-gpu-layers']).toBe(-1);
      expect(defaults['flash-attn']).toBe(true);
      expect(defaults['ctx-size']).toBe(8192);
      expect(defaults['batch-size']).toBe(2048);
    });

    it('should shrink batch sizes on low-memory CPU machines', () => {
      const defaults = buildHardwareDefaults({
        cpuCores: 4,
        totalMemoryGb: 8,
        availableMemoryGb: 4,
        vramGb: 0,
        hasGpu: false,
      });

      expect(defaults['batch-size']).toBe(1024);
      expect(defaults['ubatch-size']).toBe(256);
    });

    it('should produce context sizes aligned to the 256 step rule', () => {
      const profiles = [
        { cpuCores: 4, totalMemoryGb: 8, availableMemoryGb: 4, vramGb: 0, hasGpu: false },
        { cpuCores: 8, totalMemoryGb: 16, availableMemoryGb: 12, vramGb: 4, hasGpu: true },
        { cpuCores: 16, totalMemoryGb: 64, availableMemoryGb: 48, vramGb: 24, hasGpu: true },
      ];

      profiles.forEach((profile) => {
        const ctxSize = Number(buildHardwareDefaults(profile)['ctx-size']);
        expect(ctxSize % 256).toBe(0);
        expect(CONTEXT_SIZE_OPTIONS).toContain(ctxSize);
      });
    });
  });

  describe('CONTEXT_SIZE_OPTIONS', () => {
    it('should only contain multiples of 256', () => {
      CONTEXT_SIZE_OPTIONS.forEach((size) => {
        expect(size % 256).toBe(0);
      });
    });
  });
});
