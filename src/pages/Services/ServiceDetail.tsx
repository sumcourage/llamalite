import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Typography,
  Button,
  Card,
  Space,
  Descriptions,
  message,
  Spin,
  Tag,
} from 'antd';
import {
  ArrowLeftOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  DeleteOutlined,
  FileTextOutlined,
  GlobalOutlined,
  EditOutlined,
} from '@ant-design/icons';
import StatusBadge from '../../components/StatusBadge';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useServiceManager } from '../../hooks/useServiceManager';

const { Title, Text } = Typography;

const ServiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const logContainerRef = useRef<HTMLDivElement>(null);

  const {
    services,
    currentStatus,
    logs,
    loading,
    error,
    fetchServices,
    startService,
    stopService,
    restartService,
    deleteService,
    fetchStatus,
    fetchLogs,
    clearLogs,
  } = useServiceManager({ serviceId: id, autoRefresh: true, refreshInterval: 2000 });

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);

  const service = services.find((s) => s.id === id);

  useEffect(() => {
    if (id) {
      fetchServices();
      fetchStatus(id);
      fetchLogs(id);
    }
  }, [id, fetchServices, fetchStatus, fetchLogs]);

  useEffect(() => {
    if (error) {
      message.error(error);
    }
  }, [error]);

  // Auto-scroll log container
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleStart = async () => {
    if (!id) return;
    try {
      await startService(id);
      message.success('服务启动中...');
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleStop = async () => {
    if (!id) return;
    try {
      await stopService(id);
      message.success('服务已停止');
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleRestart = async () => {
    if (!id) return;
    try {
      await restartService(id);
      message.success('服务重启中...');
    } catch (err) {
      message.error(String(err));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleteLoading(true);
    try {
      await deleteService(id);
      message.success('服务已删除');
      navigate('/services');
    } catch (err) {
      message.error(String(err));
    } finally {
      setDeleteLoading(false);
      setDeleteDialogOpen(false);
    }
  };

  const getServiceUrl = (): string => {
    if (!service) return 'http://127.0.0.1:8080';
    const host = service.parameters?.host || '127.0.0.1';
    const port = service.parameters?.port || 8080;
    return `http://${host}:${port}`;
  };

  const handleOpenWebUI = async () => {
    const url = getServiceUrl();
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(url);
    } catch (err) {
      // Fallback to window.open if Tauri shell is not available
      window.open(url, '_blank');
    }
  };

  const formatUptime = (seconds?: number): string => {
    if (!seconds) return '--';
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分${seconds % 60}秒`;
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}时${m}分`;
  };

  if (loading && !service) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!service) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Text type="secondary">服务未找到</Text>
        <br />
        <Button type="link" onClick={() => navigate('/services')}>
          返回服务列表
        </Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      <div className="section-header">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/services')}
            style={{ color: '#94a3b8' }}
          />
          <Title level={4} style={{ color: '#e2e8f0', margin: 0 }}>
            {service.name}
          </Title>
          {currentStatus && <StatusBadge status={currentStatus.status} />}
        </Space>
        <Space>
          {currentStatus?.status === 'running' ? (
            <>
              <Button icon={<GlobalOutlined />} onClick={handleOpenWebUI}>
                打开Web页面
              </Button>
              <Button icon={<StopOutlined />} onClick={handleStop} danger>
                停止
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleRestart}>
                重启
              </Button>
            </>
          ) : (
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleStart}
              loading={currentStatus?.status === 'starting'}
            >
              启动
            </Button>
          )}
          <Button
            icon={<EditOutlined />}
            onClick={() => navigate(`/services/${id}/edit`)}
            disabled={currentStatus?.status === 'running' || currentStatus?.status === 'starting'}
          >
            编辑
          </Button>
          <Button
            icon={<DeleteOutlined />}
            danger
            onClick={() => setDeleteDialogOpen(true)}
            disabled={currentStatus?.status === 'running' || currentStatus?.status === 'starting'}
          >
            删除
          </Button>
        </Space>
      </div>

      <Card style={{ borderRadius: 12, marginBottom: 16 }}>
        <Descriptions column={2} colon={false} size="small">
          <Descriptions.Item label="服务名称" span={2}>
            <Text style={{ color: '#e2e8f0' }}>{service.name}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="模型路径" span={2}>
            <Text style={{ color: '#e2e8f0', fontSize: 13 }}>{service.modelPath}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="创建时间">
            <Text style={{ color: '#e2e8f0' }}>
              {new Date(service.createdAt).toLocaleString('zh-CN')}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            <Text style={{ color: '#e2e8f0' }}>
              {new Date(service.updatedAt).toLocaleString('zh-CN')}
            </Text>
          </Descriptions.Item>
          {currentStatus ? (
            <>
              <Descriptions.Item label="监听端口">
                <Text style={{ color: '#e2e8f0' }}>{currentStatus.port}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="运行时长">
                <Text style={{ color: '#e2e8f0' }}>
                  {formatUptime(currentStatus.uptime)}
                </Text>
              </Descriptions.Item>
            </>
          ) : (
            <>
              <Descriptions.Item label="监听端口">
                <Text type="secondary" style={{ fontStyle: 'italic' }}>
                  未运行
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="运行时长">
                <Text type="secondary" style={{ fontStyle: 'italic' }}>
                  --
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="当前状态" span={2}>
                <Text type="secondary">
                  服务尚未启动，点击右上角「启动」按钮开始运行
                </Text>
              </Descriptions.Item>
            </>
          )}
        </Descriptions>
      </Card>

      <Card
        title={
          <Space>
            <span style={{ color: '#e2e8f0' }}>实时日志</span>
            <Tag
              style={{ cursor: 'pointer', borderRadius: 4 }}
              color={autoScroll ? 'purple' : 'default'}
              onClick={() => setAutoScroll(!autoScroll)}
            >
              {autoScroll ? '自动滚动' : '手动滚动'}
            </Tag>
          </Space>
        }
        extra={
          <Button size="small" onClick={clearLogs}>
            清空日志
          </Button>
        }
        style={{ borderRadius: 12 }}
      >
        <div className="log-terminal" ref={logContainerRef}>
          {logs.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background:
                    'linear-gradient(135deg, rgba(51, 65, 85, 0.6), rgba(30, 41, 59, 0.6))',
                  border: '1px solid rgba(148, 163, 184, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileTextOutlined
                  style={{ fontSize: 28, color: '#94a3b8' }}
                />
              </div>
              <Text style={{ color: '#cbd5e1', fontSize: 14, fontWeight: 500 }}>
                暂无日志输出
              </Text>
              <Text style={{ color: '#64748b', fontSize: 13 }}>
                启动服务后，这里会显示实时运行日志
              </Text>
            </div>
          ) : (
            logs.map((log, index) => {
              const level = (log.level ?? 'info').toUpperCase();
              return (
                <div key={index} className={`log-entry log-level-${log.level ?? 'info'}`}>
                  <span style={{ color: '#64748b', marginRight: 8 }}>
                    {log.timestamp
                      ? new Date(log.timestamp).toLocaleTimeString('zh-CN')
                      : ''}
                  </span>
                  <span>[{level}]</span>
                  <span style={{ marginLeft: 8 }}>{log.message ?? ''}</span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={deleteDialogOpen}
        title="删除服务"
        content={
          <span>
            确定要删除服务 <strong>{service.name}</strong> 吗？此操作不可撤销。
          </span>
        }
        confirmText="删除"
        danger
        loading={deleteLoading}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
      />
    </div>
  );
};

export default ServiceDetail;