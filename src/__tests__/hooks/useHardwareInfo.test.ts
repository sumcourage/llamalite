import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useHardwareInfo } from '../../hooks/useHardwareInfo';
import { invoke } from '@tauri-apps/api/core';
import type { HardwareInfo } from '../../types';

const mockHardwareInfo: HardwareInfo = {
  cpuCores: 16,
  totalMemory: 34_359_738_368, // 32 GB
  availableMemory: 25_769_803_776, // 24 GB
  gpuInfo: [
    {
      name: 'NVIDIA GeForce RTX 4090',
      memoryTotal: 25_769_803_776, // 24 GB
      memoryFree: 21_474_836_480, // 20 GB
      computeCapability: '8.9',
    },
  ],
};

const mockHardwareInfoNoGpu: HardwareInfo = {
  cpuCores: 8,
  totalMemory: 17_179_869_184, // 16 GB
  availableMemory: 12_884_901_888, // 12 GB
  gpuInfo: [],
};

describe('useHardwareInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('硬件检测', () => {
    it('should detect hardware on mount', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockHardwareInfo);

      const { result } = renderHook(() => useHardwareInfo());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hardwareInfo).toEqual(mockHardwareInfo);
      expect(result.current.error).toBeNull();
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('detect_hardware');
    });

    it('should detect hardware with no GPU', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockHardwareInfoNoGpu);

      const { result } = renderHook(() => useHardwareInfo());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hardwareInfo).toEqual(mockHardwareInfoNoGpu);
      expect(result.current.hardwareInfo!.gpuInfo).toHaveLength(0);
    });

    it('should fallback to navigator when invoke fails', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Tauri not available'));

      const { result } = renderHook(() => useHardwareInfo());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Should fallback to navigator values
      expect(result.current.hardwareInfo).not.toBeNull();
      expect(result.current.hardwareInfo!.cpuCores).toBe(8); // from navigator mock
      expect(result.current.hardwareInfo!.totalMemory).toBe(8 * 1024 * 1024 * 1024);
      expect(result.current.hardwareInfo!.availableMemory).toBe(6 * 1024 * 1024 * 1024);
      expect(result.current.hardwareInfo!.gpuInfo).toEqual([]);
      expect(result.current.error).toBe('Tauri not available');
    });
  });

  describe('formatMemory', () => {
    it('should convert bytes to GB string', () => {
      const { result } = renderHook(() => useHardwareInfo());

      // 1 GB
      expect(result.current.formatMemory(1_073_741_824)).toBe('1.0 GB');
      // 2 GB
      expect(result.current.formatMemory(2_147_483_648)).toBe('2.0 GB');
      // 1.5 GB
      expect(result.current.formatMemory(1_610_612_736)).toBe('1.5 GB');
      // 0 GB
      expect(result.current.formatMemory(0)).toBe('0.0 GB');
      // 8.5 GB
      expect(result.current.formatMemory(9_126_805_504)).toBe('8.5 GB');
    });
  });

  describe('GPU 信息', () => {
    it('should handle GPU info', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockHardwareInfo);

      const { result } = renderHook(() => useHardwareInfo());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hardwareInfo!.gpuInfo).toHaveLength(1);
      expect(result.current.hardwareInfo!.gpuInfo[0].name).toBe(
        'NVIDIA GeForce RTX 4090',
      );
      expect(result.current.hardwareInfo!.gpuInfo[0].memoryTotal).toBe(
        25_769_803_776,
      );
      expect(result.current.hardwareInfo!.gpuInfo[0].computeCapability).toBe('8.9');
    });

    it('should handle multiple GPUs', async () => {
      const multiGpuInfo: HardwareInfo = {
        cpuCores: 16,
        totalMemory: 68_719_476_736,
        availableMemory: 51_539_607_552,
        gpuInfo: [
          {
            name: 'NVIDIA GeForce RTX 4090',
            memoryTotal: 25_769_803_776,
            memoryFree: 21_474_836_480,
            computeCapability: '8.9',
          },
          {
            name: 'NVIDIA GeForce RTX 3080',
            memoryTotal: 12_884_901_888,
            memoryFree: 10_737_418_240,
            computeCapability: '8.6',
          },
        ],
      };

      vi.mocked(invoke).mockResolvedValueOnce(multiGpuInfo);

      const { result } = renderHook(() => useHardwareInfo());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hardwareInfo!.gpuInfo).toHaveLength(2);
      expect(result.current.hardwareInfo!.gpuInfo[0].name).toBe(
        'NVIDIA GeForce RTX 4090',
      );
      expect(result.current.hardwareInfo!.gpuInfo[1].name).toBe(
        'NVIDIA GeForce RTX 3080',
      );
    });
  });

  describe('recommendations', () => {
    it('should generate recommendations based on hardware', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockHardwareInfo);

      const { result } = renderHook(() => useHardwareInfo());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // 32 GB RAM with GPU should give high-tier recommendations
      expect(result.current.recommendations.length).toBeGreaterThan(0);
    });

    it('should provide recommendations even on fallback', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('Tauri not available'));

      const { result } = renderHook(() => useHardwareInfo());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Even on fallback, recommendations should be calculated
      expect(result.current.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('refresh', () => {
    it('should re-fetch hardware info', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockHardwareInfo);
      vi.mocked(invoke).mockResolvedValueOnce(mockHardwareInfoNoGpu);

      const { result } = renderHook(() => useHardwareInfo());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.hardwareInfo!.cpuCores).toBe(16);

      // Refresh
      await act(async () => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.hardwareInfo!.cpuCores).toBe(8);
      });
    });
  });
});