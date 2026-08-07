import { describe, it, expect } from 'vitest';
import type { LocalModel, DownloadProgress, ModelSearchResult } from '../../types';

describe('Model Types', () => {
  describe('LocalModel', () => {
    it('should create a valid local model', () => {
      const model: LocalModel = {
        id: 'model-1',
        repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
        filename: 'qwen2.5-7b-q4_k_m.gguf',
        path: '/models/qwen2.5-7b-q4_k_m.gguf',
        size: 4_500_000_000,
        quantization: 'Q4_K_M',
        downloadDate: '2026-01-01',
        description: '通义千问 2.5 7B 指令模型',
      };
      expect(model.id).toBe('model-1');
      expect(model.size).toBeGreaterThan(0);
      expect(model.quantization).toBe('Q4_K_M');
    });

    it('should allow optional description', () => {
      const model: LocalModel = {
        id: 'model-2',
        repoId: 'test/test',
        filename: 'test.gguf',
        path: '/models/test.gguf',
        size: 1000,
        quantization: 'Q4_0',
        downloadDate: '2026-01-01',
      };
      expect(model.description).toBeUndefined();
    });
  });

  describe('DownloadProgress', () => {
    it('should create a downloading progress', () => {
      const progress: DownloadProgress = {
        modelId: 'dl-1',
        repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
        status: 'downloading',
      };
      expect(progress.status).toBe('downloading');
    });

    it('should support completed status', () => {
      const progress: DownloadProgress = {
        modelId: 'dl-2',
        repoId: 'test/test',
        status: 'completed',
      };
      expect(progress.status).toBe('completed');
    });

    it('should support error status with message', () => {
      const progress: DownloadProgress = {
        modelId: 'dl-3',
        repoId: 'test/test',
        status: 'error',
        errorMessage: '网络连接失败',
      };
      expect(progress.status).toBe('error');
      expect(progress.errorMessage).toBeDefined();
    });

    it('should support logs', () => {
      const progress: DownloadProgress = {
        modelId: 'dl-4',
        repoId: 'test/test',
        status: 'downloading',
        logs: [
          { timestamp: '12:00:00', level: 'info', message: '开始下载' },
          { timestamp: '12:00:01', level: 'success', message: '下载完成' },
        ],
      };
      expect(progress.logs).toHaveLength(2);
      expect(progress.logs![0].level).toBe('info');
    });
  });

  describe('ModelSearchResult', () => {
    it('should create a valid model search result entry', () => {
      const model: ModelSearchResult = {
        id: 'ms-1',
        repoId: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
        author: 'Qwen',
        description: 'Qwen2.5 7B GGUF',
        downloads: 100_000,
        likes: 5000,
        tags: ['GGUF', 'Qwen', '7B'],
        lastModified: '2026-01-01',
        pipelineTag: 'text-generation',
      };
      expect(model.downloads).toBeGreaterThan(0);
      expect(model.tags).toContain('GGUF');
    });
  });
});
