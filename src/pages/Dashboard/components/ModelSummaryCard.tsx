import React from 'react';
import { Card, Button, Statistic, Skeleton } from 'antd';
import { DatabaseOutlined, DownloadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

interface ModelSummaryCardProps {
  modelCount: number;
  totalSize: number; // bytes
  loading?: boolean;
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const unitIndex = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, unitIndex);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
};

const ModelSummaryCard: React.FC<ModelSummaryCardProps> = ({
  modelCount,
  totalSize,
  loading = false,
}) => {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card title="模型概览" style={{ borderRadius: 12 }}>
        <Skeleton active paragraph={{ rows: 2 }} />
      </Card>
    );
  }

  return (
    <Card
      title="模型概览"
      style={{ borderRadius: 12 }}
      className="hover-card"
      onClick={() => navigate('/models')}
    >
      <div style={{ display: 'flex', gap: 24, marginBottom: 16 }}>
        <Statistic
          title="本地模型数量"
          value={modelCount}
          prefix={<DatabaseOutlined />}
          valueStyle={{ color: '#a78bfa' }}
        />
        <Statistic
          title="总大小"
          value={formatSize(totalSize)}
          valueStyle={{ color: '#94a3b8', fontSize: 22 }}
        />
      </div>
      <Button
        type="dashed"
        icon={<DownloadOutlined />}
        onClick={(e) => {
          e.stopPropagation();
          navigate('/models');
        }}
        style={{ width: '100%' }}
      >
        下载模型
      </Button>
    </Card>
  );
};

export default ModelSummaryCard;