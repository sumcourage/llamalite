import { useState, useEffect, useCallback, useRef } from 'react';
import type { HardwareInfo, ScoredRecommendation, CachedCatalogEntry, ModelRecommendation } from '../types';
import { getRecommendationsForHardware, applyCatalogCache, MODEL_CATALOG } from '../constants/modelRecommendations';

export function useHardwareInfo() {
  const [hardwareInfo, setHardwareInfo] = useState<HardwareInfo | null>(null);
  const [recommendations, setRecommendations] = useState<ScoredRecommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [catalogRefreshing, setCatalogRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalogCacheRef = useRef<CachedCatalogEntry[]>([]);
  const hardwareRef = useRef<{
    totalMemoryGb: number;
    vramGb: number;
    cpuCores: number;
    availableMemoryGb: number;
    hasGpu: boolean;
    gpuName: string;
  } | null>(null);

  /**
   * Normalize HardwareInfo ensuring all required fields have safe defaults.
   * The Tauri backend may occasionally return partial objects missing `gpuInfo` or other
   * fields on certain OS / driver combination, which previously caused
   * `Cannot read properties of undefined (reading 'length')` when we blindly accessed
   * `gpuInfo.length`.
   */
  function normalizeHardwareInfo(raw: Partial<HardwareInfo>): HardwareInfo {
    const fallbackCpuCores = (typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : 4) || 4;
    const eightGb = 8 * 1024 * 1024 * 1024;
    const sixGb = 6 * 1024 * 1024 * 1024;
    return {
      cpuCores: (typeof raw.cpuCores === 'number' && raw.cpuCores > 0) ? raw.cpuCores : fallbackCpuCores,
      totalMemory: (typeof raw.totalMemory === 'number' && raw.totalMemory > 0) ? raw.totalMemory : eightGb,
      availableMemory: (typeof raw.availableMemory === 'number' && raw.availableMemory > 0)
        ? raw.availableMemory
        : sixGb,
      gpuInfo: Array.isArray(raw.gpuInfo) ? raw.gpuInfo : [],
    };
  }

  /** Recompute recommendations from current hardware + cache. */
  const recomputeRecommendations = useCallback(
    (
      hw: {
        totalMemoryGb: number;
        vramGb: number;
        cpuCores: number;
        availableMemoryGb: number;
        hasGpu: boolean;
        gpuName: string;
      },
      cache: CachedCatalogEntry[],
    ) => {
      const enrichedCatalog = applyCatalogCache(MODEL_CATALOG, cache);
      const recs = getRecommendationsForHardware(
        hw.totalMemoryGb,
        hw.vramGb,
        hw.cpuCores,
        hw.availableMemoryGb,
        hw.hasGpu,
        hw.gpuName,
        enrichedCatalog,
      );
      setRecommendations(recs);
    },
    [],
  );

  const fetchHardwareInfo = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const raw = await invoke<Partial<HardwareInfo>>('detect_hardware');
      const info = normalizeHardwareInfo(raw ?? {});
      setHardwareInfo(info);

      // Calculate recommendations using full hardware profile
      const hasGpu = info.gpuInfo.length > 0;
      const totalMemoryGb = info.totalMemory / 1073741824;
      const availableMemoryGb = info.availableMemory / 1073741824;
      const vramGb = hasGpu
        ? (info.gpuInfo[0]?.memoryTotal ?? 0) / 1073741824
        : 0;
      const gpuName = hasGpu ? (info.gpuInfo[0]?.name ?? '') : '';

      const hw = { totalMemoryGb, vramGb, cpuCores: info.cpuCores, availableMemoryGb, hasGpu, gpuName };
      hardwareRef.current = hw;

      // Load cached catalog (non-blocking)
      try {
        const cache = await invoke<CachedCatalogEntry[]>('get_cached_catalog');
        catalogCacheRef.current = cache;
        recomputeRecommendations(hw, cache);
      } catch {
        // No cache yet — use hard-coded catalog
        recomputeRecommendations(hw, []);
      }
    } catch (err) {
      // Fallback to basic detection
      const fallback = normalizeHardwareInfo({});
      setHardwareInfo(fallback);
      const totalMemoryGb = fallback.totalMemory / 1073741824;
      const availableMemoryGb = fallback.availableMemory / 1073741824;
      const hw = {
        totalMemoryGb,
        vramGb: 0,
        cpuCores: fallback.cpuCores,
        availableMemoryGb,
        hasGpu: false,
        gpuName: '',
      };
      hardwareRef.current = hw;
      recomputeRecommendations(hw, catalogCacheRef.current);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [recomputeRecommendations]);

  /** Refresh the model catalog cache from ModelScope. */
  const refreshCatalog = useCallback(async () => {
    setCatalogRefreshing(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const repoIds = MODEL_CATALOG.map((m: ModelRecommendation) => m.repoId);
      const cache = await invoke<CachedCatalogEntry[]>('refresh_model_catalog', {
        repoIds,
      });
      catalogCacheRef.current = cache;
      if (hardwareRef.current) {
        recomputeRecommendations(hardwareRef.current, cache);
      }
    } catch (err) {
      console.error('Failed to refresh catalog:', err);
    } finally {
      setCatalogRefreshing(false);
    }
  }, [recomputeRecommendations]);

  useEffect(() => {
    fetchHardwareInfo();
  }, [fetchHardwareInfo]);

  const formatMemory = useCallback((bytes: number): string => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB`;
  }, []);

  const refresh = useCallback(() => {
    fetchHardwareInfo();
  }, [fetchHardwareInfo]);

  return {
    hardwareInfo,
    recommendations,
    loading,
    catalogRefreshing,
    error,
    formatMemory,
    refresh,
    refreshCatalog,
  };
}
