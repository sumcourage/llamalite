import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Button, Card, Space, Spin, message } from 'antd';
import { PlusCircleOutlined, RightOutlined, GlobalOutlined, EditOutlined } from '@ant-design/icons';
import StatusBadge from '../../components/StatusBadge';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useServiceManager } from '../../hooks/useServiceManager';
import type { ServiceConfig, ServiceStatus } from '../../types';

const { Title, Text } = Typography;

const ServiceList: React.FC = () => {
  const navigate = useNavigate();
  const {
    services,
    serviceStatuses,
    loading,
    error,
    fetchServices,
    fetchAllStatuses,
    startService,
    stopService,
    deleteService,
  } = useServiceManager();

  const [deleteTarget, setDeleteTarget] = useState<ServiceConfig | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchServices();
    fetchAllStatuses();
    
    // Periodically refresh all statuses
    const interval = setInterval(() => {
      fetchAllStatuses();
    }, 3000);
    
    return () => clearInterval(interval);
  }, [fetchServices, fetchAllStatuses]);

  useEffect(() => {
    if (error) {
      message.error(error);
    }
  }, [error]);

  const getServiceStatus = (serviceId: string): ServiceStatus => {
    const statusInfo = serviceStatuses[serviceId];
    return statusInfo?.status || 'stopped';
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteService(deleteTarget.id);
      message.success('服务已删除');
      setDeleteTarget(null);
    } catch (err) {
      message.error(String(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      await startService(id);
      message.success('服务启动中...');
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleStop = async (id: string) => {
    try {
      await stopService(id);
      message.success('服务已停止');
    } catch (err) {
      message.error(String(err));
    }
  };

  const getServiceUrl = (service: ServiceConfig): string => {
    const host = service.parameters?.host || '127.0.0.1';
    const port = service.parameters?.port || 8080;
    return `http://${host}:${port}`;
  };

  const handleOpenWebUI = async (service: ServiceConfig) => {
    const url = getServiceUrl(service);
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch (err) {
      // Fallback to window.open if Tauri shell is not available
      window.open(url, '_blank');
    }
  };

  if (loading && services.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <div className="section-header">
        <Title level={4} style={{ color: '#e2e8f0', margin: 0 }}>
          服务管理
        </Title>
        <Button
          type="primary"
          icon={<PlusCircleOutlined />}
          onClick={() => navigate('/services/new')}
        >
          新建服务
        </Button>
      </div>

      {services.length === 0 ? (
        <EmptyState
          variant="services"
          title="暂无服务配置"
          description="创建一个新的服务配置来启动 llama.cpp 服务器"
          actionText="新建服务"
          onAction={() => navigate('/services/new')}
        />
      ) : (
        <div className="service-grid">
          {services.map((service) => {
            const status = getServiceStatus(service.id);
            return (
              <Card
                key={service.id}
                className="hover-card"
                style={{ borderRadius: 12 }}
                size="small"
              >
                <Card.Meta
                  title={
                    <Space>
                      <Text style={{ color: '#e2e8f0', fontWeight: 500 }}>
                        {service.name}
                      </Text>
                      <StatusBadge status={status} size="small" />
                    </Space>
                  }
                  description={
                    <div style={{ marginTop: 8 }}>
                      <Text
                        style={{
                          color: '#64748b',
                          fontSize: 13,
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        模型: {service.modelPath.split(/[/\\]/).pop() || service.modelPath}
                      </Text>
                      <Text
                        style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 4 }}
                      >
                        创建于 {new Date(service.createdAt).toLocaleString('zh-CN')}
                      </Text>
                    </div>
                  }
                />
                <div className="service-card-actions">
                  <Space size={4} wrap>
                    <Button
                      size="small"
                      type="text"
                      icon={<GlobalOutlined />}
                      disabled={status !== 'running'}
                      onClick={() => handleOpenWebUI(service)}
                    >
                      打开Web页面
                    </Button>
                    <Button
                      size="small"
                      type="text"
                      icon={<RightOutlined />}
                      onClick={() => navigate(`/services/${service.id}`)}
                    >
                      详情
                    </Button>
                    <Button
                      size="small"
                      type="text"
                      icon={<EditOutlined />}
                      disabled={status === 'running' || status === 'starting'}
                      onClick={() => navigate(`/services/${service.id}/edit`)}
                    >
                      编辑
                    </Button>
                    {status === 'running' ? (
                      <Button size="small" type="text" danger onClick={() => handleStop(service.id)}>
                        停止
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        type="text"
                        onClick={() => handleStart(service.id)}
                        loading={status === 'starting'}
                      >
                        启动
                      </Button>
                    )}
                    <Button
                      size="small"
                      type="text"
                      danger
                      disabled={status === 'running' || status === 'starting'}
                      onClick={() => setDeleteTarget(service)}
                    >
                      删除
                    </Button>
                  </Space>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除服务"
        content={
          <span>
            确定要删除服务 <strong>{deleteTarget?.name}</strong> 吗？此操作不可撤销。
          </span>
        }
        confirmText="删除"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};

export default ServiceList;