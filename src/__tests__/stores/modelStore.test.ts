import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useModelStore } from '../../stores/modelStore';
import type { LocalModel, DownloadProgress, ModelSearchResult } from '../../types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import('@tauri-apps/api/core');

/**
 * The Rust backend returns snake_case fields (`repo_id`, `local_path`,
 * `size_bytes`, etc.) wrapped in a `metadata` object for description/tags.
 * The tests below use the same shape so the Store's `mapLocalModelFromRust`
 * and model mapper functions are exercised.
 */
const mockLocalModelsRust = [
  {
    id: 'model-1',
    repo_id: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
    filename: 'qwen2.5-7b-q4_k_m.gguf',
    local_path: '/models/qwen2.5-7b-q4_k_m.gguf',
    size_bytes: 4_500_000_000,
    quantization: 'Q4_K_M',
    downloaded_at: '2026-01-01',
    metadata: {
      description: '通义千问 2.5 7B 指令模型',
      tags: ['gguf', 'chat'],
    },
  },
  {
    id: 'model-2',
    repo_id: 'test/test-model',
    filename: 'test.gguf',
    local_path: '/models/test.gguf',
    size_bytes: 1_000_000_000,
    quantization: 'Q4_0',
    downloaded_at: '2026-01-02',
    metadata: { description: null, tags: [] },
  },
];

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
    tags: ['gguf', 'chat'],
  },
  {
    id: 'model-2',
    repoId: 'test/test-model',
    filename: 'test.gguf',
    path: '/models/test.gguf',
    size: 1_000_000_000,
    quantization: 'Q4_0',
    downloadDate: '2026-01-02',
    tags: [],
  },
];

