import React from 'react';
import { Button, Typography, Space } from 'antd';
import { WarningOutlined, ReloadOutlined, BugOutlined } from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string;
}

/**
 * Global error boundary that prevents the entire app from showing a blank
 * white screen when a render-phase error bubbles to the top.
 *
 * Displays a friendly error card with the error message + a "Copy error" /
 * "Reload" CTA. Stack traces are hidden by default behind a fold.
 */
class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, componentStack: '' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Caught render error', error, info);
    this.setState({ componentStack: info.componentStack ?? '' });
  }

  handleCopy = async () => {
    const { error, componentStack } = this.state;
    const payload = [
      error ? `Error: ${error.name}: ${error.message}` : '',
      error?.stack ? `\nStack:\n${error.stack}` : '',
      componentStack ? `\nComponent stack:\n${componentStack}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    try {
      await navigator.clipboard.writeText(payload);
      // Best-effort toast via native alert to avoid pulling another dep.
      window.alert('错误信息已复制到剪贴板，可以粘贴给开发人员排查');
    } catch {
      window.alert(`复制失败，手动复制下面的内容：\n\n${payload}`);
    }
  };

  handleReload = () => {
    window.location.hash = '#/';
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error } = this.state;

    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background:
            'radial-gradient(1200px 600px at 10% -10%, rgba(124,58,237,0.18), transparent 60%), radial-gradient(1000px 500px at 110% 110%, rgba(59,130,246,0.15), transparent 60%), #0f172a',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: 640,
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(124, 58, 237, 0.35)',
            borderRadius: 16,
            padding: '28px 28px 24px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <Space align="start" size={14} style={{ marginBottom: 12 }}>
            <span
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background:
                  'linear-gradient(135deg, rgba(239,68,68,0.22), rgba(245,158,11,0.22))',
                border: '1px solid rgba(239,68,68,0.45)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fca5a5',
                fontSize: 22,
                flexShrink: 0,
              }}
            >
              <WarningOutlined />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <Title level={4} style={{ color: '#e2e8f0', margin: 0 }}>
                页面遇到了未处理的错误
              </Title>
              <Paragraph style={{ color: '#94a3b8', marginTop: 6, marginBottom: 0 }}>
                应用已停止渲染以防止意外行为。可以尝试刷新，或者将下方的错误信息复制给开发人员协助排查。
              </Paragraph>
            </div>
          </Space>

          <div
            style={{
              marginTop: 18,
              borderRadius: 10,
              background: '#020617',
              border: '1px solid rgba(148,163,184,0.2)',
              padding: '14px 16px',
            }}
          >
            <Space size={6} style={{ marginBottom: 6 }}>
              <BugOutlined style={{ color: '#f87171' }} />
              <Text style={{ color: '#fecaca', fontWeight: 600 }}>
                {error?.name ?? 'Error'}
              </Text>
            </Space>
            <div
              style={{
                color: '#e2e8f0',
                fontSize: 14,
                lineHeight: 1.55,
                wordBreak: 'break-word',
              }}
            >
              {error?.message ?? '未知错误'}
            </div>
            {error?.stack && (
              <details style={{ marginTop: 12 }}>
                <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>
                  查看技术栈信息
                </summary>
                <pre
                  style={{
                    marginTop: 10,
                    margin: 0,
                    padding: '12px 14px',
                    background: 'rgba(15,23,42,0.8)',
                    border: '1px dashed rgba(148,163,184,0.2)',
                    borderRadius: 8,
                    color: '#cbd5e1',
                    fontSize: 12,
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    maxHeight: 260,
                    overflow: 'auto',
                  }}
                >
                  {error.stack}
                </pre>
              </details>
            )}
          </div>

          <Space style={{ marginTop: 20 }} size={10}>
            <Button type="primary" icon={<ReloadOutlined />} onClick={this.handleReload}>
              重新加载应用
            </Button>
            <Button onClick={this.handleCopy}>复制错误信息</Button>
          </Space>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
