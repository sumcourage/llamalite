import { describe, it, expect } from 'vitest';
import type { ParameterMeta, ParameterValues, ParameterCategory, ParameterType } from '../../types';

describe('Parameter Types', () => {
  describe('ParameterCategory', () => {
    it('should support all categories', () => {
      const categories: ParameterCategory[] = ['general', 'sampling', 'server'];
      expect(categories).toHaveLength(3);
    });
  });

  describe('ParameterType', () => {
    it('should support all parameter types', () => {
      const types: ParameterType[] = ['number', 'string', 'boolean', 'select', 'file'];
      expect(types).toHaveLength(5);
    });
  });

  describe('ParameterMeta', () => {
    it('should create a number parameter', () => {
      const param: ParameterMeta = {
        key: 'temperature',
        flag: '',
        fullFlag: '--temp',
        category: 'sampling',
        label: '温度',
        description: '控制生成文本的随机性',
        type: 'number',
        defaultValue: 0.8,
        validation: { min: 0, max: 5, step: 0.05 },
      };
      expect(param.type).toBe('number');
      expect(param.defaultValue).toBe(0.8);
      expect(param.validation?.min).toBe(0);
    });

    it('should create a select parameter with options', () => {
      const param: ParameterMeta = {
        key: 'cache-type-k',
        flag: '-ctk',
        fullFlag: '--cache-type-k',
        category: 'general',
        label: 'K 缓存类型',
        description: '指定 K 缓存的数据类型',
        type: 'select',
        defaultValue: 'f16',
        options: [
          { label: 'f16 (半精度)', value: 'f16' },
          { label: 'q8_0 (8位量化)', value: 'q8_0' },
        ],
        advanced: true,
      };
      expect(param.type).toBe('select');
      expect(param.options).toHaveLength(2);
      expect(param.advanced).toBe(true);
    });

    it('should create a boolean parameter', () => {
      const param: ParameterMeta = {
        key: 'mlock',
        flag: '',
        fullFlag: '--mlock',
        category: 'general',
        label: '锁定内存',
        description: '将模型锁定在物理内存中',
        type: 'boolean',
        defaultValue: false,
        advanced: true,
      };
      expect(param.type).toBe('boolean');
      expect(param.defaultValue).toBe(false);
    });
  });

  describe('ParameterValues', () => {
    it('should support mixed parameter value types', () => {
      const values: ParameterValues = {
        temperature: 0.7,
        'ctx-size': 4096,
        'n-gpu-layers': 20,
        host: '127.0.0.1',
        mlock: true,
        'cache-type-k': 'f16',
      };
      expect(typeof values.temperature).toBe('number');
      expect(typeof values.host).toBe('string');
      expect(typeof values.mlock).toBe('boolean');
    });

    it('should allow empty values', () => {
      const values: ParameterValues = {};
      expect(Object.keys(values)).toHaveLength(0);
    });
  });
});