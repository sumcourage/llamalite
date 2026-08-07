import React, { useState } from 'react';
import { Collapse, Switch, Typography } from 'antd';
import { SettingOutlined, SlidersOutlined, CloudOutlined } from '@ant-design/icons';
import ParameterField from './ParameterField';
import type { ParameterMeta, ParameterValues } from '../../../types';

const { Text } = Typography;

const categoryIcons: Record<string, React.ReactNode> = {
  general: <SettingOutlined />,
  sampling: <SlidersOutlined />,
  server: <CloudOutlined />,
};

const categoryLabels: Record<string, string> = {
  general: '通用参数',
  sampling: '采样参数',
  server: '服务器参数',
};

interface ParameterCategoryProps {
  category: string;
  parameters: ParameterMeta[];
  values: ParameterValues;
  onChange: (key: string, value: string | number | boolean | undefined) => void;
  onFileSelect?: (key: string) => Promise<void>;
}

const ParameterCategory: React.FC<ParameterCategoryProps> = ({
  category,
  parameters,
  values,
  onChange,
  onFileSelect,
}) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const basicParams = parameters.filter((p) => !p.advanced);
  const advancedParams = parameters.filter((p) => p.advanced);

  const visibleParams = showAdvanced
    ? [...basicParams, ...advancedParams]
    : basicParams;

  return (
    <Collapse
      defaultActiveKey={['basic']}
      items={[
        {
          key: 'basic',
          label: (
            <span style={{ color: '#e2e8f0', fontWeight: 500 }}>
              {categoryIcons[category]} {categoryLabels[category] || category}
              <Text style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>
                ({visibleParams.length} 个参数)
              </Text>
            </span>
          ),
          extra: advancedParams.length > 0 ? (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setShowAdvanced(!showAdvanced);
              }}
              style={{ color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
            >
              <Switch
                size="small"
                checked={showAdvanced}
                checkedChildren="高级"
                unCheckedChildren="高级"
                style={{ marginRight: 8 }}
              />
              {showAdvanced ? '隐藏高级' : '显示高级'}
            </span>
          ) : null,
          children: (
            <div style={{ padding: '8px 0' }}>
              {basicParams.map((meta) => (
                <ParameterField
                  key={meta.key}
                  meta={meta}
                  value={values[meta.key]}
                  onChange={onChange}
                  onFileSelect={onFileSelect}
                />
              ))}

              {showAdvanced && advancedParams.length > 0 && (
                <>
                  <div
                    style={{
                      borderTop: '1px solid #252540',
                      margin: '16px 0',
                      paddingTop: 16,
                    }}
                  >
                    <Text style={{ color: '#64748b', fontSize: 13, marginBottom: 12, display: 'block' }}>
                      高级参数
                    </Text>
                    {advancedParams.map((meta) => (
                      <ParameterField
                        key={meta.key}
                        meta={meta}
                        value={values[meta.key]}
                        onChange={onChange}
                        onFileSelect={onFileSelect}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          ),
        },
      ]}
      style={{ marginBottom: 12 }}
      bordered={false}
      ghost
    />
  );
};

export default ParameterCategory;