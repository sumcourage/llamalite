import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useModelDownload } from '../../hooks/useModelDownload';
import { useModelStore } from '../../stores/modelStore';
import { listen } from '@tauri-apps/api/event';
import type { LocalModel, DownloadProgress } from '../../types';

// Mock store methods that use dynamic imports
// Keep real implementations for data-updating methods (updateDownloadProgress, setError)
const mockFetchLocalModels = vi.fn().mockResolvedValue(undefined);
const mockDeleteModel = vi.fn().mockResolvedValue(undefined);
const mockStartDownload = vi.fn().mockResolvedValue(undefined);
const mockCancelDownload = vi.fn().mockResolvedValue(undefined);
const mockSearchModels = vi.fn().mockResolvedValue(undefined);

const mockLocalModels: LocalModel[] = [
  {
    id: 'model-1',
    repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
    filename: 'qwen2.5-7b-q4_k_m.gguf',
    path: '/models/qwen2.5-7b-q4_k_m.gguf',
    size: 4_500_000_000,
    quantization: 'Q4_K_M',
    downloadDate: '2026-01-01',
    description: '通义千问 2.5 7B 指令模型',
  },
  {
    id: 'model-2',
    repoId: 'test/test-model',
    filename: 'test.gguf',
    path: '/models/test.gguf',
    size: 1_000_000_000,
    quantization: 'Q4_0',
    downloadDate: '2026-01-02',
  },
];

const mockDownloadProgress: DownloadProgress = {
  modelId: 'dl-1',
  repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
  status: 'downloading',
};

describe('useModelDownload', () => {
  beforeEach(() => {
    useModelStore.setState({
      localModels: [],
      downloadProgress: {},
      searchResults: [],
      loading: false,
      error: null,
      fetchLocalModels: mockFetchLocalModels,
      deleteModel: mockDeleteModel,
      startDownload: mockStartDownload,
      cancelDownload: mockCancelDownload,
      searchModels: mockSearchModels,
    });
    vi.clearAllMocks();
  });

  describe('初始化', () => {
    it('should initialize with models from store', async () => {
      useModelStore.setState({ localModels: mockLocalModels });

      const { result } = renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(result.current.localModels).toEqual(mockLocalModels);
      });

      expect(result.current.localModels).toHaveLength(2);
      expect(result.current.localModels[0].repoId).toBe(
        'Qwen/Qwen2.5-7B-Instruct-GGUF',
      );
    });

    it('should expose download operations', () => {
      const { result } = renderHook(() => useModelDownload());

      expect(result.current.startDownload).toBeDefined();
      expect(result.current.cancelDownload).toBeDefined();
      expect(result.current.deleteModel).toBeDefined();
      expect(result.current.searchModels).toBeDefined();
      expect(typeof result.current.startDownload).toBe('function');
      expect(typeof result.current.cancelDownload).toBe('function');
      expect(typeof result.current.deleteModel).toBe('function');
      expect(typeof result.current.searchModels).toBe('function');
    });
  });

  describe('事件监听', () => {
    it('should listen for download-progress events', async () => {
      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(vi.mocked(listen)).toHaveBeenCalledWith(
          'download-progress',
          expect.any(Function),
        );
      });

      const progressCallback = vi.mocked(listen).mock.calls.find(
        (call) => call[0] === 'download-progress',
      )![1] as (event: { payload: Record<string, unknown> }) => void;

      act(() => {
        progressCallback({
          payload: {
            modelId: 'dl-1',
            repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
            status: 'downloading',
          },
        });
      });

      const state = useModelStore.getState();
      expect(state.downloadProgress['dl-1']).toBeDefined();
      expect(state.downloadProgress['dl-1'].status).toBe('downloading');
    });

    it('should listen for download-complete events', async () => {
      useModelStore.setState({ localModels: mockLocalModels });

      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(vi.mocked(listen)).toHaveBeenCalledWith(
          'download-complete',
          expect.any(Function),
        );
      });

      const completeCallback = vi.mocked(listen).mock.calls.find(
        (call) => call[0] === 'download-complete',
      )![1] as (event: { payload: { modelId: string } }) => void;

      await act(async () => {
        await completeCallback({ payload: { modelId: 'dl-1' } });
      });

      const state = useModelStore.getState();
      expect(state.downloadProgress['dl-1']).toBeDefined();
      expect(state.downloadProgress['dl-1'].status).toBe('completed');
    });

    it('should listen for download-error events', async () => {
      renderHook(() => useModelDownload());

      await waitFor(() => {
        expect(vi.mocked(listen)).toHaveBeenCalledWith(
          'download-error',
          expect.any(Function),
        );
      });

      const errorCallback = vi.mocked(listen).mock.calls.find(
        (call) => call[0] === 'download-error',
      )![1] as (event: {
        payload: { modelId: string; error: string };
      }) => void;

      act(() => {
        errorCallback({
          payload: { modelId: 'dl-1', error: '下载失败: 网络错误' },
        });
      });

      const state = useModelStore.getState();
      expect(state.downloadProgress['dl-1']).toBeDefined();
      expect(state.downloadProgress['dl-1'].status).toBe('error');
      expect(state.downloadProgress['dl-1'].errorMessage).toBe(
        '下载失败: 网络错误',
      );
    });
  });

  describe('操作代理', () => {
    it('handleDownload should call startDownload', async () => {
      const { result } = renderHook(() => useModelDownload());

      await act(async () => {
        await result.current.startDownload(
          'Qwen/Qwen2.5-7B-Instruct-GGUF',
          '/models',
        );
      });

      expect(mockStartDownload).toHaveBeenCalledWith(
        'Qwen/Qwen2.5-7B-Instruct-GGUF',
        '/models',
      );
    });

    it('handleCancel should call cancelDownload', async () => {
      const { result } = renderHook(() => useModelDownload());

      await act(async () => {
        await result.current.cancelDownload('dl-1');
      });

      expect(mockCancelDownload).toHaveBeenCalledWith('dl-1');
    });

    it('handleSearch should call searchModels', async () => {
      const { result } = renderHook(() => useModelDownload());

      await act(async () => {
        await result.current.searchModels('Qwen');
      });

      expect(mockSearchModels).toHaveBeenCalledWith('Qwen');
    });
  });

  describe('downloadProgress', () => {
    it('should expose download progress from store', () => {
      useModelStore.setState({
        downloadProgress: { 'dl-1': mockDownloadProgress },
      });

      const { result } = renderHook(() => useModelDownload());

      expect(result.current.downloadProgress['dl-1']).toEqual(
        mockDownloadProgress,
      );
      expect(result.current.downloadProgress['dl-1'].status).toBe('downloading');
    });
  });
});
