import React, { useCallback } from 'react';
import { Form, Input, InputNumber, Switch, Select, Tooltip, Typography } from 'antd';
import { QuestionCircleOutlined } from '@ant-design/icons';
import type { ParameterMeta } from '../../../types';

const { Text } = Typography;

interface ParameterFieldProps {
  meta: ParameterMeta;
  value?: string | number | boolean;
  onChange: (key: string, value: string | number | boolean | undefined) => void;
  onFileSelect?: (key: string) => Promise<void>;
}

const ParameterField: React.FC<ParameterFieldProps> = ({
  meta,
  value,
  onChange,
  onFileSelect,
}) => {
  const handleChange = useCallback(
    (newValue: string | number | boolean | null | undefined) => {
      if (newValue === null || newValue === undefined) {
        onChange(meta.key, undefined);
      } else {
        onChange(meta.key, newValue);
      }
    },
    [meta.key, onChange]
  );

  const renderField = () => {
    switch (meta.type) {
      case 'number':
        return (
          <InputNumber
            style={{ width: '100%' }}
            min={meta.validation?.min}
            max={meta.validation?.max}
            step={meta.validation?.step}
            value={typeof value === 'number' ? value : (meta.defaultValue as number)}
            onChange={(val) => handleChange(val)}
            placeholder={meta.placeholder}
            controls
          />
        );

      case 'boolean':
        return (
          <Switch
            checked={typeof value === 'boolean' ? value : (meta.defaultValue as boolean)}
            onChange={(checked) => handleChange(checked)}
          />
        );

      case 'select':
        return (
          <Select
            style={{ width: '100%' }}
            value={typeof value === 'string' ? value : (meta.defaultValue as string)}
            onChange={(val) => handleChange(val)}
            options={meta.options}
            placeholder={meta.placeholder}
          />
        );

      case 'file':
        return (
          <Input
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={meta.placeholder || '点击选择文件...'}
            readOnly
            addonAfter={
              <span
                onClick={() => onFileSelect?.(meta.key)}
                style={{ cursor: 'pointer', color: '#7c3aed' }}
              >
                选择
              </span>
            }
          />
        );

      case 'string':
      default:
        if (meta.sensitive) {
          return (
            <Input.Password
              value={typeof value === 'string' ? value : ''}
              onChange={(e) => handleChange(e.target.value)}
              placeholder={meta.placeholder}
            />
          );
        }
        return (
          <Input
            value={typeof value === 'string' ? value : ''}
            onChange={(e) => handleChange(e.target.value)}
            placeholder={meta.placeholder}
          />
        );
    }
  };

  return (
    <Form.Item
      label={
        <span style={{ color: '#e2e8f0' }}>
          {meta.label}
          {meta.description && (
            <Tooltip title={meta.description}>
              <QuestionCircleOutlined
                style={{ marginLeft: 6, color: '#64748b', fontSize: 13 }}
              />
            </Tooltip>
          )}
        </span>
      }
      style={{ marginBottom: 16 }}
      labelCol={{ span: 8 }}
      wrapperCol={{ span: 16 }}
    >
      {renderField()}
      <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
        {meta.flag} {meta.fullFlag}
      </Text>
    </Form.Item>
  );
};

export default ParameterField;