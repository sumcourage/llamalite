import React, { useEffect, useState } from 'react';
import { Tabs, Typography, message, Spin } from 'antd';
import {
  DashboardOutlined,
  DownloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useModelDownload } from '../../hooks/useModelDownload';
import HardwareRecommendation from './components/HardwareRecommendation';
import HFModelBrowser from './components/HFModelBrowser';
import ModelCard from './components/ModelCard';
import DownloadProgressComponent from './components/DownloadProgress';
import EmptyState from '../../components/EmptyState';
import ConfirmDialog from '../../components/ConfirmDialog';
import type { LocalModel } from '../../types';

const { Title } = Typography;

const ModelList: React.FC = () => {
  const {
    localModels,
    downloadProgress,
    loading,
    error,
    fetchLocalModels,
    deleteModel,
    cancelDownload,
    deleteFailedDownload,
    dismissDownload,
  } = useModelDownload();

  const [deleteTarget, setDeleteTarget] = useState<LocalModel | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchLocalModels();
  }, [fetchLocalModels]);

  useEffect(() => {
    if (error) {
      message.error(error);
    }
  }, [error]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await deleteModel(deleteTarget.id);
      message.success('模型已删除');
      setDeleteTarget(null);
    } catch (err) {
      message.error(String(err));
    } finally {
      setDeleteLoading(false);
    }
  };

  // Show all active downloads: downloading, error, completed
  const activeDownloads = Object.values(downloadProgress).filter(
    (p) =>
      p.status === 'downloading' ||
      p.status === 'completed' ||
      p.status === 'error',
  );

  const tabItems = [
    {
      key: 'hardware',
      label: (
        <span>
          <DashboardOutlined style={{ marginRight: 6 }} />
          本机信息
        </span>
      ),
      children: (
        <div>
          <HardwareRecommendation />
        </div>
      ),
    },
    {
      key: 'downloads',
      label: (
        <span>
          <DownloadOutlined style={{ marginRight: 6 }} />
          下载管理
          {activeDownloads.length > 0 && (
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                padding: '1px 6px',
                borderRadius: 10,
                background: 'rgba(124, 58, 237, 0.25)',
                color: '#c4b5fd',
              }}
            >
              {activeDownloads.length}
            </span>
          )}
        </span>
      ),
      children: (
        <div>
          {/* Active Downloads */}
          {activeDownloads.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <Title level={5} style={{ color: '#e2e8f0', marginBottom: 12 }}>
                下载进度
              </Title>
              {activeDownloads.map((progress) => (
                <DownloadProgressComponent
                  key={progress.modelId}
                  progress={progress}
                  onCancel={cancelDownload}
                  onDeleteFailed={deleteFailedDownload}
                  onDismiss={dismissDownload}
                />
              ))}
            </div>
          )}

          {/* Local Models */}
          <div>
            <Title level={5} style={{ color: '#e2e8f0', marginBottom: 12 }}>
              本地模型 ({localModels.length})
            </Title>

            {loading && localModels.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin />
              </div>
            ) : localModels.length === 0 ? (
              <EmptyState
                variant="models"
                title="暂无本地模型"
                description="从 ModelScope 下载模型，或手动将 GGUF 模型文件放入模型目录"
              />
            ) : (
              <div className="model-grid">
                {localModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    model={model}
                    onDelete={(id) => {
                      const m = localModels.find((lm) => lm.id === id);
                      if (m) setDeleteTarget(m);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'search',
      label: (
        <span>
          <SearchOutlined style={{ marginRight: 6 }} />
          模型搜索
        </span>
      ),
      children: <HFModelBrowser />,
    },
  ];

  return (
    <div>
      <Title level={4} style={{ color: '#e2e8f0', marginBottom: 20 }}>
        模型管理
      </Title>

      <Tabs
        defaultActiveKey="hardware"
        items={tabItems}
        style={{
          color: '#e2e8f0',
        }}
        className="model-tabs"
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        title="删除模型"
        content={
          <span>
            确定要删除模型 <strong>{deleteTarget?.filename}</strong> 吗？此操作不可撤销。
            {deleteTarget && (
              <div style={{ marginTop: 8, color: '#f59e0b', fontSize: 13 }}>
                提示: 如果有服务正在使用此模型，请先停止服务。
              </div>
            )}
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

export default ModelList;
