import { create } from 'zustand';
import type { LocalModel, DownloadProgress, DownloadLogEntry, ModelSearchResult, RepoFile } from '../types';

interface ModelState {
  localModels: LocalModel[];
  downloadProgress: Record<string, DownloadProgress>;
  searchResults: ModelSearchResult[];
  loading: boolean;
  error: string | null;

  fetchLocalModels: () => Promise<void>;
  deleteModel: (id: string) => Promise<void>;
  startDownload: (repoId: string, filename?: string) => Promise<string>;
  cancelDownload: (modelId: string) => Promise<void>;
  deleteFailedDownload: (modelId: string) => Promise<void>;
  dismissDownload: (modelId: string) => void;
  searchModels: (query: string) => Promise<void>;
  listRepoFiles: (repoId: string) => Promise<RepoFile[]>;
  updateDownloadProgress: (progress: Partial<DownloadProgress> & { modelId: string }) => void;
  setError: (error: string | null) => void;
}

function mapLocalModelFromRust(raw: Record<string, unknown>): LocalModel {
  return {
    id: typeof raw.id === 'string' ? raw.id : `model-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    repoId: typeof raw.repo_id === 'string' ? raw.repo_id : typeof raw.repoId === 'string' ? raw.repoId : null,
    filename:
      typeof raw.filename === 'string' && raw.filename.length > 0
        ? raw.filename
        : 'unknown.gguf',
    path: typeof raw.local_path === 'string' ? raw.local_path : typeof raw.path === 'string' ? raw.path : '',
    size: typeof raw.size_bytes === 'number' ? raw.size_bytes : typeof raw.size === 'number' ? raw.size : 0,
    quantization:
      typeof raw.quantization === 'string'
        ? raw.quantization
        : typeof raw.quantization === 'string'
          ? raw.quantization
          : null,
    downloadDate:
      typeof raw.downloaded_at === 'string'
        ? raw.downloaded_at
        : typeof raw.downloadDate === 'string'
          ? raw.downloadDate
          : new Date().toISOString().slice(0, 10),
    description: typeof (raw.metadata as Record<string, unknown> | undefined)?.description === 'string'
      ? (raw.metadata as Record<string, unknown>).description as string
      : undefined,
    tags: Array.isArray((raw.metadata as Record<string, unknown> | undefined)?.tags)
      ? (raw.metadata as Record<string, unknown>).tags as string[]
      : undefined,
  };
}

export const useModelStore = create<ModelState>((set, get) => ({
  localModels: [],
  downloadProgress: {},
  searchResults: [],
  loading: false,
  error: null,

  fetchLocalModels: async () => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const raw = await invoke<unknown>('list_local_models');
      const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
      const models = list
        .map(mapLocalModelFromRust)
        .filter((m) => {
          // Filter out models that are still downloading
          // Only show fully downloaded models
          const tags = m.tags || [];
          return !tags.includes('downloading');
        });
      set({ localModels: models, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  deleteModel: async (id) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_model', { id });
      set((state) => ({
        localModels: state.localModels.filter((m) => m.id !== id),
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
      throw err;
    }
  },

  startDownload: async (repoId, filename) => {
    set({ error: null });
    if (!repoId || !repoId.trim()) {
      const err = new Error('下载模型失败：缺少仓库 ID (repoId)');
      set({ error: err.message });
      throw err;
    }

    const trimmedRepoId = repoId.trim();

    // Check if there's already an active download for this repoId
    const existingProgress = Object.values(get().downloadProgress).find(
      (p) =>
        p.repoId === trimmedRepoId &&
        p.status === 'downloading',
    );
    if (existingProgress) {
      const err = new Error(`该模型已在下载中，请勿重复提交`);
      set({ error: err.message });
      throw err;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const modelId = await invoke<string>('start_download', {
        repoId: trimmedRepoId,
        filename: (filename ?? '').trim(),
      });

      if (!modelId || typeof modelId !== 'string') {
        throw new Error('下载未返回有效的模型 ID');
      }

      const placeholder: DownloadProgress = {
        modelId,
        repoId: trimmedRepoId,
        status: 'downloading',
        logs: [],
      };
      set((state) => ({
        downloadProgress: {
          ...state.downloadProgress,
          [modelId]: placeholder,
        },
      }));

      void get().fetchLocalModels();
      return modelId;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg });
      throw err;
    }
  },

  cancelDownload: async (modelId) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('cancel_download', { id: modelId });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      // Always remove the download task from UI, even if backend fails
      set((state) => {
        const newProgress = { ...state.downloadProgress };
        delete newProgress[modelId];
        return { downloadProgress: newProgress };
      });
    }
  },

  deleteFailedDownload: async (modelId) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_paused_download', { id: modelId });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    } finally {
      // Always remove the download task from UI, even if backend fails
      set((state) => {
        const newProgress = { ...state.downloadProgress };
        delete newProgress[modelId];
        return { downloadProgress: newProgress };
      });
    }
  },

  dismissDownload: (modelId) => {
    // Remove a completed/errored download entry from the UI
    set((state) => {
      const newProgress = { ...state.downloadProgress };
      delete newProgress[modelId];
      return { downloadProgress: newProgress };
    });
  },

  searchModels: async (query) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const raw = await invoke<unknown>('search_hf_models', { query });
      const list = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
      const models: ModelSearchResult[] = list
        .map((item) => ({
          id:
            typeof item.model_id === 'string'
              ? item.model_id
              : typeof item.id === 'string'
                ? item.id
                : '',
          repoId:
            typeof item.repo_id === 'string' && item.repo_id.length > 0
              ? item.repo_id
              : typeof item.repoId === 'string' && item.repoId.length > 0
                ? item.repoId
                : typeof item.model_id === 'string' && item.model_id.length > 0
                  ? item.model_id
                  : typeof item.id === 'string'
                    ? item.id
                    : '',
          author: typeof item.author === 'string' ? item.author : '',
          description: typeof item.description === 'string' ? item.description : '',
          downloads: typeof item.downloads === 'number' ? item.downloads : 0,
          likes: typeof item.likes === 'number' ? item.likes : 0,
          tags: Array.isArray(item.tags) ? (item.tags as string[]) : [],
          lastModified:
            typeof item.last_modified === 'string' && item.last_modified.length > 0
              ? item.last_modified
              : typeof item.lastModified === 'string' && item.lastModified.length > 0
                ? item.lastModified
                : '',
          pipelineTag:
            typeof item.pipeline_tag === 'string'
              ? item.pipeline_tag
              : typeof item.pipelineTag === 'string'
                ? item.pipelineTag
                : undefined,
          totalSizeBytes:
            typeof item.total_size_bytes === 'number'
              ? item.total_size_bytes
              : typeof item.totalSizeBytes === 'number'
                ? item.totalSizeBytes
                : undefined,
        }))
        .filter((m) => {
          // Filter out models that don't have GGUF files
          const repoIdLower = m.repoId.toLowerCase();
          const tagsLower = m.tags.map((t) => t.toLowerCase());
          return (
            repoIdLower.includes('gguf') ||
            tagsLower.includes('gguf') ||
            tagsLower.some((t) => t.includes('gguf'))
          );
        });
      set({ searchResults: models, loading: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), loading: false });
    }
  },

  listRepoFiles: async (repoId) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const files = await invoke<RepoFile[]>('list_repo_files', { repoId: repoId.trim() });
      set({ loading: false });
      return files;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ error: msg, loading: false });
      throw err;
    }
  },

  updateDownloadProgress: (progress) => {
    set((state) => {
      const existing = state.downloadProgress[progress.modelId];
      if (!existing) {
        // Create new entry if it doesn't exist
        return {
          downloadProgress: {
            ...state.downloadProgress,
            [progress.modelId]: {
              modelId: progress.modelId,
              repoId: progress.repoId || '',
              status: progress.status || 'downloading',
              localPath: progress.localPath,
              logs: progress.logs || [],
              errorMessage: progress.errorMessage,
            },
          },
        };
      }

      // Merge with existing entry — only overwrite fields that are explicitly defined
      const merged: DownloadProgress = {
        ...existing,
        ...(progress.repoId !== undefined && { repoId: progress.repoId }),
        ...(progress.status !== undefined && { status: progress.status }),
        ...(progress.localPath !== undefined && { localPath: progress.localPath }),
        ...(progress.errorMessage !== undefined && { errorMessage: progress.errorMessage }),
      };

      // Handle log accumulation (with deduplication)
      const rawProgress = progress as Record<string, unknown>;
      if (rawProgress.isLog && typeof rawProgress.message === 'string') {
        const logMessage = rawProgress.message as string;
        const logLevel = (rawProgress.level as DownloadLogEntry['level']) || 'info';
        const prevLogs = existing.logs || [];
        // Skip if the last log entry has the same message and level
        const lastLog = prevLogs.length > 0 ? prevLogs[prevLogs.length - 1] : null;
        if (lastLog && lastLog.message === logMessage && lastLog.level === logLevel) {
          // Duplicate — don't add
        } else {
          const logEntry: DownloadLogEntry = {
            timestamp: new Date().toLocaleTimeString(),
            level: logLevel,
            message: logMessage,
          };
          merged.logs = [...prevLogs, logEntry];
        }
      }

      // Handle deleted status
      if (progress.status === 'deleted') {
        const newProgress = { ...state.downloadProgress };
        delete newProgress[progress.modelId];
        return { downloadProgress: newProgress };
      }

      return {
        downloadProgress: {
          ...state.downloadProgress,
          [progress.modelId]: merged,
        },
      };
    });
  },

  setError: (error) => set({ error }),
}));
