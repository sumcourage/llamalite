import { create } from 'zustand';
import type { AppSettings, EnvironmentStatus, ComponentStatus } from '../types';

interface SettingsState {
  settings: AppSettings;
  loading: boolean;
  error: string | null;
  environmentStatus: EnvironmentStatus | null;
  checkingEnvironment: boolean;

  fetchSettings: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  checkEnvironment: () => Promise<EnvironmentStatus | null>;
  checkExecutablePath: (path: string) => Promise<boolean>;
  setError: (error: string | null) => void;
}

const defaultSettings: AppSettings = {
  modelsDir: '',
  llamaServerPath: '',
  theme: 'dark',
  language: 'zh-CN',
  firstRun: true,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  loading: false,
  error: null,
  environmentStatus: null,
  checkingEnvironment: false,

  fetchSettings: async () => {
    set({ loading: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const settings = await invoke<AppSettings>('get_settings');
      set({ settings, loading: false });
    } catch (err) {
      set({ loading: false });
    }
  },

  updateSettings: async (newSettings) => {
    set({ error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const current = get().settings;
      const updated = { ...current, ...newSettings };
      await invoke('update_settings', { settings: updated });
      set({ settings: updated });
    } catch (err) {
      set({ error: String(err) });
      throw err;
    }
  },

  checkEnvironment: async () => {
    set({ checkingEnvironment: true, error: null });
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const raw = await invoke<any>('check_environment');
      // Map snake_case fields from Rust backend to camelCase for frontend
      const mapComponent = (c: any): ComponentStatus => ({
        name: c.name,
        installed: c.installed,
        version: c.version,
        message: c.message,
        installUrl: c.install_url ?? c.installUrl,
        installGuide: c.install_guide ?? c.installGuide,
      });
      const status: EnvironmentStatus = {
        llamaServer: mapComponent(raw.llama_server ?? raw.llamaServer),
        modelscope: mapComponent(raw.modelscope ?? raw.modelScope),
        python: mapComponent(raw.python),
        allReady: raw.all_ready ?? raw.allReady,
      };
      set({ environmentStatus: status, checkingEnvironment: false });
      return status;
    } catch (err) {
      set({ error: String(err), checkingEnvironment: false });
      return null;
    }
  },

  checkExecutablePath: async (path: string) => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = await invoke<{ installed: boolean }>('check_executable_path', { path });
      return result.installed;
    } catch {
      return false;
    }
  },

  setError: (error) => set({ error }),
}));
