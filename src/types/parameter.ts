export type ParameterCategory = 'general' | 'sampling' | 'server';
export type ParameterType = 'number' | 'string' | 'boolean' | 'select' | 'file';

export interface ParameterMeta {
  key: string;
  flag: string;
  fullFlag: string;
  category: ParameterCategory;
  label: string;
  description: string;
  type: ParameterType;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  validation?: { min?: number; max?: number; step?: number; pattern?: string };
  advanced?: boolean;
  sensitive?: boolean;
  dependsOn?: string;
}

export interface ParameterValues {
  [key: string]: string | number | boolean | undefined;
}