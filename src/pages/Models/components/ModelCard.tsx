import React from 'react';
import { Card, Typography, Space, Tag, Button, Tooltip } from 'antd';
import { DeleteOutlined, FolderOutlined } from '@ant-design/icons';
import type { LocalModel } from '../../../types';

const { Text } = Typography;

interface ModelCardProps {
  model: LocalModel;
  onDelete?: (id: string) => void;
  onSelect?: (model: LocalModel) => void;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, unitIndex);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const ModelCard: React.FC<ModelCardProps> = ({ model, onDelete, onSelect }) => {
  return (
    <Card
      className="hover-card"
      style={{ borderRadius: 12 }}
      size="small"
      onClick={() => onSelect?.(model)}
      actions={[
        <Tooltip title="删除模型" key="delete">
          <Button
            type="text"
            danger
            icon={<DeleteOutlined />}
            onClick={(e) => {
              e.stopPropagation();
              onDelete?.(model.id);
            }}
          />
        </Tooltip>,
      ]}
    >
      <Card.Meta
        title={
          <Text style={{ color: '#e2e8f0', fontWeight: 500, fontSize: 14 }}>
            {model.filename}
          </Text>
        }
        description={
          <div style={{ marginTop: 8 }}>
            <Space wrap size={4}>
              <Tag
                color="purple"
                style={{ borderRadius: 4, fontSize: 12, margin: 0 }}
              >
                {model.quantization}
              </Tag>
              <Tag
                color="default"
                style={{ borderRadius: 4, fontSize: 12, margin: 0 }}
              >
                {formatSize(model.size)}
              </Tag>
            </Space>

            <div style={{ marginTop: 8 }}>
              <Text
                style={{ color: '#64748b', fontSize: 12, display: 'block' }}
              >
                <FolderOutlined style={{ marginRight: 4 }} />
                {model.repoId}
              </Text>
              <Text
                style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 4 }}
              >
                下载于 {new Date(model.downloadDate).toLocaleDateString('zh-CN')}
              </Text>
            </div>
          </div>
        }
      />
    </Card>
  );
};

export default ModelCard;