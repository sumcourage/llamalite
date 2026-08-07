import { useEffect, useCallback, useRef } from 'react';
import { useModelStore } from '../stores/modelStore';
import type { DownloadProgress } from '../types';

export function useModelDownload() {
  const {
    downloadProgress,
    localModels,
    loading,
    error,
    fetchLocalModels,
    deleteModel,
    startDownload,
    cancelDownload,
    deleteFailedDownload,
    dismissDownload,
    searchModels,
    updateDownloadProgress,
    setError,
  } = useModelStore();

  const unlistenRef = useRef<(() => void) | undefined>();
  const isSettingUp = useRef(false);

  // Listen for download progress events
  useEffect(() => {
    // Prevent duplicate listener registration (React StrictMode)
    if (isSettingUp.current) return;
    isSettingUp.current = true;

    const setupListeners = async () => {
      const { listen } = await import('@tauri-apps/api/event');

      const unlistenProgress = await listen<Record<string, unknown>>('download-progress', (event) => {
        const payload = event.payload;
        const modelId = typeof payload.modelId === 'string' ? payload.modelId : '';
        if (!modelId) return;

        // Build the progress object for the store
        const progress: Partial<DownloadProgress> & { modelId: string } = {
          modelId,
          repoId: typeof payload.repoId === 'string' ? payload.repoId : undefined,
          status: typeof payload.status === 'string'
            ? (payload.status as DownloadProgress['status'])
            : undefined,
          errorMessage: typeof payload.errorMessage === 'string' ? payload.errorMessage : undefined,
          localPath: typeof payload.localPath === 'string' ? payload.localPath : undefined,
        };

        // Pass through log-related fields
        if (payload.isLog) {
          (progress as Record<string, unknown>).isLog = true;
          (progress as Record<string, unknown>).message = payload.message;
          (progress as Record<string, unknown>).level = payload.level;
        }

        updateDownloadProgress(progress);
      });

      const unlistenComplete = await listen<{ modelId: string }>('download-complete', (event) => {
        updateDownloadProgress({
          modelId: event.payload.modelId,
          status: 'completed',
        });
        fetchLocalModels();
      });

      const unlistenError = await listen<{
        modelId: string;
        errorMessage?: string;
        error?: string;
        status?: string;
      }>('download-error', (event) => {
        if (event.payload.status === 'cancelled') {
          // Cancelled — remove the progress entry entirely.
          updateDownloadProgress({
            modelId: event.payload.modelId,
            status: 'deleted',
          });
        } else {
          updateDownloadProgress({
            modelId: event.payload.modelId,
            status: 'error' as DownloadProgress['status'],
            errorMessage: event.payload.errorMessage || event.payload.error,
          });
        }
      });

      unlistenRef.current = () => {
        unlistenProgress();
        unlistenComplete();
        unlistenError();
      };
    };

    setupListeners();

    return () => {
      isSettingUp.current = false;
      if (unlistenRef.current) {
        unlistenRef.current();
      }
    };
  }, [updateDownloadProgress, fetchLocalModels]);

  // Initial fetch
  useEffect(() => {
    fetchLocalModels();
  }, [fetchLocalModels]);

  const handleDownload = useCallback(async (repoId: string, filename?: string) => {
    await startDownload(repoId, filename);
  }, [startDownload]);

  const handleCancel = useCallback(async (modelId: string) => {
    await cancelDownload(modelId);
  }, [cancelDownload]);

  const handleDeleteFailed = useCallback(async (modelId: string) => {
    await deleteFailedDownload(modelId);
  }, [deleteFailedDownload]);

  const handleDismiss = useCallback((modelId: string) => {
    dismissDownload(modelId);
  }, [dismissDownload]);

  const handleSearch = useCallback(async (query: string) => {
    await searchModels(query);
  }, [searchModels]);

  return {
    localModels,
    downloadProgress,
    loading,
    error,
    fetchLocalModels,
    deleteModel,
    startDownload: handleDownload,
    cancelDownload: handleCancel,
    deleteFailedDownload: handleDeleteFailed,
    dismissDownload: handleDismiss,
    searchModels: handleSearch,
    setError,
  };
}
