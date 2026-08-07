import React from 'react';
import { Typography, Tag, Button, Space, Card, Empty } from 'antd';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  DownloadOutlined,
  ReloadOutlined,
  ExclamationCircleFilled,
  CopyOutlined,
} from '@ant-design/icons';
import type { EnvironmentStatus, ComponentStatus } from '../types/environment';

const { Text, Link } = Typography;

interface EnvironmentCheckProps {
  status: EnvironmentStatus | null;
  loading: boolean;
  onCheck: () => void;
}

/** Detect if a guide line is a command (starts with spaces + known command prefix). */
const isCommandLine = (line: string): boolean => {
  const trimmed = line.trim();
  return (
    trimmed.startsWith('pip ') ||
    trimmed.startsWith('python ') ||
    trimmed.startsWith('conda ') ||
    trimmed.startsWith('npm ') ||
    trimmed.startsWith('curl ') ||
    trimmed.startsWith('wget ') ||
    trimmed.startsWith('export ') ||
    trimmed.startsWith('$ ') ||
    trimmed.startsWith('> ')
  );
};

const InstallGuide: React.FC<{ guide: string[] }> = ({ guide }) => {
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {
      // Fallback for non-HTTPS contexts
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    });
  };

  return (
    <div
      style={{
        marginTop: 10,
        padding: '10px 14px',
        borderRadius: 8,
        background: 'rgba(124, 58, 237, 0.08)',
        border: '1px solid rgba(124, 58, 237, 0.2)',
        fontSize: 13,
      }}
    >
      <div style={{ marginBottom: 6 }}>
        <Text style={{ color: '#a78bfa', fontWeight: 600, fontSize: 12 }}>
          安装指引
        </Text>
      </div>
      {guide.map((line, idx) => {
        const isCmd = isCommandLine(line);
        return (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
              lineHeight: 1.6,
            }}
          >
            {isCmd ? (
              <>
                <code
                  style={{
                    flex: 1,
                    background: 'rgba(0, 0, 0, 0.3)',
                    color: '#e2e8f0',
                    padding: '2px 8px',
                    borderRadius: 4,
                    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
                    fontSize: 12.5,
                    wordBreak: 'break-all',
                  }}
                >
                  {line.trim()}
                </code>
                <Button
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopy(line.trim())}
                  style={{ color: '#a78bfa', height: 22, minWidth: 22, padding: 0 }}
                  title="复制命令"
                />
              </>
            ) : (
              <Text style={{ color: '#94a3b8', fontSize: 13 }}>{line}</Text>
            )}
          </div>
        );
      })}
    </div>
  );
};

const ComponentItem: React.FC<{ component: ComponentStatus | undefined }> = ({ component }) => {
  if (!component) return null;
  const icon = component.installed ? (
    <CheckCircleFilled style={{ color: '#52c41a' }} />
  ) : (
    <CloseCircleFilled style={{ color: '#ff4d4f' }} />
  );

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        padding: '12px 0',
        borderBottom: '1px solid #1f2937',
      }}
    >
      <div style={{ marginRight: 12, fontSize: 18, marginTop: 2 }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Text strong style={{ color: '#e2e8f0' }}>
            {component.name}
          </Text>
          <Tag color={component.installed ? 'success' : 'error'}>
            {component.installed ? '已就绪' : '未安装'}
          </Tag>
          {component.version && (
            <Tag color="blue" style={{ marginLeft: 0 }}>
              {component.version}
            </Tag>
          )}
        </div>
        <Text style={{ color: '#94a3b8', fontSize: 13 }}>{component.message}</Text>

        {/* Install guide — shown when not installed */}
        {!component.installed && component.installGuide && (
          <InstallGuide guide={component.installGuide} />
        )}

        {/* Download link — shown when not installed and URL is available */}
        {!component.installed && component.installUrl && (
          <div style={{ marginTop: 8 }}>
            <Link
              href={component.installUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 13 }}
            >
              <Space size={4}>
                <DownloadOutlined />
                下载页面
              </Space>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

const EnvironmentCheck: React.FC<EnvironmentCheckProps> = ({
  status,
  loading,
  onCheck,
}) => {
  return (
    <Card
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ExclamationCircleFilled style={{ color: '#7c3aed' }} />
          <span style={{ color: '#e2e8f0' }}>环境检测</span>
        </div>
      }
      extra={
        <Button
          icon={loading ? <LoadingOutlined /> : <ReloadOutlined />}
          onClick={onCheck}
          loading={loading}
          size="small"
        >
          重新检测
        </Button>
      }
      style={{ borderRadius: 12 }}
    >
      {!status ? (
        <Empty
          description={
            <Text style={{ color: '#94a3b8' }}>点击"重新检测"开始环境检查</Text>
          }
        />
      ) : (
        <>
          <div
            style={{
              padding: '8px 12px',
              borderRadius: 8,
              marginBottom: 16,
              background: status.allReady
                ? 'rgba(82, 196, 26, 0.1)'
                : 'rgba(255, 77, 79, 0.1)',
              border: `1px solid ${status.allReady ? '#52c41a' : '#ff4d4f'}`,
            }}
          >
            <Space>
              {status.allReady ? (
                <CheckCircleFilled style={{ color: '#52c41a', fontSize: 20 }} />
              ) : (
                <ExclamationCircleFilled style={{ color: '#ff4d4f', fontSize: 20 }} />
              )}
              <Text strong style={{ color: status.allReady ? '#52c41a' : '#ff4d4f' }}>
                {status.allReady
                  ? '所有环境组件已就绪，可以正常使用'
                  : '部分环境组件缺失，请按下方指引完成安装'}
              </Text>
            </Space>
          </div>

          {status.llamaServer && <ComponentItem component={status.llamaServer} />}
          {status.modelscope && <ComponentItem component={status.modelscope} />}
          {status.python && <ComponentItem component={status.python} />}
        </>
      )}
    </Card>
  );
};

export default EnvironmentCheck;
