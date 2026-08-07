import React from 'react';
import { Badge, Tag, Spin } from 'antd';
import type { ServiceStatus } from '../types';

interface StatusBadgeProps {
  status: ServiceStatus;
  showText?: boolean;
  size?: 'small' | 'default' | 'large';
}

const statusConfig: Record<ServiceStatus, { color: string; text: string; spinning?: boolean }> = {
  running: { color: '#22c55e', text: '运行中' },
  stopped: { color: '#64748b', text: '已停止' },
  starting: { color: '#3b82f6', text: '启动中', spinning: true },
  stopping: { color: '#f59e0b', text: '停止中' },
  error: { color: '#ef4444', text: '错误' },
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, showText = true, size = 'default' }) => {
  const config = statusConfig[status] || statusConfig.stopped;

  if (config.spinning) {
    const fontSize = size === 'small' ? 12 : size === 'large' ? 16 : 14;
    const spinSize = size === 'large' ? 'default' : 'small';
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <Spin size={spinSize} />
        {showText && <span style={{ color: config.color, fontSize }}>{config.text}</span>}
      </span>
    );
  }

  if (size === 'small') {
    return (
      <Tag
        color={config.color}
        style={{
          borderRadius: 4,
          fontSize: 12,
          lineHeight: '20px',
          padding: '0 8px',
        }}
      >
        <Badge
          status="processing"
          color={config.color}
          style={{ marginRight: 4 }}
        />
        {showText && config.text}
      </Tag>
    );
  }

  if (size === 'large') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
        <Badge
          status="processing"
          color={config.color}
          style={{ transform: 'scale(1.3)', marginRight: 2 }}
        />
        {showText && (
          <span style={{ color: config.color, fontWeight: 600, fontSize: 16 }}>
            {config.text}
          </span>
        )}
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <Badge status="processing" color={config.color} />
      {showText && (
        <span style={{ color: config.color, fontWeight: 500, fontSize: 14 }}>
          {config.text}
        </span>
      )}
    </span>
  );
};

export default StatusBadge;