import React from 'react';
import { Card, Button, Space } from 'antd';
import {
  PlusCircleOutlined,
  DownloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const QuickActions: React.FC = () => {
  const navigate = useNavigate();

  const actions = [
    {
      key: 'new-service',
      icon: (
        <span
          style={{
            display: 'inline-flex',
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'rgba(124, 58, 237, 0.2)',
            color: '#c4b5fd',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
        >
          <PlusCircleOutlined />
        </span>
      ),
      label: '新建服务',
      onClick: () => navigate('/services/new'),
    },
    {
      key: 'download-model',
      icon: (
        <span
          style={{
            display: 'inline-flex',
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'rgba(59, 130, 246, 0.2)',
            color: '#93c5fd',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
        >
          <DownloadOutlined />
        </span>
      ),
      label: '下载模型',
      onClick: () => navigate('/models'),
    },
    {
      key: 'settings',
      icon: (
        <span
          style={{
            display: 'inline-flex',
            width: 22,
            height: 22,
            borderRadius: 6,
            background: 'rgba(16, 185, 129, 0.18)',
            color: '#6ee7b7',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
          }}
        >
          <SettingOutlined />
        </span>
      ),
      label: '打开设置',
      onClick: () => navigate('/settings'),
    },
  ];

  return (
    <Card title="快捷操作" style={{ borderRadius: 12 }}>
      <Space wrap size={12}>
        {actions.map((action) => (
          <Button
            key={action.key}
            type="default"
            icon={action.icon}
            onClick={action.onClick}
            size="large"
            style={{
              height: 48,
              padding: '0 24px',
              borderRadius: 8,
              borderColor: '#2d2d4a',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {action.label}
          </Button>
        ))}
      </Space>
    </Card>
  );
};

export default QuickActions;