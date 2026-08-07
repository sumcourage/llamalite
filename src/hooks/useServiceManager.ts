import { useCallback, useEffect, useRef } from 'react';
import { useServiceStore } from '../stores/serviceStore';
import type { ServiceLogEntry, ServiceStatusInfo } from '../types';
import { parseLogString } from '../utils/logParser';

interface UseServiceManagerOptions {
  serviceId?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function useServiceManager(options: UseServiceManagerOptions = {}) {
  const { serviceId, autoRefresh = false, refreshInterval = 2000 } = options;
  const {
    services,
    currentStatus,
    serviceStatuses,
    logs,
    loading,
    error,
    fetchServices,
    createService,
    updateService,
    deleteService,
    startService,
    stopService,
    restartService,
    fetchStatus,
    fetchAllStatuses,
    fetchLogs,
    addLog,
    clearLogs,
    setError,
  } = useServiceStore();

  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Listen for service status changes
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        unlisten = await listen<Record<string, unknown>>('service-status-changed', (event) => {
          const payload = event.payload;
          // Build a ServiceStatusInfo from the event payload
          const status: ServiceStatusInfo = {
            id: (payload.id as string) || '',
            status: (payload.status as ServiceStatusInfo['status']) || 'stopped',
            modelName: (payload.modelName as string) || '',
            port: (payload.port as number) || 0,
            pid: payload.pid as number | undefined,
            startedAt: payload.startedAt as string | undefined,
            errorMessage: payload.errorMessage as string | undefined,
          };

          useServiceStore.setState((state) => {
            // When the backend stops a service, it clears service_id (sends null).
            // In that case, use the previous currentStatus id to update the right entry.
            const effectiveId = status.id || state.currentStatus?.id || '';

            // Build the status with the effective id
            const fullStatus = effectiveId ? { ...status, id: effectiveId } : status;

            // Update currentStatus
            const newCurrentStatus = fullStatus;

            // Update serviceStatuses: always keep the latest status (including stopped)
            const newStatuses = { ...state.serviceStatuses };
            if (effectiveId) {
              newStatuses[effectiveId] = fullStatus;
            }

            return {
              currentStatus: newCurrentStatus,
              serviceStatuses: newStatuses,
            };
          });
        });
      } catch {
        // Not running in Tauri environment
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Listen for service logs
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupListener = async () => {
      try {
        const { listen } = await import('@tauri-apps/api/event');
        // Backend emits { service_id: string, log: string }
        unlisten = await listen<{ service_id: string; log: string }>(
          'service-log',
          (event) => {
            const entry = parseLogString(event.payload.log);
            addLog(entry);
          },
        );
      } catch {
        // Not running in Tauri environment
      }
    };

    setupListener();

    return () => {
      if (unlisten) unlisten();
    };
  }, [addLog]);

  // Auto-refresh service status
  useEffect(() => {
    if (autoRefresh && serviceId) {
      refreshTimerRef.current = setInterval(() => {
        fetchStatus(serviceId);
      }, refreshInterval);

      return () => {
        if (refreshTimerRef.current) {
          clearInterval(refreshTimerRef.current);
        }
      };
    }
  }, [autoRefresh, serviceId, refreshInterval, fetchStatus]);

  // Initial fetch
  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const handleStart = useCallback(async (id: string) => {
    await startService(id);
  }, [startService]);

  const handleStop = useCallback(async (id: string) => {
    await stopService(id);
  }, [stopService]);

  const handleRestart = useCallback(async (id: string) => {
    await restartService(id);
  }, [restartService]);

  const handleDelete = useCallback(async (id: string) => {
    await deleteService(id);
  }, [deleteService]);

  return {
    services,
    currentStatus,
    serviceStatuses,
    logs,
    loading,
    error,
    fetchServices,
    createService,
    updateService,
    deleteService: handleDelete,
    startService: handleStart,
    stopService: handleStop,
    restartService: handleRestart,
    fetchStatus,
    fetchAllStatuses,
    fetchLogs,
    clearLogs,
    setError,
  };
}