import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useParameterValidation } from '../../hooks/useParameterValidation';

describe('useParameterValidation', () => {
  let result: ReturnType<
    typeof renderHook<ReturnType<typeof useParameterValidation>, unknown>
  >;

  beforeEach(() => {
    result = renderHook(() => useParameterValidation());
  });

  describe('validateParameter', () => {
    it('should return null for valid number values', () => {
      const { validateParameter } = result.result.current;
      expect(validateParameter('threads', 8)).toBeNull();
      expect(validateParameter('temperature', 0.8)).toBeNull();
      expect(validateParameter('port', 8080)).toBeNull();
      expect(validateParameter('ctx-size', 4096)).toBeNull();
    });

    it('should return error for out-of-range values', () => {
      const { validateParameter } = result.result.current;

      // Below minimum
      const belowMin = validateParameter('threads', 0);
      expect(belowMin).not.toBeNull();
      expect(belowMin!.key).toBe('threads');
      expect(belowMin!.message).toContain('不能小于');

      // Above maximum
      const aboveMax = validateParameter('threads', 200);
      expect(aboveMax).not.toBeNull();
      expect(aboveMax!.key).toBe('threads');
      expect(aboveMax!.message).toContain('不能大于');

      // Temperature out of range
      const tempHigh = validateParameter('temperature', 6);
      expect(tempHigh).not.toBeNull();
      expect(tempHigh!.key).toBe('temperature');

      // Negative values where min is 0
      const negValue = validateParameter('top-p', -1);
      expect(negValue).not.toBeNull();
      expect(negValue!.key).toBe('top-p');
    });

    it('should validate step multiples', () => {
      const { validateParameter } = result.result.current;

      // temperature step is 0.05, 0.12 is not a multiple
      const invalidStep = validateParameter('temperature', 0.12);
      expect(invalidStep).not.toBeNull();
      expect(invalidStep!.key).toBe('temperature');
      expect(invalidStep!.message).toContain('倍数');

      // 0.15 is a multiple of 0.05
      expect(validateParameter('temperature', 0.15)).toBeNull();

      // threads step is 1, 2.5 is not a multiple
      const threadsStep = validateParameter('threads', 2.5);
      expect(threadsStep).not.toBeNull();
      expect(threadsStep!.key).toBe('threads');
    });

    it('should validate select options', () => {
      const { validateParameter } = result.result.current;

      // cache-type-k has options ['f16', 'q8_0']
      const invalidOption = validateParameter('cache-type-k', 'invalid');
      expect(invalidOption).not.toBeNull();
      expect(invalidOption!.key).toBe('cache-type-k');
      expect(invalidOption!.message).toContain('无效');

      // Valid option
      expect(validateParameter('cache-type-k', 'f16')).toBeNull();
      expect(validateParameter('cache-type-k', 'q8_0')).toBeNull();

      // split-mode has options ['none', 'layer', 'row']
      expect(validateParameter('split-mode', 'layer')).toBeNull();
      expect(validateParameter('split-mode', 'invalid')).not.toBeNull();
    });

    it('should return null for unknown keys', () => {
      const { validateParameter } = result.result.current;
      expect(validateParameter('unknown-key', 123)).toBeNull();
      expect(validateParameter('non-existent', 'value')).toBeNull();
    });

    it('should return null for empty values', () => {
      const { validateParameter } = result.result.current;
      expect(validateParameter('threads', undefined)).toBeNull();
      expect(validateParameter('threads', null)).toBeNull();
      expect(validateParameter('threads', '')).toBeNull();
      expect(validateParameter('temperature', undefined)).toBeNull();
    });
  });

  describe('validateAll', () => {
    it('should return all errors for multiple invalid values', () => {
      const { validateAll } = result.result.current;
      const errors = validateAll({
        threads: 0,
        temperature: 6,
        'cache-type-k': 'invalid',
      });
      expect(errors).toHaveLength(3);
      expect(errors.map((e) => e.key)).toEqual(
        expect.arrayContaining(['threads', 'temperature', 'cache-type-k']),
      );
    });

    it('should return empty array for valid values', () => {
      const { validateAll } = result.result.current;
      const errors = validateAll({
        threads: 8,
        temperature: 0.8,
        port: 8080,
        'ctx-size': 4096,
      });
      expect(errors).toEqual([]);
    });
  });

  describe('getDefaultValues', () => {
    it('should return all default values', () => {
      const defaults = result.result.current.getDefaultValues();
      expect(defaults.threads).toBe(8);
      expect(defaults.temperature).toBe(0.8);
      expect(defaults.port).toBe(8080);
      expect(defaults['ctx-size']).toBe(2048);
      expect(defaults['top-p']).toBe(0.9);
      expect(defaults['batch-size']).toBe(2048);
      expect(defaults['repeat-penalty']).toBe(1.0);
      expect(defaults.host).toBe('127.0.0.1');
      expect(defaults.mlock).toBe(false);
      expect(defaults['cont-batching']).toBe(true);
    });

    it('should match number of params with defaults', () => {
      const defaults = result.result.current.getDefaultValues();
      // PARAMETER_DEFINITIONS has many entries with default values
      expect(Object.keys(defaults).length).toBeGreaterThan(10);
    });
  });

  describe('mergeStoredValues', () => {
    it('should restore parameters that have no default value', () => {
      const values = result.result.current.mergeStoredValues({
        alias: 'my-model',
        'api-key': 'sk-123',
        device: 'CUDA0',
        'json-schema': '{"type":"object"}',
        'hf-repo': 'Qwen/Qwen2.5-7B-GGUF',
      });

      expect(values.alias).toBe('my-model');
      expect(values['api-key']).toBe('sk-123');
      expect(values.device).toBe('CUDA0');
      expect(values['json-schema']).toBe('{"type":"object"}');
      expect(values['hf-repo']).toBe('Qwen/Qwen2.5-7B-GGUF');
    });

    it('should fill defaults for keys missing from stored values', () => {
      const values = result.result.current.mergeStoredValues({ port: 9000 });
      expect(values.port).toBe(9000);
      expect(values.threads).toBe(8);
      expect(values.host).toBe('127.0.0.1');
    });

    it('should return defaults when nothing is stored', () => {
      const values = result.result.current.mergeStoredValues(undefined);
      expect(values.threads).toBe(8);
      expect(values['cont-batching']).toBe(true);
    });

    it('should coerce string numbers back to numbers', () => {
      const values = result.result.current.mergeStoredValues({
        threads: '16',
        temperature: '0.5',
      });
      expect(values.threads).toBe(16);
      expect(values.temperature).toBe(0.5);
    });

    it('should coerce boolean-like values', () => {
      const values = result.result.current.mergeStoredValues({
        mlock: 'true',
        'flash-attn': 0,
        embedding: false,
      });
      expect(values.mlock).toBe(true);
      expect(values['flash-attn']).toBe(false);
      expect(values.embedding).toBe(false);
    });

    it('should keep unknown keys so they are not lost on save', () => {
      const values = result.result.current.mergeStoredValues({
        'legacy-param': 'value',
      });
      expect(values['legacy-param']).toBe('value');
    });

    it('should skip empty values and fall back to defaults', () => {
      const values = result.result.current.mergeStoredValues({
        alias: '',
        'api-key': null,
        port: undefined,
      });
      expect(values.alias).toBeUndefined();
      expect(values['api-key']).toBeUndefined();
      expect(values.port).toBe(8080);
    });
  });

  describe('serializeParameters', () => {
    it('should convert boolean flags', () => {
      const args = result.result.current.serializeParameters({ mlock: true });
      expect(args).toContain('--mlock');
      // Boolean false should not be included
      const argsFalse = result.result.current.serializeParameters({ mlock: false });
      expect(argsFalse).not.toContain('--mlock');
    });

    it('should skip undefined values', () => {
      const args = result.result.current.serializeParameters({ threads: undefined });
      expect(args).not.toContain('--threads');
    });

    it('should include --flag and value for string params', () => {
      const args = result.result.current.serializeParameters({ alias: 'my-model' });
      expect(args).toContain('--alias');
      expect(args).toContain('my-model');
    });

    it('should handle port parameter', () => {
      const args = result.result.current.serializeParameters({ port: 8080 });
      expect(args).toContain('--port');
      expect(args).toContain('8080');
    });
  });

  describe('parameterMap', () => {
    it('should contain all parameter definitions', () => {
      const map = result.result.current.parameterMap;
      expect(map.size).toBeGreaterThan(50);
    });

    it('should have temperature key', () => {
      const map = result.result.current.parameterMap;
      expect(map.has('temperature')).toBe(true);
      expect(map.get('temperature')!.key).toBe('temperature');
      expect(map.get('temperature')!.type).toBe('number');
      expect(map.get('temperature')!.defaultValue).toBe(0.8);
    });
  });
});