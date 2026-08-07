import React, { useCallback } from 'react';
import { Form } from 'antd';
import { PARAMETER_DEFINITIONS } from '../../../constants/parameters';
import { useParameterValidation } from '../../../hooks/useParameterValidation';
import ParameterCategory from './ParameterCategory';
import type { ParameterValues } from '../../../types';

interface ParameterFormProps {
  values: ParameterValues;
  onChange: (values: ParameterValues) => void;
  onFileSelect?: (key: string) => Promise<void>;
}

const ParameterForm: React.FC<ParameterFormProps> = ({
  values,
  onChange,
  onFileSelect,
}) => {
  const { validateParameter } = useParameterValidation();

  const handleParamChange = useCallback(
    (key: string, value: string | number | boolean | undefined) => {
      const newValues = { ...values, [key]: value };
      onChange(newValues);
    },
    [values, onChange]
  );

  const handleFileSelect = useCallback(
    async (key: string) => {
      if (onFileSelect) {
        await onFileSelect(key);
      } else {
        try {
          const { open } = await import('@tauri-apps/plugin-dialog');
          const selected = await open({
            multiple: false,
            title: '选择文件',
          });
          if (selected && typeof selected === 'string') {
            handleParamChange(key, selected);
          }
        } catch (err) {
          console.error('File dialog error:', err);
        }
      }
    },
    [handleParamChange, onFileSelect]
  );

  // Group parameters by category
  const categories = [
    {
      key: 'general',
      parameters: PARAMETER_DEFINITIONS.filter((p) => p.category === 'general'),
    },
    {
      key: 'sampling',
      parameters: PARAMETER_DEFINITIONS.filter((p) => p.category === 'sampling'),
    },
    {
      key: 'server',
      parameters: PARAMETER_DEFINITIONS.filter((p) => p.category === 'server'),
    },
  ];

  return (
    <Form
      layout="horizontal"
      size="middle"
      style={{ maxWidth: '100%' }}
    >
      {categories.map((cat) => (
        <ParameterCategory
          key={cat.key}
          category={cat.key}
          parameters={cat.parameters}
          values={values}
          onChange={handleParamChange}
          onFileSelect={handleFileSelect}
        />
      ))}
    </Form>
  );
};

export default ParameterForm;