describe('useModelStore', () => {
  beforeEach(() => {
    useModelStore.setState({
      localModels: [],
      downloadProgress: {},
      searchResults: [],
      loading: false,
      error: null,
    });
    vi.clearAllMocks();
  });

  describe('初始状态', () => {
    it('should have empty initial state', () => {
      const state = useModelStore.getState();
      expect(state.localModels).toEqual([]);
      expect(state.downloadProgress).toEqual({});
      expect(state.searchResults).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('fetchLocalModels', () => {
    it('should fetch and set local models on success (snake_case → camelCase)', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(mockLocalModelsRust);

      await useModelStore.getState().fetchLocalModels();

      const state = useModelStore.getState();
      expect(state.localModels).toEqual(mockLocalModels);
      expect(state.loading).toBe(false);
      expect(state.localModels[0].repoId).toBe('Qwen/Qwen2.5-7B-Instruct-GGUF');
      expect(state.localModels[0].path).toBe('/models/qwen2.5-7b-q4_k_m.gguf');
      expect(state.localModels[0].size).toBe(4_500_000_000);
    });

    it('should gracefully handle partial/empty backend payloads', async () => {
      const partial = [{ id: 'half' }]; // missing most fields
      vi.mocked(invoke).mockResolvedValueOnce(partial);

      await useModelStore.getState().fetchLocalModels();

      const first = useModelStore.getState().localModels[0];
      expect(first.id).toBe('half');
      expect(first.repoId).toBeNull();
      expect(first.path).toBe('');
      expect(first.size).toBe(0);
      expect(first.quantization).toBeNull();
    });

    it('should handle fetch error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('获取失败'));

      await useModelStore.getState().fetchLocalModels();

      expect(useModelStore.getState().error).toBe('获取失败');
      expect(useModelStore.getState().loading).toBe(false);
    });
  });

  describe('deleteModel', () => {
    it('should delete model and remove from list', async () => {
      useModelStore.setState({ localModels: mockLocalModels });
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useModelStore.getState().deleteModel('model-1');

      const state = useModelStore.getState();
      expect(state.localModels).toHaveLength(1);
      expect(state.localModels[0].id).toBe('model-2');
    });

    it('should handle delete error when model is referenced by service', async () => {
      useModelStore.setState({ localModels: mockLocalModels });
      vi.mocked(invoke).mockRejectedValueOnce(
        new Error("无法删除模型 'test'：服务 'Qwen 服务' 正在引用此模型")
      );

      await expect(
        useModelStore.getState().deleteModel('model-1')
      ).rejects.toThrow('正在引用此模型');

      // Models should remain unchanged
      expect(useModelStore.getState().localModels).toHaveLength(2);
    });

    it('should handle delete error', async () => {
      useModelStore.setState({ localModels: mockLocalModels });
      vi.mocked(invoke).mockRejectedValueOnce(new Error('删除失败'));

      await expect(
        useModelStore.getState().deleteModel('model-1')
      ).rejects.toThrow('删除失败');
    });
  });

  describe('startDownload', () => {
    it('should call start_download with {repoId, filename} and seed progress', async () => {
      const expectedModelId = 'new-model-123';
      vi.mocked(invoke).mockResolvedValueOnce(expectedModelId);

      const returned = await useModelStore.getState().startDownload(
        'Qwen/Qwen2.5-7B-Instruct-GGUF',
        'qwen2.5-7b-q4_k_m.gguf'
      );

      expect(returned).toBe(expectedModelId);
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('start_download', {
        repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
        filename: 'qwen2.5-7b-q4_k_m.gguf',
      });

      // Progress map should now have a placeholder for the returned modelId.
      const prog = useModelStore.getState().downloadProgress[expectedModelId];
      expect(prog).toBeDefined();
      expect(prog.modelId).toBe(expectedModelId);
      expect(prog.status).toBe('downloading');
      expect(prog.logs).toEqual([]);
    });

    it('should trim empty filename (user did not pick a specific file)', async () => {
      vi.mocked(invoke).mockResolvedValueOnce('placeholder-id');
      await useModelStore.getState().startDownload('Qwen/Qwen2.5-7B', '  ');

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('start_download', {
        repoId: 'Qwen/Qwen2.5-7B',
        filename: '',
      });
    });

    it('should reject on missing repoId', async () => {
      await expect(useModelStore.getState().startDownload('', 'foo.gguf')).rejects.toThrow(
        '缺少仓库 ID'
      );
      await expect(useModelStore.getState().startDownload('   ', 'foo.gguf')).rejects.toThrow(
        '缺少仓库 ID'
      );
    });

    it('should reject when backend returns non-string', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(null);
      await expect(
        useModelStore.getState().startDownload('Qwen/Qwen2.5-7B')
      ).rejects.toThrow('未返回有效的模型 ID');
    });

    it('should propagate backend errors', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('下载子进程启动失败'));
      await expect(
        useModelStore.getState().startDownload('Qwen/Qwen2.5-7B')
      ).rejects.toThrow('下载子进程启动失败');
      expect(useModelStore.getState().error).toBe('下载子进程启动失败');
    });
  });

  describe('cancelDownload', () => {
    it('should call cancel_download command', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useModelStore.getState().cancelDownload('dl-1');

      expect(vi.mocked(invoke)).toHaveBeenCalledWith('cancel_download', {
        id: 'dl-1',
      });
    });

    it('should remove existing progress on cancel', async () => {
      useModelStore.getState().updateDownloadProgress({
        modelId: 'dl-1',
        repoId: 'test',
        status: 'downloading',
      });
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useModelStore.getState().cancelDownload('dl-1');

      expect(useModelStore.getState().downloadProgress['dl-1']).toBeUndefined();
    });
  });

  describe('searchModels', () => {
    it('should search and map snake_case model info to camelCase', async () => {
      const backend = [
        {
          model_id: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
          author: 'Qwen',
          description: 'GGUF format model',
          downloads: 100000,
          likes: 5000,
          tags: ['GGUF'],
          last_modified: '2026-01-01',
          pipeline_tag: 'text-generation',
        },
      ];
      const expected: ModelSearchResult[] = [
        {
          id: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
          repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
          author: 'Qwen',
          description: 'GGUF format model',
          downloads: 100000,
          likes: 5000,
          tags: ['GGUF'],
          lastModified: '2026-01-01',
          pipelineTag: 'text-generation',
        },
      ];
      vi.mocked(invoke).mockResolvedValueOnce(backend);

      await useModelStore.getState().searchModels('Qwen');

      expect(useModelStore.getState().searchResults).toEqual(expected);
      expect(useModelStore.getState().loading).toBe(false);
    });

    it('should tolerate backend returning model in already camelCase form', async () => {
      const frontend = [
        {
          id: 'ms-1',
          repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
          author: 'Qwen',
          description: 'GGUF format model',
          downloads: 100000,
          likes: 5000,
          tags: ['GGUF'],
          lastModified: '2026-01-01',
          pipelineTag: 'text-generation',
        },
      ];
      vi.mocked(invoke).mockResolvedValueOnce(frontend);

      await useModelStore.getState().searchModels('Qwen');

      const state = useModelStore.getState();
      expect(state.searchResults[0].repoId).toBe('Qwen/Qwen2.5-7B-Instruct-GGUF');
      expect(state.searchResults[0].lastModified).toBe('2026-01-01');
    });

    it('should handle search error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('搜索失败'));

      await useModelStore.getState().searchModels('Qwen');

      expect(useModelStore.getState().error).toBe('搜索失败');
      expect(useModelStore.getState().loading).toBe(false);
    });
  });

  describe('updateDownloadProgress', () => {
    it('should update download progress for a model', () => {
      const progress: DownloadProgress = {
        modelId: 'dl-1',
        repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
        status: 'downloading',
      };

      useModelStore.getState().updateDownloadProgress(progress);

      const stored = useModelStore.getState().downloadProgress['dl-1'];
      expect(stored).toBeDefined();
      expect(stored.modelId).toBe('dl-1');
      expect(stored.repoId).toBe('Qwen/Qwen2.5-7B-Instruct-GGUF');
      expect(stored.status).toBe('downloading');
      expect(stored.logs).toEqual([]);
    });

    it('should update existing progress', () => {
      const initial: DownloadProgress = {
        modelId: 'dl-1',
        repoId: 'test',
        status: 'downloading',
      };
      const updated: DownloadProgress = {
        modelId: 'dl-1',
        repoId: 'test',
        status: 'completed',
        localPath: '/models/test.gguf',
      };

      useModelStore.getState().updateDownloadProgress(initial);
      useModelStore.getState().updateDownloadProgress(updated);

      expect(useModelStore.getState().downloadProgress['dl-1'].status).toBe('completed');
      expect(useModelStore.getState().downloadProgress['dl-1'].localPath).toBe('/models/test.gguf');
    });

    it('should handle multiple downloads', () => {
      const dl1: DownloadProgress = {
        modelId: 'dl-1',
        repoId: 'model-a',
        status: 'downloading',
      };
      const dl2: DownloadProgress = {
        modelId: 'dl-2',
        repoId: 'model-b',
        status: 'downloading',
      };

      useModelStore.getState().updateDownloadProgress(dl1);
      useModelStore.getState().updateDownloadProgress(dl2);

      expect(Object.keys(useModelStore.getState().downloadProgress)).toHaveLength(2);
    });
  });
});
