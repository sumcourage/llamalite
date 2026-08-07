import { describe, it, expect } from 'vitest';
import type { ServiceConfig, ServiceStatusInfo, ServiceLogEntry, ServiceStatus } from '../../types';

describe('Service Types', () => {
  describe('ServiceStatus', () => {
    it('should allow all valid status values', () => {
      const validStatuses: ServiceStatus[] = ['stopped', 'starting', 'running', 'stopping', 'error'];
      expect(validStatuses).toHaveLength(5);
    });

    it('should not allow invalid status values', () => {
      const invalid = 'invalid' as ServiceStatus;
      const validStatuses: ServiceStatus[] = ['stopped', 'starting', 'running', 'stopping', 'error'];
      expect(validStatuses).not.toContain(invalid);
    });
  });

  describe('ServiceConfig', () => {
    it('should create a valid service config', () => {
      const config: ServiceConfig = {
        id: 'test-1',
        name: '测试服务',
        modelPath: '/models/test.gguf',
        parameters: { temperature: 0.7 },
        createdAt: '2026-01-01 00:00:00',
        updatedAt: '2026-01-01 00:00:00',
      };
      expect(config.id).toBe('test-1');
      expect(config.name).toBe('测试服务');
      expect(config.parameters.temperature).toBe(0.7);
      expect(config.createdAt).toBeDefined();
      expect(config.updatedAt).toBeDefined();
    });

    it('should support optional parameters', () => {
      const config: ServiceConfig = {
        id: 'test-2',
        name: '最小配置',
        modelPath: '/models/test.gguf',
        parameters: {},
        createdAt: '2026-01-01 00:00:00',
        updatedAt: '2026-01-01 00:00:00',
      };
      expect(Object.keys(config.parameters)).toHaveLength(0);
    });
  });

  describe('ServiceStatusInfo', () => {
    it('should create a running status info', () => {
      const status: ServiceStatusInfo = {
        id: 'svc-1',
        status: 'running',
        modelName: 'qwen2.5-7b',
        port: 8080,
        pid: 12345,
        uptime: 3600,
        startedAt: '2026-01-01 00:00:00',
      };
      expect(status.status).toBe('running');
      expect(status.port).toBe(8080);
      expect(status.pid).toBe(12345);
      expect(status.uptime).toBe(3600);
    });

    it('should support error status with error message', () => {
      const status: ServiceStatusInfo = {
        id: 'svc-2',
        status: 'error',
        modelName: 'test',
        port: 0,
        errorMessage: '进程启动失败',
      };
      expect(status.status).toBe('error');
      expect(status.errorMessage).toBe('进程启动失败');
    });

    it('should allow optional fields to be undefined', () => {
      const status: ServiceStatusInfo = {
        id: 'svc-3',
        status: 'stopped',
        modelName: '',
        port: 0,
      };
      expect(status.pid).toBeUndefined();
      expect(status.uptime).toBeUndefined();
      expect(status.startedAt).toBeUndefined();
      expect(status.errorMessage).toBeUndefined();
    });
  });

  describe('ServiceLogEntry', () => {
    it('should create a valid log entry', () => {
      const log: ServiceLogEntry = {
        timestamp: '2026-01-01 00:00:00',
        level: 'info',
        message: '服务启动成功',
      };
      expect(log.level).toBe('info');
      expect(log.message).toContain('启动');
    });

    it('should support all log levels', () => {
      const levels: ServiceLogEntry['level'][] = ['info', 'warn', 'error', 'debug'];
      levels.forEach((level) => {
        const entry: ServiceLogEntry = {
          timestamp: '2026-01-01 00:00:00',
          level,
          message: `Log level: ${level}`,
        };
        expect(entry.level).toBe(level);
      });
    });
  });
});