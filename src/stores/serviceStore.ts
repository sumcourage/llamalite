import { create } from 'zustand';
import type { ServiceConfig, ServiceStatusInfo, ServiceLogEntry } from '../types';
import { parseLogStrings } from '../utils/logParser';

interface ServiceState {
  services: ServiceConfig[];
  currentStatus: ServiceStatusInfo | null;
  serviceStatuses: Record<string, ServiceStatusInfo>;
  logs: ServiceLogEntry[];
  loading: boolean;
  error: string | null;

  fetchServices: () => Promise<void>;
  createService: (service: Omit<ServiceConfig, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateService: (id: string, updates: Partial<ServiceConfig>) => Promise<void>;
  deleteService: (id: string) => Promise<void>;
  startService: (id: string) => Promise<void>;
  stopService: (id: string) => Promise<void>;
  restartService: (id: string) => Promise<void>;
  fetchStatus: (id: string) => Promise<void>;
  fetchAllStatuses: () => Promise<void>;
  fetchLogs: (id: string) => Promise<void>;
  addLog: (log: ServiceLogEntry) => void;
  clearLogs: () => void;
  setError: (error: string | null) => void;
}

export const useServiceStore = create<ServiceState>((set, get) => ({
  services: [],
  currentStatus: null,
  serviceStatuses: {},
  logs: [],
  loading: false,
  error: null,

  fetchServices: async () => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const services = await invoke<ServiceConfig[]>('list_services');
      set({ services, loading: false });
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  createService: async (service) => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('create_service', {
        name: service.name,
        modelPath: service.modelPath,
        parameters: service.parameters,
      });
      await get().fetchServices();
    } catch (err) {
      set({ error: String(err), loading: false });
      throw err;
    }
  },

  updateService: async (id, updates) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('update_service', {
        id,
        name: updates.name,
        modelPath: updates.modelPath,
        parameters: updates.parameters,
      });
      await get().fetchServices();
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  deleteService: async (id) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('delete_service', { id });
      set((state) => ({
        services: state.services.filter((s) => s.id !== id),
      }));
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  startService: async (id) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('start_service', { id });
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  stopService: async (id) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_service', { id });
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  restartService: async (id) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('restart_service', { id });
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  fetchStatus: async (id) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<ServiceStatusInfo | null>('get_service_status', { id });
      set((state) => ({
        currentStatus: status,
        serviceStatuses: status
          ? { ...state.serviceStatuses, [id]: status }
          : state.serviceStatuses,
      }));
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  },

  fetchAllStatuses: async () => {
    const { services } = get();
    for (const service of services) {
      await get().fetchStatus(service.id);
    }
  },

  fetchLogs: async (id) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Backend returns Vec<String>; parse into structured entries
      const raw = await invoke<string[]>('get_service_logs', { id });
      const logs = parseLogStrings(raw);
      set({ logs });
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    }
  },

  addLog: (log) => {
    set((state) => ({
      logs: [...state.logs.slice(-999), log],
    }));
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  setError: (error) => set({ error }),
}));