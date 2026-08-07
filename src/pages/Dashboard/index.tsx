import React, { useEffect, useState, useMemo } from 'react';
import { Typography, Skeleton, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import ServiceStatusCard from './components/ServiceStatusCard';
import ModelSummaryCard from './components/ModelSummaryCard';
import QuickActions from './components/QuickActions';
import { useServiceManager } from '../../hooks/useServiceManager';
import { useModelStore } from '../../stores/modelStore';
import type { ServiceStatusInfo } from '../../types';

const { Title } = Typography;

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { services, currentStatus, serviceStatuses, startService, stopService, restartService } = useServiceManager({
    autoRefresh: true,
    refreshInterval: 3000,
  });

  const { localModels, fetchLocalModels, loading: modelsLoading } = useModelStore();
  const [statusLoading, setStatusLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'start' | 'stop' | 'restart' | null>(null);

  useEffect(() => {
    fetchLocalModels();
  }, [fetchLocalModels]);

  useEffect(() => {
    if (currentStatus !== null) {
      setStatusLoading(false);
    }
    // Also set a timeout to stop loading
    const timer = setTimeout(() => setStatusLoading(false), 3000);
    return () => clearTimeout(timer);
  }, [currentStatus]);

  const totalSize = localModels.reduce((sum, m) => sum + m.size, 0);

  // Find the running service ID from all available status sources
  const runningServiceId = useMemo((): string | null => {
    // 1. Check currentStatus for a running/starting service
    if (currentStatus?.id && (currentStatus.status === 'running' || currentStatus.status === 'starting')) {
      return currentStatus.id;
    }
    // 2. Check serviceStatuses map for any running service
    for (const [id, status] of Object.entries(serviceStatuses)) {
      if (status.status === 'running' || status.status === 'starting') {
        return id;
      }
    }
    // 3. If currentStatus has an id but is stopped/error, still return it for start/restart
    if (currentStatus?.id && services.some(s => s.id === currentStatus.id)) {
      return currentStatus.id;
    }
    // 4. Fallback to first service
    return services.length > 0 ? services[0].id : null;
  }, [currentStatus, serviceStatuses, services]);

  // Get the actual status to display, preferring serviceStatuses over currentStatus
  const displayStatus = useMemo((): ServiceStatusInfo | null => {
    // 1. Check serviceStatuses for the running service
    if (runningServiceId && serviceStatuses[runningServiceId]) {
      return serviceStatuses[runningServiceId];
    }
    // 2. Fall back to currentStatus if it has meaningful data
    if (currentStatus && currentStatus.id) {
      return currentStatus;
    }
    // 3. No status available
    return null;
  }, [runningServiceId, serviceStatuses, currentStatus]);

  const getServiceUrl = (): string => {
    if (!runningServiceId) return 'http://127.0.0.1:8080';
    const service = services.find((s) => s.id === runningServiceId);
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

  const handleStart = async () => {
    if (!runningServiceId || actionLoading) return;
    setActionLoading('start');
    try {
      await startService(runningServiceId);
      message.success('服务启动中...');
    } catch (err) {
      message.error(`启动失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleStop = async () => {
    if (!runningServiceId || actionLoading) return;
    setActionLoading('stop');
    try {
      await stopService(runningServiceId);
      message.success('服务已停止');
    } catch (err) {
      message.error(`停止失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    if (!runningServiceId || actionLoading) return;
    setActionLoading('restart');
    try {
      await restartService(runningServiceId);
      message.success('服务重启中...');
    } catch (err) {
      message.error(`重启失败: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div>
      <Title level={4} style={{ color: '#e2e8f0', marginBottom: 24 }}>
        仪表盘
      </Title>

      <div className="dashboard-grid">
        <ServiceStatusCard
          status={displayStatus}
          loading={statusLoading}
          hasServices={services.length > 0}
          actionLoading={actionLoading}
          onStart={handleStart}
          onStop={handleStop}
          onRestart={handleRestart}
          onCreateService={() => navigate('/services/new')}
          onOpenWebUI={handleOpenWebUI}
        />

        <ModelSummaryCard
          modelCount={localModels.length}
          totalSize={totalSize}
          loading={modelsLoading}
        />

        <QuickActions />
      </div>
    </div>
  );
};

export default Dashboard;