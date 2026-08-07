import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useServiceStore } from '../../stores/serviceStore';
import type { ServiceConfig, ServiceLogEntry } from '../../types';

// Mock the invoke function
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import('@tauri-apps/api/core');

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

describe('useServiceStore', () => {
  beforeEach(() => {
    // Reset store state
    useServiceStore.setState({
      services: [],
      currentStatus: null,
      logs: [],
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('初始状态', () => {
    it('should have empty initial state', () => {
      const state = useServiceStore.getState();
      expect(state.services).toEqual([]);
      expect(state.currentStatus).toBeNull();
      expect(state.logs).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchServices', () => {
    it('should fetch and set services on success', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockServices);

      await useServiceStore.getState().fetchServices();

      const state = useServiceStore.getState();
      expect(state.services).toEqual(mockServices);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });

    it('should handle fetch error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('网络错误'));

      await useServiceStore.getState().fetchServices();

      const state = useServiceStore.getState();
      expect(state.services).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Error: 网络错误');
    });
  });

  describe('createService', () => {
    it('should create service and refresh list', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);
      vi.mocked(invoke).mockResolvedValueOnce(mockServices);

      await useServiceStore.getState().createService({
        name: '新服务',
        modelPath: '/models/new.gguf',
        parameters: { temperature: 0.8 },
      });

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('create_service', {
        name: '新服务',
        modelPath: '/models/new.gguf',
        parameters: { temperature: 0.8 },
      });
      // Should have called fetchServices after create
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('list_services');
    });

    it('should handle create error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('创建失败'));

      await expect(
        useServiceStore.getState().createService({
          name: '新服务',
          modelPath: '/models/new.gguf',
          parameters: {},
        })
      ).rejects.toThrow('创建失败');

      const state = useServiceStore.getState();
      expect(state.error).toBe('Error: 创建失败');
    });
  });

  describe('deleteService', () => {
    it('should delete service and remove from list', async () => {
      useServiceStore.setState({ services: mockServices });
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useServiceStore.getState().deleteService('svc-1');

      const state = useServiceStore.getState();
      expect(state.services).toHaveLength(1);
      expect(state.services[0].id).toBe('svc-2');
    });

    it('should handle delete error', async () => {
      useServiceStore.setState({ services: mockServices });
      vi.mocked(invoke).mockRejectedValueOnce(new Error('删除失败'));

      await expect(
        useServiceStore.getState().deleteService('svc-1')
      ).rejects.toThrow('删除失败');

      // Services should remain unchanged
      const state = useServiceStore.getState();
      expect(state.services).toHaveLength(2);
    });
  });

  describe('startService', () => {
    it('should call start_service command', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useServiceStore.getState().startService('svc-1');

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('start_service', { id: 'svc-1' });
    });
  });

  describe('stopService', () => {
    it('should call stop_service command', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useServiceStore.getState().stopService('svc-1');

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('stop_service', { id: 'svc-1' });
    });
  });

  describe('restartService', () => {
    it('should call restart_service command', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useServiceStore.getState().restartService('svc-1');

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('restart_service', { id: 'svc-1' });
    });
  });

  describe('addLog', () => {
    it('should add a log entry', () => {
      const log: ServiceLogEntry = {
        timestamp: '2026-01-01 00:00:00',
        level: 'info',
        message: '测试日志',
      };

      useServiceStore.getState().addLog(log);

      const state = useServiceStore.getState();
      expect(state.logs).toHaveLength(1);
      expect(state.logs[0].message).toBe('测试日志');
    });

    it('should keep only last 1000 logs', () => {
      for (let i = 0; i < 1005; i++) {
        useServiceStore.getState().addLog({
          timestamp: `2026-01-01 ${String(i).padStart(2, '0')}:00:00`,
          level: 'info',
          message: `Log ${i}`,
        });
      }

      const state = useServiceStore.getState();
      expect(state.logs.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('clearLogs', () => {
    it('should clear all logs', () => {
      useServiceStore.getState().addLog({
        timestamp: '2026-01-01 00:00:00',
        level: 'info',
        message: 'test',
      });
      useServiceStore.getState().clearLogs();

      expect(useServiceStore.getState().logs).toEqual([]);
    });
  });

  describe('setError', () => {
    it('should set error message', () => {
      useServiceStore.getState().setError('测试错误');
      expect(useServiceStore.getState().error).toBe('测试错误');
    });

    it('should clear error with null', () => {
      useServiceStore.setState({ error: '旧错误' });
      useServiceStore.getState().setError(null);
      expect(useServiceStore.getState().error).toBeNull();
    });
  });
});