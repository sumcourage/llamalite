import React from 'react';
import { Space, Button, Tooltip } from 'antd';
import {
  PlayCircleOutlined,
  StopOutlined,
  ReloadOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import type { ServiceStatus } from '../../../types';

interface ServiceActionsProps {
  status: ServiceStatus;
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onDelete?: () => void;
  loading?: boolean;
}

const ServiceActions: React.FC<ServiceActionsProps> = ({
  status,
  onStart,
  onStop,
  onRestart,
  onDelete,
  loading = false,
}) => {
  return (
    <Space>
      {status === 'running' ? (
        <>
          <Tooltip title="停止服务">
            <Button
              icon={<StopOutlined />}
              onClick={onStop}
              danger
              size="small"
              loading={loading}
            />
          </Tooltip>
          <Tooltip title="重启服务">
            <Button
              icon={<ReloadOutlined />}
              onClick={onRestart}
              size="small"
              loading={loading}
            />
          </Tooltip>
        </>
      ) : (
        <Tooltip title="启动服务">
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={onStart}
            size="small"
            loading={loading || status === 'starting'}
          />
        </Tooltip>
      )}

      {status !== 'running' && status !== 'starting' && (
        <Tooltip title="删除服务">
          <Button
            icon={<DeleteOutlined />}
            onClick={onDelete}
            size="small"
            danger
          />
        </Tooltip>
      )}
    </Space>
  );
};

export default ServiceActions;