import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useSettingsStore } from '../../stores/settingsStore';
import { defaultSettings } from '../../types/settings';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import('@tauri-apps/api/core');

describe('useSettingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      settings: defaultSettings,
      loading: false,
      error: null,
      environmentStatus: null,
      checkingEnvironment: false,
    });
    vi.clearAllMocks();
  });

  describe('初始状态', () => {
    it('should have default settings', () => {
      const state = useSettingsStore.getState();
      expect(state.settings.theme).toBe('dark');
      expect(state.settings.language).toBe('zh-CN');
      expect(state.settings.firstRun).toBe(true);
    });
  });

  describe('fetchSettings', () => {
    it('should fetch settings from backend', async () => {
      const mockSettings = {
        modelsDir: '/home/user/models',
        llamaServerPath: '',
        theme: 'dark',
        language: 'zh-CN',
        firstRun: false,
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockSettings);

      await useSettingsStore.getState().fetchSettings();

      const state = useSettingsStore.getState();
      expect(state.settings.modelsDir).toBe('/home/user/models');
      expect(state.settings.firstRun).toBe(false);
      expect(state.loading).toBe(false);
    });

    it('should handle fetch error gracefully', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('获取失败'));

      await useSettingsStore.getState().fetchSettings();

      // Should keep existing settings on error
      const state = useSettingsStore.getState();
      expect(state.settings.theme).toBe('dark');
      expect(state.loading).toBe(false);
    });
  });

  describe('updateSettings', () => {
    it('should update settings on backend', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useSettingsStore.getState().updateSettings({
        modelsDir: '/home/user/models',
      });

      expect(useSettingsStore.getState().settings.modelsDir).toBe('/home/user/models');
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('update_settings', {
        settings: expect.objectContaining({
          modelsDir: '/home/user/models',
        }),
      });
    });

    it('should merge settings with existing values', async () => {
      vi.mocked(invoke).mockResolvedValueOnce(undefined);

      await useSettingsStore.getState().updateSettings({
        llamaServerPath: '/usr/local/bin/llama-server',
      });

      const state = useSettingsStore.getState();
      expect(state.settings.llamaServerPath).toBe('/usr/local/bin/llama-server');
      // Other values should remain unchanged
      expect(state.settings.theme).toBe('dark');
    });

    it('should handle update error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('更新失败'));

      await expect(
        useSettingsStore.getState().updateSettings({ modelsDir: 'test' })
      ).rejects.toThrow('更新失败');

      expect(useSettingsStore.getState().error).toBe('Error: 更新失败');
    });
  });

  describe('checkEnvironment', () => {
    it('should check environment status', async () => {
      const mockStatus = {
        llamaServer: { name: 'llama.cpp Server', installed: true, version: 'b3000', message: '就绪', installUrl: null },
        modelscope: { name: 'ModelScope', installed: true, version: '1.0.0', message: '已安装', installUrl: null },
        python: { name: 'Python', installed: true, version: 'Python 3.12', message: '已安装', installUrl: null },
        allReady: true,
      };
      vi.mocked(invoke).mockResolvedValueOnce(mockStatus);

      const result = await useSettingsStore.getState().checkEnvironment();

      expect(result).toEqual(mockStatus);
      expect(useSettingsStore.getState().environmentStatus).toEqual(mockStatus);
      expect(useSettingsStore.getState().checkingEnvironment).toBe(false);
    });

    it('should handle environment check error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('检查失败'));

      const result = await useSettingsStore.getState().checkEnvironment();

      expect(result).toBeNull();
      expect(useSettingsStore.getState().error).toBe('Error: 检查失败');
    });
  });

  describe('checkExecutablePath', () => {
    it('should return true for valid executable', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ installed: true });

      const result = await useSettingsStore.getState().checkExecutablePath('/usr/local/bin/llama-server');

      expect(result).toBe(true);
    });

    it('should return false for invalid executable', async () => {
      vi.mocked(invoke).mockResolvedValueOnce({ installed: false });

      const result = await useSettingsStore.getState().checkExecutablePath('invalid.exe');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      vi.mocked(invoke).mockRejectedValueOnce(new Error('检查失败'));

      const result = await useSettingsStore.getState().checkExecutablePath('error.exe');

      expect(result).toBe(false);
    });
  });
});
