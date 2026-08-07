import React from 'react';
import { Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  content: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  open,
  title,
  content,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}) => {
  return (
    <Modal
      open={open}
      title={
        <span>
          <ExclamationCircleOutlined
            style={{
              color: danger ? '#ef4444' : '#f59e0b',
              marginRight: 8,
            }}
          />
          {title}
        </span>
      }
      okText={confirmText}
      cancelText={cancelText}
      okButtonProps={{
        danger,
        loading,
        style: danger ? {} : { backgroundColor: '#7c3aed', borderColor: '#7c3aed' },
      }}
      cancelButtonProps={{
        style: { borderColor: '#2d2d4a' },
      }}
      onOk={onConfirm}
      onCancel={onCancel}
      centered
      destroyOnClose
      maskClosable={!loading}
      closable={!loading}
    >
      <div style={{ padding: '12px 0', color: '#94a3b8', fontSize: 14 }}>{content}</div>
    </Modal>
  );
};

export default ConfirmDialog;