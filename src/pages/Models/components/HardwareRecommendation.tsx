import React, { useCallback } from 'react';
import {
  Card,
  Descriptions,
  Typography,
  Space,
  Tag,
  Tooltip,
  Button,
  Skeleton,
  Alert,
  message,
  Progress,
} from 'antd';
import {
  DownloadOutlined,
  RocketOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  BulbOutlined,
  PartitionOutlined,
  CodeOutlined,
  GlobalOutlined,
  ExperimentOutlined,
  MessageOutlined,
  AppstoreOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useHardwareInfo } from '../../../hooks/useHardwareInfo';
import { useModelStore } from '../../../stores/modelStore';
import type { ScoredRecommendation } from '../../../types';

const { Text } = Typography;

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  chat: <MessageOutlined />,
  code: <CodeOutlined />,
  reasoning: <ExperimentOutlined />,
  multilingual: <GlobalOutlined />,
  general: <AppstoreOutlined />,
};

const CATEGORY_LABELS: Record<string, string> = {
  chat: '对话',
  code: '编程',
  reasoning: '推理',
  multilingual: '多语言',
  general: '通用',
};

const FIT_COLORS: Record<string, string> = {
  perfect: '#52c41a',
  good: '#faad14',
  marginal: '#ff4d4f',
};

const FIT_LABELS: Record<string, string> = {
  perfect: '完美适配',
  good: '良好适配',
  marginal: '勉强适配',
};

