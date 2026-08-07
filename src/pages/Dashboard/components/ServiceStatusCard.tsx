import React from 'react';
import { Card, Button, Space, Typography, Descriptions, Skeleton } from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  PlusCircleOutlined,
  CloudServerOutlined,
  PauseCircleOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import StatusBadge from '../../../components/StatusBadge';
import type { ServiceStatusInfo } from '../../../types';

const { Text } = Typography;

interface ServiceStatusCardProps {
  status: ServiceStatusInfo | null;
  loading?: boolean;
  hasServices?: boolean;
  actionLoading?: 'start' | 'stop' | 'restart' | null;
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onCreateService?: () => void;
  onOpenWebUI?: () => void;
}

const ServiceStatusCard: React.FC<ServiceStatusCardProps> = ({
  status,
  loading = false,
  hasServices = false,
  actionLoading = null,
  onStart,
  onStop,
  onRestart,
  onCreateService,
  onOpenWebUI,
}) => {
  if (loading) {
    return (
      <Card title="服务状态" style={{ borderRadius: 12 }}>
        <Skeleton active paragraph={{ rows: 3 }} />
      </Card>
    );
  }

  if (!status) {
    if (!hasServices) {
      // No service has been created yet → guide user to create one
      return (
        <Card
          title="服务状态"
          style={{ borderRadius: 12 }}
          className="hover-card"
        >
          <div
            style={{
              textAlign: 'center',
              padding: '16px 16px 28px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: 20,
                background:
                  'linear-gradient(135deg, rgba(124, 58, 237, 0.22), rgba(59, 130, 246, 0.22))',
                border: '1px solid rgba(124, 58, 237, 0.45)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 8px 24px rgba(124, 58, 237, 0.18)',
              }}
            >
              <CloudServerOutlined
                style={{
                  fontSize: 32,
                  color: '#c4b5fd',
                }}
              />
            </div>
            <div>
              <Text style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600 }}>
                还没有任何服务
              </Text>
              <div style={{ marginTop: 6 }}>
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                  创建一个服务配置，即可开始运行本地 LLM
                </Text>
              </div>
            </div>
            <Space style={{ marginTop: 2 }}>
              <Button
                type="primary"
                icon={<PlusCircleOutlined />}
                onClick={onCreateService}
                size="middle"
              >
                新建服务
              </Button>
            </Space>
          </div>
        </Card>
      );
    }

    // Has services but none is running → show stopped status with hint
    return (
      <Card
        title="服务状态"
        style={{ borderRadius: 12 }}
        className="hover-card"
      >
        <div
          style={{
            textAlign: 'center',
            padding: '16px 16px 28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              background:
                'linear-gradient(135deg, rgba(100, 116, 139, 0.25), rgba(71, 85, 105, 0.25))',
              border: '1px solid rgba(148, 163, 184, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PauseCircleOutlined
              style={{
                fontSize: 32,
                color: '#cbd5e1',
              }}
            />
          </div>
          <StatusBadge status="stopped" size="large" />
          <div style={{ marginTop: -4 }}>
            <Text style={{ color: '#94a3b8', fontSize: 13 }}>
              前往「服务」页签，选择一个服务启动
            </Text>
          </div>
          <Space style={{ marginTop: 2 }}>
            <Button
              icon={<PlusCircleOutlined />}
              onClick={onCreateService}
              size="middle"
            >
              新建服务
            </Button>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={onStart}
              disabled={!onStart}
              size="middle"
            >
              启动服务
            </Button>
          </Space>
        </div>
      </Card>
    );
  }

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return '--';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}时${m}分`;
  };

  return (
    <Card
      title={
        <Space>
          <span>服务状态</span>
          <StatusBadge status={status.status} />
        </Space>
      }
      style={{ borderRadius: 12 }}
      className="hover-card"
    >
      <Descriptions column={2} size="small" colon={false}>
        <Descriptions.Item label="模型名称" span={2}>
          <Text style={{ color: '#e2e8f0' }}>{status.modelName}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="监听端口">
          <Text style={{ color: '#e2e8f0' }}>{status.port}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="运行时长">
          <Text style={{ color: '#e2e8f0' }}>{formatUptime(status.uptime)}</Text>
        </Descriptions.Item>
        {status.errorMessage && (
          <Descriptions.Item label="错误信息" span={2}>
            <Text style={{ color: '#ef4444', fontSize: 13 }}>
              {status.errorMessage}
            </Text>
          </Descriptions.Item>
        )}
      </Descriptions>

      <Space style={{ marginTop: 16, width: '100%', justifyContent: 'flex-end' }}>
        {status.status === 'running' || status.status === 'error' ? (
          <>
            <Button
              icon={<GlobalOutlined />}
              onClick={onOpenWebUI}
              disabled={!onOpenWebUI || status.status !== 'running'}
            >
              打开Web页面
            </Button>
            <Button
              icon={<StopOutlined />}
              onClick={onStop}
              danger
              loading={actionLoading === 'stop'}
              disabled={actionLoading !== null && actionLoading !== 'stop'}
            >
              停止
            </Button>
            <Button
              icon={<ReloadOutlined />}
              onClick={onRestart}
              loading={actionLoading === 'restart'}
              disabled={actionLoading !== null && actionLoading !== 'restart'}
            >
              重启
            </Button>
          </>
        ) : (
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={onStart}
            loading={status.status === 'starting' || actionLoading === 'start'}
          >
            启动
          </Button>
        )}
      </Space>
    </Card>
  );
};

export default ServiceStatusCard;