import { describe, it, expect } from 'vitest';
import type { AppSettings } from '../../types';
import { defaultSettings } from '../../types/settings';

describe('Settings Types', () => {
  describe('AppSettings', () => {
    it('should create setting with default values', () => {
      expect(defaultSettings.theme).toBe('dark');
      expect(defaultSettings.language).toBe('zh-CN');
      expect(defaultSettings.firstRun).toBe(true);
    });

    it('should allow custom settings', () => {
      const settings: AppSettings = {
        modelsDir: '/home/user/models',
        llamaServerPath: '/usr/local/bin/llama-server',
        theme: 'dark',
        language: 'zh-CN',
        firstRun: false,
      };
      expect(settings.modelsDir).toBe('/home/user/models');
      expect(settings.llamaServerPath).toBe('/usr/local/bin/llama-server');
    });

    it('should allow optional fields to be undefined', () => {
      const settings: AppSettings = {
        theme: 'light',
        language: 'en',
        firstRun: false,
      };
      expect(settings.modelsDir).toBeUndefined();
      expect(settings.llamaServerPath).toBeUndefined();
    });
  });
});
