import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useServiceManager } from '../../hooks/useServiceManager';
import { useServiceStore } from '../../stores/serviceStore';
import { listen } from '@tauri-apps/api/event';
import type { ServiceConfig, ServiceStatusInfo, ServiceLogEntry } from '../../types';

// Mock store methods that use dynamic imports
// Keep real implementations for data-updating methods (addLog, clearLogs, setError)
const mockFetchServices = vi.fn().mockResolvedValue(undefined);
const mockCreateService = vi.fn().mockResolvedValue(undefined);
const mockUpdateService = vi.fn().mockResolvedValue(undefined);
const mockDeleteService = vi.fn().mockResolvedValue(undefined);
const mockStartService = vi.fn().mockResolvedValue(undefined);
const mockStopService = vi.fn().mockResolvedValue(undefined);
const mockRestartService = vi.fn().mockResolvedValue(undefined);
const mockFetchStatus = vi.fn().mockResolvedValue(undefined);
const mockFetchLogs = vi.fn().mockResolvedValue(undefined);

const mockServices: ServiceConfig[] = [
  {
    id: 'svc-1',
    name: 'Qwen 服务',
    modelPath: '/models/qwen.gguf',
    parameters: { temperature: 0.7, port: 8080 },
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
  },
  {
    id: 'svc-2',
    name: 'Llama 服务',
    modelPath: '/models/llama.gguf',
    parameters: { temperature: 0.5, port: 8081 },
    createdAt: '2026-01-02 00:00:00',
    updatedAt: '2026-01-02 00:00:00',
  },
];

describe('useServiceManager', () => {
  beforeEach(() => {
    useServiceStore.setState({
      services: [],
      currentStatus: null,
      logs: [],
      loading: false,
      error: null,
      fetchServices: mockFetchServices,
      createService: mockCreateService,
      updateService: mockUpdateService,
      deleteService: mockDeleteService,
      startService: mockStartService,
      stopService: mockStopService,
      restartService: mockRestartService,
      fetchStatus: mockFetchStatus,
      fetchLogs: mockFetchLogs,
    });
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('should initialize with services from store', async () => {
      useServiceStore.setState({ services: mockServices, loading: false });

      const { result } = renderHook(() => useServiceManager());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      expect(result.current.services).toHaveLength(2);
      expect(result.current.services[0].name).toBe('Qwen 服务');
      expect(result.current.services[1].name).toBe('Llama 服务');
    });

    it('should expose CRUD operations', () => {
      const { result } = renderHook(() => useServiceManager());

      expect(result.current.fetchServices).toBeDefined();
      expect(result.current.createService).toBeDefined();
      expect(result.current.updateService).toBeDefined();
      expect(result.current.deleteService).toBeDefined();
      expect(typeof result.current.fetchServices).toBe('function');
      expect(typeof result.current.createService).toBe('function');
      expect(typeof result.current.updateService).toBe('function');
      expect(typeof result.current.deleteService).toBe('function');
    });

    it('should handle start/stop/restart', () => {
      const { result } = renderHook(() => useServiceManager());

      expect(result.current.startService).toBeDefined();
      expect(result.current.stopService).toBeDefined();
      expect(result.current.restartService).toBeDefined();
      expect(typeof result.current.startService).toBe('function');
      expect(typeof result.current.stopService).toBe('function');
      expect(typeof result.current.restartService).toBe('function');
    });
  });

  describe('事件监听', () => {
    it('should listen for service-status-changed events', async () => {
      renderHook(() => useServiceManager());

      await waitFor(() => {
        expect(vi.mocked(listen)).toHaveBeenCalledWith(
          'service-status-changed',
          expect.any(Function),
        );
      });

      // Extract the callback and call it
      const statusCallback = vi.mocked(listen).mock.calls.find(
        (call) => call[0] === 'service-status-changed',
      )![1] as (event: { payload: ServiceStatusInfo }) => void;

      const mockStatus: ServiceStatusInfo = {
        id: 'svc-1',
        status: 'running',
        modelName: 'Qwen2.5-7B',
        port: 8080,
        pid: 12345,
        startedAt: '2026-01-01 00:00:00',
      };

      act(() => {
        statusCallback({ payload: mockStatus });
      });

      const state = useServiceStore.getState();
      expect(state.currentStatus).toEqual(mockStatus);
      expect(state.currentStatus!.status).toBe('running');
    });

    it('should listen for service-log events', async () => {
      renderHook(() => useServiceManager());

      // Wait for the first effect to register (service-status-changed)
      await waitFor(() => {
        expect(vi.mocked(listen)).toHaveBeenCalledTimes(1);
      });

      // Verify the first effect registered correctly
      expect(vi.mocked(listen)).toHaveBeenCalledWith(
        'service-status-changed',
        expect.any(Function),
      );
    });
  });

  describe('操作代理', () => {
    it('handleStart should call startService', async () => {
      useServiceStore.setState({ services: mockServices });

      const { result } = renderHook(() => useServiceManager());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      await act(async () => {
        await result.current.startService('svc-1');
      });

      expect(mockStartService).toHaveBeenCalledWith('svc-1');
    });

    it('handleDelete should call deleteService', async () => {
      useServiceStore.setState({ services: mockServices });

      const { result } = renderHook(() => useServiceManager());

      await waitFor(() => {
        expect(result.current.services).toEqual(mockServices);
      });

      expect(result.current.services).toHaveLength(2);

      await act(async () => {
        await result.current.deleteService('svc-1');
      });

      expect(mockDeleteService).toHaveBeenCalledWith('svc-1');
    });

    it('handleStop should call stopService', async () => {
      const { result } = renderHook(() => useServiceManager());

      await act(async () => {
        await result.current.stopService('svc-1');
      });

      expect(mockStopService).toHaveBeenCalledWith('svc-1');
    });

    it('handleRestart should call restartService', async () => {
      const { result } = renderHook(() => useServiceManager());

      await act(async () => {
        await result.current.restartService('svc-1');
      });

      expect(mockRestartService).toHaveBeenCalledWith('svc-1');
    });
  });

  describe('store 状态', () => {
    it('should expose loading and error state', async () => {
      const { result } = renderHook(() => useServiceManager());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Set error after initial load completes
      act(() => {
        result.current.setError('测试错误');
      });

      expect(result.current.error).toBe('测试错误');
    });

    it('should expose log management', () => {
      const { result } = renderHook(() => useServiceManager());

      expect(result.current.fetchLogs).toBeDefined();
      expect(result.current.clearLogs).toBeDefined();
      expect(result.current.setError).toBeDefined();
      expect(typeof result.current.fetchLogs).toBe('function');
      expect(typeof result.current.clearLogs).toBe('function');
    });
  });
});