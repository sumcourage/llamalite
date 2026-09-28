import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Card, Typography, Button, Space, Tooltip, message } from 'antd';
import {
  CloseCircleOutlined,
  DeleteOutlined,
  FolderOpenOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  DownOutlined,
  RightOutlined,
} from '@ant-design/icons';
import type { DownloadProgress as DownloadProgressType, DownloadLogEntry } from '../../../types';

const { Text } = Typography;

interface DownloadProgressProps {
  progress: DownloadProgressType;
  onCancel?: (modelId: string) => Promise<void>;
  onDeleteFailed?: (modelId: string) => Promise<void>;
  onDismiss?: (modelId: string) => void;
}

const LOG_LEVEL_COLORS: Record<string, string> = {
  info: '#94a3b8',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  stderr: '#f97316',
};

const DownloadProgressComponent: React.FC<DownloadProgressProps> = ({
  progress,
  onCancel,
  onDeleteFailed,
  onDismiss,
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const isDownloading = progress.status === 'downloading';
  const isCompleted = progress.status === 'completed';
  const isError = progress.status === 'error';
  const logs = progress.logs || [];
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;

  const withLoading = useCallback(
    async (action: string, fn: (id: string) => Promise<void>) => {
      setActionLoading(action);
      try {
        await fn(progress.modelId);
      } catch (err) {
        message.error(String(err));
      } finally {
        setActionLoading(null);
      }
    },
    [progress.modelId],
  );

  // Auto-scroll logs to bottom when new logs arrive (only while expanded)
  useEffect(() => {
    if (logsExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, logsExpanded]);

  const renderActions = () => {
    const isLoading = actionLoading !== null;

    if (isDownloading) {
      return (
        <Tooltip title="取消并清理">
          <Button
            type="text"
            size="small"
            danger
            icon={actionLoading === 'cancel' ? <LoadingOutlined /> : <CloseCircleOutlined />}
            onClick={() => onCancel && withLoading('cancel', onCancel)}
            disabled={isLoading}
          />
        </Tooltip>
      );
    }
    if (isError) {
      return (
        <Tooltip title="删除并清理">
          <Button
            type="text"
            size="small"
            danger
            icon={actionLoading === 'delete' ? <LoadingOutlined /> : <DeleteOutlined />}
            onClick={() => onDeleteFailed && withLoading('delete', onDeleteFailed)}
            disabled={isLoading}
          />
        </Tooltip>
      );
    }
    if (isCompleted) {
      return (
        <Tooltip title="清除记录">
          <Button
            type="text"
            size="small"
            icon={<CheckCircleOutlined />}
            onClick={() => onDismiss && onDismiss(progress.modelId)}
            disabled={isLoading}
            style={{ color: '#22c55e' }}
          />
        </Tooltip>
      );
    }
    return null;
  };

  const getStatusText = () => {
    if (isCompleted) return { text: '下载完成', color: '#22c55e' };
    if (isError) return { text: '下载失败', color: '#ef4444' };
    return { text: '下载中', color: '#7c3aed' };
  };

  const statusInfo = getStatusText();

  return (
    <Card
      size="small"
      style={{
        borderRadius: 12,
        marginBottom: 12,
        border: isError
          ? '1px solid rgba(239, 68, 68, 0.3)'
          : '1px solid rgba(124, 58, 237, 0.2)',
        background: 'rgba(15, 15, 30, 0.6)',
      }}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
            {progress.repoId}
          </Text>
          <span
            style={{
              fontSize: 11,
              padding: '1px 8px',
              borderRadius: 4,
              background: `${statusInfo.color}20`,
              color: statusInfo.color,
              border: `1px solid ${statusInfo.color}40`,
            }}
          >
            {statusInfo.text}
          </span>
        </div>
      }
      extra={
        <Space size={0}>
          {renderActions()}
        </Space>
      }
    >
      {/* Local path */}
      {progress.localPath && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 6,
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.15)',
            marginBottom: 8,
          }}
        >
          <FolderOpenOutlined style={{ color: '#a78bfa', fontSize: 13 }} />
          <Text
            style={{
              color: '#a78bfa',
              fontSize: 12,
              fontFamily: 'monospace',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
            title={progress.localPath}
          >
            {progress.localPath}
          </Text>
        </div>
      )}

      {/* Error message */}
      {isError && progress.errorMessage && (
        <Text style={{ color: '#ef4444', fontSize: 12, display: 'block', marginBottom: 8 }}>
          错误: {progress.errorMessage}
        </Text>
      )}

      {/* Real-time logs — collapsible, collapsed by default */}
      <div
        onClick={() => setLogsExpanded((prev) => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(124, 58, 237, 0.08)',
          border: '1px solid rgba(124, 58, 237, 0.15)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span style={{ color: '#a78bfa', fontSize: 11, display: 'flex' }}>
          {logsExpanded ? <DownOutlined /> : <RightOutlined />}
        </span>
        <Text style={{ color: '#cbd5e1', fontSize: 12, flexShrink: 0 }}>
          日志输出
        </Text>
        <Text style={{ color: '#64748b', fontSize: 11, flexShrink: 0 }}>
          ({logs.length})
        </Text>
        {!logsExpanded &&
          (lastLog ? (
            <Text
              style={{
                color: LOG_LEVEL_COLORS[lastLog.level] || '#94a3b8',
                fontSize: 12,
                fontFamily: 'monospace',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={lastLog.message}
            >
              {lastLog.message}
            </Text>
          ) : (
            <Text style={{ color: '#64748b', fontSize: 12, flex: 1 }}>
              {isDownloading ? '等待下载日志...' : '暂无日志'}
            </Text>
          ))}
        <Text style={{ color: '#a78bfa', fontSize: 12, flexShrink: 0, marginLeft: 'auto' }}>
          {logsExpanded ? '收起' : '展开'}
        </Text>
      </div>

      {logsExpanded && (
        <div
          style={{
            maxHeight: 260,
            minHeight: 80,
            overflowY: 'auto',
            borderRadius: 8,
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(124, 58, 237, 0.12)',
            padding: '8px 12px',
            marginTop: 8,
            fontFamily: 'monospace',
            fontSize: 12,
            lineHeight: 1.8,
          }}
        >
          {logs.length === 0 ? (
            <Text style={{ color: '#64748b', fontSize: 12 }}>
              {isDownloading ? '等待下载日志...' : '暂无日志'}
            </Text>
          ) : (
            logs.map((log: DownloadLogEntry, idx: number) => (
              <div key={idx} style={{ display: 'flex', gap: 8 }}>
                <span style={{ color: '#64748b', flexShrink: 0 }}>{log.timestamp}</span>
                <span
                  style={{
                    color: LOG_LEVEL_COLORS[log.level] || '#94a3b8',
                    flexShrink: 0,
                    minWidth: 48,
                  }}
                >
                  [{log.level.toUpperCase()}]
                </span>
                <span style={{ color: '#cbd5e1', wordBreak: 'break-all' }}>{log.message}</span>
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>
      )}
    </Card>
  );
};

export default DownloadProgressComponent;
