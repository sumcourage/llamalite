import { useCallback, useMemo } from 'react';
import type { ParameterMeta, ParameterValues } from '../types';
import { PARAMETER_DEFINITIONS } from '../constants/parameters';

interface ValidationError {
  key: string;
  message: string;
}

export function useParameterValidation() {
  const parameterMap = useMemo(() => {
    const map = new Map<string, ParameterMeta>();
    PARAMETER_DEFINITIONS.forEach((p) => map.set(p.key, p));
    return map;
  }, []);

  const validateParameter = useCallback(
    (key: string, value: unknown): ValidationError | null => {
      const meta = parameterMap.get(key);
      if (!meta) return null;

      // Skip validation for empty optional values
      if (value === undefined || value === null || value === '') {
        return null;
      }

      if (meta.type === 'number') {
        const num = Number(value);
        if (isNaN(num)) {
          return { key, message: `${meta.label} 必须是数字` };
        }
        if (meta.validation) {
          if (meta.validation.min !== undefined && num < meta.validation.min) {
            return {
              key,
              message: `${meta.label} 不能小于 ${meta.validation.min}`,
            };
          }
          if (meta.validation.max !== undefined && num > meta.validation.max) {
            return {
              key,
              message: `${meta.label} 不能大于 ${meta.validation.max}`,
            };
          }
          if (meta.validation.step) {
            const step = meta.validation.step;
            const rounded = Math.round(num / step) * step;
            if (Math.abs(num - rounded) > 0.0001) {
              return {
                key,
                message: `${meta.label} 必须是 ${step} 的倍数`,
              };
            }
          }
        }
      }

      if (meta.type === 'string' && meta.validation?.pattern) {
        const regex = new RegExp(meta.validation.pattern);
        if (!regex.test(String(value))) {
          return { key, message: `${meta.label} 格式不正确` };
        }
      }

      if (meta.type === 'select' && meta.options) {
        const validValues = meta.options.map((o) => o.value);
        if (!validValues.includes(String(value))) {
          return {
            key,
            message: `${meta.label} 的值无效，请从选项中选择`,
          };
        }
      }

      return null;
    },
    [parameterMap]
  );

  const validateAll = useCallback(
    (values: ParameterValues): ValidationError[] => {
      const errors: ValidationError[] = [];
      for (const [key, value] of Object.entries(values)) {
        const error = validateParameter(key, value);
        if (error) {
          errors.push(error);
        }
      }
      return errors;
    },
    [validateParameter]
  );

  const getDefaultValues = useCallback((): ParameterValues => {
    const values: ParameterValues = {};
    PARAMETER_DEFINITIONS.forEach((meta) => {
      if (meta.defaultValue !== undefined) {
        values[meta.key] = meta.defaultValue;
      }
    });
    return values;
  }, []);

  const coerceValue = useCallback(
    (meta: ParameterMeta, raw: unknown): ParameterValues[string] => {
      switch (meta.type) {
        case 'number': {
          const num = typeof raw === 'number' ? raw : Number(raw);
          return Number.isFinite(num) ? num : undefined;
        }
        case 'boolean':
          if (typeof raw === 'boolean') return raw;
          if (typeof raw === 'string') return raw === 'true' || raw === '1';
          if (typeof raw === 'number') return raw !== 0;
          return undefined;
        default:
          return String(raw);
      }
    },
    []
  );

  // Merge persisted parameters with defaults so every known key is restored,
  // including parameters that have no defaultValue.
  const mergeStoredValues = useCallback(
    (stored?: Record<string, unknown> | null): ParameterValues => {
      const values: ParameterValues = { ...getDefaultValues() };
      if (!stored) return values;

      for (const [key, raw] of Object.entries(stored)) {
        if (raw === undefined || raw === null || raw === '') continue;
        const meta = parameterMap.get(key);
        values[key] = meta ? coerceValue(meta, raw) : (raw as ParameterValues[string]);
      }
      return values;
    },
    [coerceValue, getDefaultValues, parameterMap]
  );

  const serializeParameters = useCallback(
    (values: ParameterValues): string[] => {
      const args: string[] = [];
      for (const meta of PARAMETER_DEFINITIONS) {
        const value = values[meta.key];
        if (value === undefined || value === null || value === '') {
          continue;
        }

        // Boolean parameters - only pass flag if true
        if (meta.type === 'boolean') {
          if (value === true) {
            args.push(meta.fullFlag);
          }
          continue;
        }

        // Non-boolean parameters
        args.push(meta.fullFlag);
        args.push(String(value));
      }
      return args;
    },
    []
  );

  return {
    validateParameter,
    validateAll,
    getDefaultValues,
    mergeStoredValues,
    serializeParameters,
    parameterMap,
  };
}