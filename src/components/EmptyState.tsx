import React from 'react';
import { Button } from 'antd';
import {
  InboxOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';

export type EmptyStateVariant =
  | 'default'
  | 'services'
  | 'models'
  | 'download';

interface EmptyStateProps {
  icon?: React.ReactNode;
  variant?: EmptyStateVariant;
  title: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

const variantIconMap: Record<EmptyStateVariant, React.ReactNode> = {
  default: <InboxOutlined />,
  services: <CloudServerOutlined />,
  models: <DatabaseOutlined />,
  download: <AppstoreOutlined />,
};

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  variant = 'default',
  title,
  description,
  actionText,
  onAction,
}) => {
  const iconNode = icon ?? variantIconMap[variant];
  return (
    <div className="empty-state-container">
      <div className="empty-state-icon">{iconNode}</div>
      <div className="empty-state-title">{title}</div>
      {description && (
        <div className="empty-state-description">{description}</div>
      )}
      {actionText && onAction && (
        <Button type="primary" onClick={onAction} style={{ marginTop: 20 }}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;