const HardwareRecommendation: React.FC = () => {
  const { hardwareInfo, recommendations, loading, catalogRefreshing, error, formatMemory, refreshCatalog } = useHardwareInfo();
  const { startDownload } = useModelStore();

  const handleRefreshCatalog = useCallback(async () => {
    try {
      await refreshCatalog();
      message.success({ content: '模型目录已更新' });
    } catch (err) {
      message.error({ content: `更新失败: ${err}` });
    }
  }, [refreshCatalog]);

  const handleDownload = useCallback(async (rec: ScoredRecommendation) => {
    try {
      message.loading({ content: '开始下载...', key: rec.repoId });
      await startDownload(rec.repoId, '');
      message.success({ content: '下载已开始', key: rec.repoId });
    } catch (err) {
      message.error({ content: String(err), key: rec.repoId });
    }
  }, [startDownload]);

  if (loading) {
    return (
      <Card style={{ borderRadius: 12 }}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  return (
    <div>
      {hardwareInfo && (
        <Card
          title={
            <Space>
              <span
                style={{
                  display: 'inline-flex',
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  background: 'rgba(124, 58, 237, 0.2)',
                  color: '#c4b5fd',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <DashboardOutlined />
              </span>
              <span style={{ color: '#e2e8f0' }}>硬件信息</span>
            </Space>
          }
          style={{ borderRadius: 12, marginBottom: 16 }}
          size="small"
        >
          <Descriptions column={2} size="small" colon={false}>
            <Descriptions.Item
              label={
                <Space size={4}>
                  <PartitionOutlined style={{ color: '#93c5fd' }} />
                  <span style={{ color: '#94a3b8' }}>CPU 核心数</span>
                </Space>
              }
            >
              <Text style={{ color: '#e2e8f0', fontWeight: 500 }}>
                {hardwareInfo.cpuCores} 核
              </Text>
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <Space size={4}>
                  <DatabaseOutlined style={{ color: '#34d399' }} />
                  <span style={{ color: '#94a3b8' }}>系统内存</span>
                </Space>
              }
            >
              <Text style={{ color: '#e2e8f0', fontWeight: 500 }}>
                {formatMemory(hardwareInfo.totalMemory)}
                <Text style={{ color: '#64748b', marginLeft: 6 }}>
                  (可用 {formatMemory(hardwareInfo.availableMemory)})
                </Text>
              </Text>
            </Descriptions.Item>
            {hardwareInfo.gpuInfo && hardwareInfo.gpuInfo.length > 0 && hardwareInfo.gpuInfo[0] && (
              <Descriptions.Item label="GPU" span={2}>
                <Space>
                  <span
                    style={{
                      display: 'inline-flex',
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      background: 'rgba(245, 158, 11, 0.2)',
                      color: '#fcd34d',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <RocketOutlined />
                  </span>
                  <Text style={{ color: '#e2e8f0' }}>
                    {hardwareInfo.gpuInfo[0].name}
                    <Text style={{ color: '#94a3b8' }} type="secondary">
                      {'  ·  '}
                      {formatMemory(hardwareInfo.gpuInfo[0].memoryTotal)}
                    </Text>
                  </Text>
                </Space>
              </Descriptions.Item>
            )}
          </Descriptions>
        </Card>
      )}

      {error && (
        <Alert
          type="warning"
          showIcon
          message="硬件检测失败，使用默认配置"
          description={error}
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <Card
        title={
          <Space>
            <span
              style={{
                display: 'inline-flex',
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'rgba(16, 185, 129, 0.2)',
                color: '#6ee7b7',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BulbOutlined />
            </span>
            <span style={{ color: '#e2e8f0' }}>推荐模型</span>
            <Text style={{ color: '#64748b', fontSize: 12, fontWeight: 400, marginLeft: 4 }}>
              根据硬件动态评分排序
            </Text>
            <Tooltip title="从 ModelScope 验证并更新模型目录">
              <Button
                type="text"
                size="small"
                icon={<ReloadOutlined spin={catalogRefreshing} />}
                onClick={handleRefreshCatalog}
                loading={catalogRefreshing}
                style={{ color: '#94a3b8', marginLeft: 4 }}
              />
            </Tooltip>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        {recommendations.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '24px 16px',
              color: '#94a3b8',
              fontSize: 13,
            }}
          >
            暂无适配当前硬件的推荐模型
          </div>
        ) : (
          <div className="recommendation-grid">
            {recommendations.map((rec) => (
              <Card
                key={rec.repoId + rec.name}
                className="hover-card"
                style={{
                  borderRadius: 8,
                  borderColor: rec.fitLevel === 'perfect'
                    ? 'rgba(82, 196, 26, 0.3)'
                    : undefined,
                }}
                size="small"
                actions={[
                  <Tooltip title="下载模型" key="download">
                    <Button
                      type="primary"
                      size="small"
                      icon={<DownloadOutlined />}
                      onClick={() => handleDownload(rec)}
                    >
                      下载
                    </Button>
                  </Tooltip>,
                ]}
              >
                <Card.Meta
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#e2e8f0', fontSize: 13 }}>
                        {rec.name}
                      </Text>
                      <Tooltip title={FIT_LABELS[rec.fitLevel]}>
                        <Progress
                          type="circle"
                          percent={rec.fitScore}
                          size={32}
                          strokeColor={FIT_COLORS[rec.fitLevel]}
                          format={(p) => (
                            <span style={{ fontSize: 10, color: '#e2e8f0' }}>{p}</span>
                          )}
                        />
                      </Tooltip>
                    </div>
                  }
                  description={
                    <div>
                      <Text style={{ color: '#64748b', fontSize: 12, display: 'block' }}>
                        {rec.description}
                      </Text>
                      <Space wrap style={{ marginTop: 8 }}>
                        <Tag
                          color={FIT_COLORS[rec.fitLevel]}
                          style={{ borderRadius: 4, fontSize: 11 }}
                        >
                          {FIT_LABELS[rec.fitLevel]}
                        </Tag>
                        <Tag color="purple" style={{ borderRadius: 4, fontSize: 11 }}>
                          {rec.dynamicQuantization}
                        </Tag>
                        <Tag style={{ borderRadius: 4, fontSize: 11 }}>
                          {formatMemory(rec.dynamicSize)}
                        </Tag>
                        <Tooltip title={CATEGORY_LABELS[rec.category]}>
                          <Tag
                            style={{
                              borderRadius: 4,
                              fontSize: 11,
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3,
                            }}
                          >
                            {CATEGORY_ICONS[rec.category]}
                            {CATEGORY_LABELS[rec.category]}
                          </Tag>
                        </Tooltip>
                      </Space>
                    </div>
                  }
                />
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default HardwareRecommendation;
