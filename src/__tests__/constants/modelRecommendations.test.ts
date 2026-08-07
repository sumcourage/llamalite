import { describe, it, expect } from 'vitest';
import {
  RECOMMENDATIONS,
  MODEL_CATALOG,
  getRecommendationsForHardware,
  getHardwareTier,
  selectQuantization,
  applyCatalogCache,
} from '../../constants/modelRecommendations';
import type { CachedCatalogEntry } from '../../types';

const GB = 1073741824;

describe('Model Recommendations', () => {
  describe('MODEL_CATALOG', () => {
    it('should have at least 10 models', () => {
      expect(MODEL_CATALOG.length).toBeGreaterThanOrEqual(10);
    });

    it('should have unique repo IDs', () => {
      const repos = MODEL_CATALOG.map((m) => m.repoId);
      expect(new Set(repos).size).toBe(repos.length);
    });

    it('all models should have quantizations and quantSizes arrays of equal length', () => {
      MODEL_CATALOG.forEach((model) => {
        expect(model.quantizations.length).toBeGreaterThan(0);
        expect(model.quantizations.length).toBe(model.quantSizes.length);
        model.quantSizes.forEach((s) => expect(s).toBeGreaterThan(0));
      });
    });

    it('all models should have parameterCount > 0', () => {
      MODEL_CATALOG.forEach((model) => {
        expect(model.parameterCount).toBeGreaterThan(0);
      });
    });

    it('low tier models should not require GPU', () => {
      MODEL_CATALOG.filter((m) => m.hardwareLevel === 'low').forEach((model) => {
        expect(model.requiresGpu).toBe(false);
      });
    });
  });

  describe('RECOMMENDATIONS (backward compat)', () => {
    it('should have low, medium, and high tiers', () => {
      expect(RECOMMENDATIONS.low).toBeDefined();
      expect(RECOMMENDATIONS.medium).toBeDefined();
      expect(RECOMMENDATIONS.high).toBeDefined();
    });

    it('tiers should partition the catalog', () => {
      const total =
        RECOMMENDATIONS.low.length +
        RECOMMENDATIONS.medium.length +
        RECOMMENDATIONS.high.length;
      expect(total).toBe(MODEL_CATALOG.length);
    });
  });

  describe('selectQuantization', () => {
    it('should pick the largest quantization that fits in VRAM', () => {
      const model = MODEL_CATALOG.find((m) => m.name === 'Qwen2.5-7B')!;
      // 8GB VRAM → should pick Q6_K (5.9GB) or Q8_0 (7.4GB)
      const result = selectQuantization(model, 8 * GB, 16 * GB, true);
      // 7.4GB fits in 8GB * 0.85 = 6.8GB usable? No. 7.4 > 6.8, so Q6_K (5.9GB)
      expect(result.quantization).toBe('Q6_K');
    });

    it('should pick based on RAM for CPU-only models', () => {
      const model = MODEL_CATALOG.find((m) => m.name === 'Qwen2.5-1.5B')!;
      // 8GB available RAM → usable = 6.8GB → Q8_0 (1.8GB) fits
      const result = selectQuantization(model, 0, 8 * GB, false);
      expect(result.quantization).toBe('Q8_0');
    });

    it('should fallback to smallest quantization when nothing fits', () => {
      const model = MODEL_CATALOG.find((m) => m.name === 'Llama-3.3-70B')!;
      // 2GB VRAM → nothing fits, fallback to smallest (Q3_K_L)
      const result = selectQuantization(model, 2 * GB, 4 * GB, true);
      expect(result.quantization).toBe('Q3_K_L');
    });
  });

  describe('getRecommendationsForHardware', () => {
    it('should return scored recommendations sorted by fitScore', () => {
      const recs = getRecommendationsForHardware(16, 0, 8, 12, false, '');
      expect(recs.length).toBeGreaterThan(0);
      for (let i = 1; i < recs.length; i++) {
        expect(recs[i - 1].fitScore).toBeGreaterThanOrEqual(recs[i].fitScore);
      }
    });

    it('should return at most 6 recommendations', () => {
      const recs = getRecommendationsForHardware(64, 24, 16, 48, true, 'RTX 4090');
      expect(recs.length).toBeLessThanOrEqual(6);
    });

    it('should prioritize CPU-friendly models when no GPU', () => {
      const recs = getRecommendationsForHardware(8, 0, 4, 6, false, '');
      const cpuModels = recs.filter((r) => !r.requiresGpu);
      // At least some CPU models should be recommended
      expect(cpuModels.length).toBeGreaterThan(0);
    });

    it('should include high-end models for powerful hardware', () => {
      const recs = getRecommendationsForHardware(64, 24, 16, 48, true, 'RTX 4090');
      const names = recs.map((r) => r.name);
      // Should include at least one large model
      const hasLarge = names.some((n) =>
        n.includes('14B') || n.includes('32B') || n.includes('70B'),
      );
      expect(hasLarge).toBe(true);
    });

    it('should filter out models that cannot run on weak hardware', () => {
      const recs = getRecommendationsForHardware(4, 0, 2, 3, false, '');
      // 70B model should not appear
      const has70B = recs.some((r) => r.name.includes('70B'));
      expect(has70B).toBe(false);
    });

    it('each recommendation should have dynamicQuantization and dynamicSize', () => {
      const recs = getRecommendationsForHardware(16, 8, 8, 12, true, 'RTX 3070');
      recs.forEach((r) => {
        expect(r.dynamicQuantization).toBeTruthy();
        expect(r.dynamicSize).toBeGreaterThan(0);
        expect(r.fitScore).toBeGreaterThan(0);
        expect(['perfect', 'good', 'marginal']).toContain(r.fitLevel);
      });
    });
  });

  describe('getHardwareTier', () => {
    it('should return low for < 8GB RAM without GPU', () => {
      expect(getHardwareTier(4, 0)).toBe('low');
      expect(getHardwareTier(7, 0)).toBe('low');
    });

    it('should return medium for >= 8GB RAM', () => {
      expect(getHardwareTier(8, 0)).toBe('medium');
    });

    it('should return medium for >= 4GB VRAM', () => {
      expect(getHardwareTier(4, 4)).toBe('medium');
    });

    it('should return high for > 16GB RAM', () => {
      expect(getHardwareTier(24, 0)).toBe('high');
    });

    it('should return high for > 8GB VRAM', () => {
      expect(getHardwareTier(8, 10)).toBe('high');
    });
  });

  describe('applyCatalogCache', () => {
    it('should return original catalog when cache is empty', () => {
      const result = applyCatalogCache(MODEL_CATALOG, []);
      expect(result.length).toBe(MODEL_CATALOG.length);
    });

    it('should remove invalid repos from catalog', () => {
      const cache: CachedCatalogEntry[] = [
        {
          repoId: MODEL_CATALOG[0].repoId,
          valid: false,
          ggufFiles: [],
          actualRepoId: null,
          error: 'Not found',
          checkedAt: Date.now(),
        },
      ];
      const result = applyCatalogCache(MODEL_CATALOG, cache);
      expect(result.length).toBe(MODEL_CATALOG.length - 1);
      expect(result.find((m) => m.repoId === MODEL_CATALOG[0].repoId)).toBeUndefined();
    });

    it('should update repoId when actualRepoId differs', () => {
      const cache: CachedCatalogEntry[] = [
        {
          repoId: MODEL_CATALOG[0].repoId,
          valid: true,
          ggufFiles: [{ filename: 'model-Q4_K_M.gguf', size: 4 * GB }],
          actualRepoId: 'some/other-repo-GGUF',
          error: null,
          checkedAt: Date.now(),
        },
      ];
      const result = applyCatalogCache(MODEL_CATALOG, cache);
      const updated = result.find((m) => m.name === MODEL_CATALOG[0].name);
      expect(updated).toBeDefined();
      expect(updated!.repoId).toBe('some/other-repo-GGUF');
    });

    it('should update quantSizes from real GGUF file sizes', () => {
      const model = MODEL_CATALOG[0];
      const cache: CachedCatalogEntry[] = [
        {
          repoId: model.repoId,
          valid: true,
          ggufFiles: [
            { filename: `${model.name}-Q4_K_M.gguf`, size: 1.5 * GB },
            { filename: `${model.name}-Q8_0.gguf`, size: 2.5 * GB },
          ],
          actualRepoId: null,
          error: null,
          checkedAt: Date.now(),
        },
      ];
      const result = applyCatalogCache(MODEL_CATALOG, cache);
      const updated = result.find((m) => m.name === model.name);
      expect(updated).toBeDefined();

      // Find Q4_K_M index and check its size was updated
      const q4Index = updated!.quantizations.indexOf('Q4_K_M');
      if (q4Index >= 0) {
        expect(updated!.quantSizes[q4Index]).toBe(1.5 * GB);
      }
    });

    it('should keep models without cache entries as-is', () => {
      const cache: CachedCatalogEntry[] = [
        {
          repoId: 'nonexistent/repo',
          valid: true,
          ggufFiles: [],
          actualRepoId: null,
          error: null,
          checkedAt: Date.now(),
        },
      ];
      const result = applyCatalogCache(MODEL_CATALOG, cache);
      expect(result.length).toBe(MODEL_CATALOG.length);
    });
  });
});
