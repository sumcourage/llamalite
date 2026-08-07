import { describe, it, expect } from 'vitest';
import {
  PARAMETER_DEFINITIONS,
  PARAMETER_CATEGORIES,
  CATEGORY_ORDER,
  getParameterByKey,
  getParametersByCategory,
  getDefaultParameterValues,
} from '../../constants/parameters';

describe('Parameters Constants', () => {
  describe('PARAMETER_DEFINITIONS', () => {
    it('should contain all parameter definitions', () => {
      expect(PARAMETER_DEFINITIONS.length).toBeGreaterThan(50);
    });

    it('should have unique keys for all parameters', () => {
      const keys = PARAMETER_DEFINITIONS.map((p) => p.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });

    it('should have valid category for all parameters', () => {
      const validCategories = ['general', 'sampling', 'server'];
      PARAMETER_DEFINITIONS.forEach((p) => {
        expect(validCategories).toContain(p.category);
      });
    });

    it('should have valid type for all parameters', () => {
      const validTypes = ['number', 'string', 'boolean', 'select', 'file'];
      PARAMETER_DEFINITIONS.forEach((p) => {
        expect(validTypes).toContain(p.type);
      });
    });

    it('should have fullFlag starting with -- for all parameters', () => {
      PARAMETER_DEFINITIONS.forEach((p) => {
        expect(p.fullFlag).toMatch(/^--/);
      });
    });

    it('should have valid validation for number parameters', () => {
      const numberParams = PARAMETER_DEFINITIONS.filter((p) => p.type === 'number');
      numberParams.forEach((p) => {
        expect(p.validation).toBeDefined();
        if (p.validation) {
          expect(p.validation.min).toBeDefined();
          expect(p.validation.max).toBeDefined();
          expect(p.validation.step).toBeDefined();
        }
      });
    });
  });

  describe('PARAMETER_CATEGORIES', () => {
    it('should have 3 categories', () => {
      expect(PARAMETER_CATEGORIES).toHaveLength(3);
    });

    it('should contain general, sampling, and server', () => {
      const keys = PARAMETER_CATEGORIES.map((c) => c.key);
      expect(keys).toContain('general');
      expect(keys).toContain('sampling');
      expect(keys).toContain('server');
    });
  });

  describe('CATEGORY_ORDER', () => {
    it('should have correct order', () => {
      expect(CATEGORY_ORDER).toEqual(['general', 'sampling', 'server']);
    });
  });

  describe('getParameterByKey', () => {
    it('should return parameter for valid key', () => {
      const param = getParameterByKey('temperature');
      expect(param).toBeDefined();
      expect(param?.key).toBe('temperature');
      expect(param?.category).toBe('sampling');
    });

    it('should return undefined for invalid key', () => {
      const param = getParameterByKey('non-existent-key');
      expect(param).toBeUndefined();
    });
  });

  describe('getParametersByCategory', () => {
    it('should return all general parameters', () => {
      const generalParams = getParametersByCategory('general');
      expect(generalParams.length).toBeGreaterThan(0);
      generalParams.forEach((p) => {
        expect(p.category).toBe('general');
      });
    });

    it('should return all sampling parameters', () => {
      const samplingParams = getParametersByCategory('sampling');
      expect(samplingParams.length).toBeGreaterThan(0);
      samplingParams.forEach((p) => {
        expect(p.category).toBe('sampling');
      });
    });

    it('should return all server parameters', () => {
      const serverParams = getParametersByCategory('server');
      expect(serverParams.length).toBeGreaterThan(0);
      serverParams.forEach((p) => {
        expect(p.category).toBe('server');
      });
    });
  });

  describe('getDefaultParameterValues', () => {
    it('should return default values for all parameters with defaults', () => {
      const defaults = getDefaultParameterValues();
      const paramsWithDefaults = PARAMETER_DEFINITIONS.filter(
        (p) => p.defaultValue !== undefined
      );
      expect(Object.keys(defaults).length).toBe(paramsWithDefaults.length);
    });

    it('should have correct types for default values', () => {
      const defaults = getDefaultParameterValues();
      expect(typeof defaults.threads).toBe('number');
      expect(typeof defaults.temperature).toBe('number');
      expect(typeof defaults.host).toBe('string');
      expect(typeof defaults['cont-batching']).toBe('boolean');
    });
  });
});