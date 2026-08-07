import React, { useState, useCallback, useMemo } from 'react';
import {
  Card,
  Input,
  Button,
  Typography,
  Space,
  Tag,
  Spin,
  message,
  Empty,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  DownloadOutlined,
  StarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  BranchesOutlined,
  HddOutlined,
  CloseCircleOutlined,
  LoadingOutlined,
  CheckCircleOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import { useModelDownload } from '../../../hooks/useModelDownload';
import { useModelStore } from '../../../stores/modelStore';
import type { ModelSearchResult, DownloadProgress } from '../../../types';
import RepoFileSelector from './RepoFileSelector';

const { Text, Paragraph } = Typography;

/* ── helpers ─────────────────────────────────────────────────────────── */

/** Format a relative time string from an ISO date. */
function formatRelativeTime(isoDate: string): string {
  if (!isoDate) return '';
  try {
    const d = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays < 1) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 30) return `${diffDays} 天前`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} 个月前`;
    const diffYears = Math.floor(diffDays / 365);
    return `${diffYears} 年前`;
  } catch {
    return '';
  }
}

/** Parse a repoId into display-friendly pieces.
 *
 *  e.g. "Qwen/Qwen2.5-7B-Instruct-GGUF"
 *    → author: "Qwen"
 *      name:   "Qwen2.5-7B-Instruct"
 *      suffix: "GGUF"
 *      version: "7B"  (extracted from the name)
 */
interface ParsedRepoId {
  author: string;
  name: string;
  suffix: string;
  version: string;
}

function parseRepoId(repoId: string | undefined | null): ParsedRepoId {
  const safeId = repoId ?? '';
  const parts = safeId.split('/');
  const author = parts[0] || '';
  const raw = parts[1] || safeId;

  // Strip common suffixes: -GGUF, -gguf, -Q4_K_M, etc.
  let suffix = '';
  let name = raw;
  const suffixMatch = raw.match(/-(GGUF|gguf|Q\d[_KMS]*|IQ\d[_XNL]*|F\d+)$/i);
  if (suffixMatch) {
    suffix = suffixMatch[1].toUpperCase();
    name = raw.slice(0, suffixMatch.index);
  }

  // Extract a version-like token from the name (e.g. "7B", "13B", "72B", "3B", "1.5B")
  const versionMatch = name.match(/(\d[\d.]*[BbMm]?)/);
  const version = versionMatch ? versionMatch[1].toUpperCase() : '';

  return { author, name, suffix, version };
}

function formatDownloads(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return String(count);
}

/** Format bytes to human-readable size string. */
function formatSize(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** Pick a few meaningful tags for display. */
function getDisplayTags(model: ModelSearchResult): string[] {
  const tags: string[] = [];
  if (model.pipelineTag) tags.push(model.pipelineTag);
  const skipTags = new Set(['gguf', 'text-generation', 'conversational', 'en', 'zh']);
  for (const t of model.tags) {
    if (!skipTags.has(t.toLowerCase()) && tags.length < 4) {
      tags.push(t);
    }
  }
  return tags;
}

/* ── component ───────────────────────────────────────────────────────── */

const HFModelBrowser: React.FC = () => {
  const {
    loading,
    startDownload,
    downloadProgress,
    cancelDownload,
    deleteFailedDownload,
  } = useModelDownload();
  const { searchResults, searchModels } = useModelStore();
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [selectedRepoId, setSelectedRepoId] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Build a map from repoId → DownloadProgress for quick lookup
  const progressByRepoId = useMemo(() => {
    const map = new Map<string, DownloadProgress>();
    for (const p of Object.values(downloadProgress)) {
      if (p.repoId) {
        map.set(p.repoId, p);
      }
    }
    return map;
  }, [downloadProgress]);

  const handleSearch = useCallback(() => {
    if (!query.trim()) {
      message.warning('请输入搜索关键词');
      return;
    }
    setSearched(true);
    searchModels(query.trim());
  }, [query, searchModels]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleDownloadClick = (repoId: string) => {
    setSelectedRepoId(repoId);
    setSelectorOpen(true);
  };

  const handleFileSelected = async (repoId: string, filename: string) => {
    if (downloading) return; // Prevent duplicate submissions
    setDownloading(true);
    try {
      message.loading({ content: '开始下载...', key: repoId });
      await startDownload(repoId, filename);
      message.success({ content: `正在下载 ${filename}`, key: repoId });
      setSelectorOpen(false);
    } catch (err) {
      message.error({ content: String(err), key: repoId });
    } finally {
      setDownloading(false);
    }
  };

  const withActionLoading = async (repoId: string, fn: () => Promise<void>) => {
    setActionLoadingId(repoId);
    try {
      await fn();
    } catch (err) {
      message.error(String(err));
    } finally {
      setActionLoadingId(null);
    }
  };

  /** Render the action area for a search result card based on its download state. */
  const renderCardAction = (model: ModelSearchResult) => {
    const dp = progressByRepoId.get(model.repoId);
    const isLoading = actionLoadingId === model.repoId;

    // No active download → show normal download button
    if (!dp || dp.status === 'deleted') {
      return (
        <Button
          type="primary"
          size="small"
          icon={<DownloadOutlined />}
          onClick={() => handleDownloadClick(model.repoId)}
        >
          下载
        </Button>
      );
    }

    // Downloading → show status + cancel
    if (dp.status === 'downloading') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag style={{
            borderRadius: 4,
            margin: 0,
            fontSize: 11,
            border: '1px solid rgba(124, 58, 237, 0.3)',
            background: 'rgba(124, 58, 237, 0.08)',
            color: '#a78bfa',
          }}>
            下载中...
          </Tag>
          <Tooltip title="取消">
            <Button
              type="text"
              size="small"
              danger
              icon={isLoading ? <LoadingOutlined /> : <CloseCircleOutlined />}
              onClick={() => withActionLoading(model.repoId, () => cancelDownload(dp.modelId))}
              disabled={isLoading}
              style={{ fontSize: 14 }}
            />
          </Tooltip>
        </div>
      );
    }

    // Error → show retry/cancel
    if (dp.status === 'error') {
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag style={{
            borderRadius: 4,
            margin: 0,
            fontSize: 11,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.08)',
            color: '#f87171',
          }}>
            下载失败
          </Tag>
          <Button
            type="primary"
            size="small"
            icon={isLoading ? <LoadingOutlined /> : <DownloadOutlined />}
            onClick={() => withActionLoading(model.repoId, () => deleteFailedDownload(dp.modelId).then(() => handleDownloadClick(model.repoId)))}
            disabled={isLoading}
          >
            重试
          </Button>
          <Tooltip title="删除并清理">
            <Button
              type="text"
              size="small"
              danger
              icon={isLoading ? <LoadingOutlined /> : <DeleteOutlined />}
              onClick={() => withActionLoading(model.repoId, () => deleteFailedDownload(dp.modelId))}
              disabled={isLoading}
              style={{ fontSize: 14 }}
            />
          </Tooltip>
        </div>
      );
    }

    // Completed → show completed badge
    if (dp.status === 'completed') {
      return (
        <Tag
          icon={<CheckCircleOutlined />}
          style={{
            borderRadius: 4,
            margin: 0,
            fontSize: 11,
            border: '1px solid rgba(34, 197, 94, 0.3)',
            background: 'rgba(34, 197, 94, 0.08)',
            color: '#4ade80',
          }}
        >
          已下载
        </Tag>
      );
    }

    // Fallback
    return (
      <Button
        type="primary"
        size="small"
        icon={<DownloadOutlined />}
        onClick={() => handleDownloadClick(model.repoId)}
      >
        下载
      </Button>
    );
  };

  return (
    <div>
      {/* ── Search bar ─────────────────────────────────────────────── */}
      <Space.Compact style={{ width: '100%', marginBottom: 16 }}>
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入模型名称或关键词搜索，如 Qwen2.5、Llama、GGUF..."
          style={{ flex: 1 }}
          allowClear
          size="large"
        />
        <Button
          type="primary"
          icon={<SearchOutlined />}
          onClick={handleSearch}
          loading={loading}
          size="large"
        >
          搜索
        </Button>
      </Space.Compact>

      {/* ── Results ────────────────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin tip="搜索中..." />
        </div>
      ) : searchResults.length > 0 ? (
        <>
          <Text
            style={{
              color: '#64748b',
              fontSize: 12,
              marginBottom: 10,
              display: 'block',
            }}
          >
            找到 {searchResults.length} 个结果
          </Text>

          <div
            style={{
              maxHeight: 'calc(100vh - 220px)',
              overflowY: 'auto',
              paddingRight: 4,
            }}
          >
            <div
              className="hf-model-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                gap: 12,
              }}
            >
              {searchResults.map((model) => {
                if (!model.repoId) return null;
                const parsed = parseRepoId(model.repoId);
                const displayTags = getDisplayTags(model);
                const relTime = formatRelativeTime(model.lastModified);
                const dp = progressByRepoId.get(model.repoId);
                const cardBorderColor =
                  dp?.status === 'downloading'
                    ? '1px solid rgba(124, 58, 237, 0.5)'
                    : dp?.status === 'error'
                      ? '1px solid rgba(239, 68, 68, 0.4)'
                      : dp?.status === 'completed'
                        ? '1px solid rgba(34, 197, 94, 0.3)'
                        : '1px solid rgba(37, 37, 64, 0.6)';

                return (
                  <Card
                    key={model.repoId}
                    size="small"
                    hoverable
                    style={{
                      borderRadius: 10,
                      border: cardBorderColor,
                      background: 'rgba(15, 15, 30, 0.5)',
                    }}
                    styles={{ body: { padding: '14px 16px' } }}
                  >
                    {/* Row 1 — Model name + version badge */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <Tooltip title={model.repoId}>
                        <Text
                          strong
                          style={{
                            color: '#e2e8f0',
                            fontSize: 14,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            flex: 1,
                          }}
                        >
                          {parsed.name || model.repoId}
                        </Text>
                      </Tooltip>

                      {parsed.version && (
                        <Tag
                          style={{
                            borderRadius: 4,
                            margin: 0,
                            fontWeight: 500,
                            border: '1px solid rgba(59, 130, 246, 0.35)',
                            background: 'rgba(59, 130, 246, 0.1)',
                            color: '#93c5fd',
                            fontSize: 11,
                          }}
                        >
                          <BranchesOutlined style={{ marginRight: 3 }} />
                          {parsed.version}
                        </Tag>
                      )}
                    </div>

                    {/* Row 2 — Author + suffix */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginBottom: 8,
                      }}
                    >
                      {parsed.author && (
                        <Text
                          style={{
                            color: '#64748b',
                            fontSize: 12,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <UserOutlined style={{ marginRight: 3 }} />
                          {parsed.author}
                        </Text>
                      )}
                      {parsed.suffix && (
                        <Tag
                          style={{
                            borderRadius: 4,
                            margin: 0,
                            fontSize: 10,
                            lineHeight: '18px',
                            padding: '0 5px',
                            border: '1px solid rgba(168, 85, 247, 0.3)',
                            background: 'rgba(168, 85, 247, 0.08)',
                            color: '#c084fc',
                          }}
                        >
                          {parsed.suffix}
                        </Tag>
                      )}
                    </div>

                    {/* Row 3 — Description */}
                    {model.description && (
                      <Tooltip title={model.description} mouseEnterDelay={0.3}>
                        <Paragraph
                          style={{
                            color: '#94a3b8',
                            fontSize: 12,
                            marginBottom: 10,
                            lineHeight: 1.5,
                            minHeight: 36,
                            cursor: 'default',
                          }}
                          ellipsis={{ rows: 2, expandable: false }}
                        >
                          {model.description}
                        </Paragraph>
                      </Tooltip>
                    )}

                    {/* Row 4 — Stats row */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        flexWrap: 'wrap',
                        marginBottom: 10,
                      }}
                    >
                      <Tooltip title="下载量">
                        <Tag
                          style={{
                            borderRadius: 4,
                            margin: 0,
                            fontSize: 11,
                            lineHeight: '20px',
                            padding: '0 6px',
                            border: '1px solid rgba(124, 58, 237, 0.3)',
                            background: 'rgba(124, 58, 237, 0.08)',
                            color: '#a78bfa',
                          }}
                        >
                          <DownloadOutlined style={{ marginRight: 3 }} />
                          {formatDownloads(model.downloads)}
                        </Tag>
                      </Tooltip>

                      <Tooltip title="点赞数">
                        <Tag
                          style={{
                            borderRadius: 4,
                            margin: 0,
                            fontSize: 11,
                            lineHeight: '20px',
                            padding: '0 6px',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            background: 'rgba(245, 158, 11, 0.08)',
                            color: '#fbbf24',
                          }}
                        >
                          <StarOutlined style={{ marginRight: 3 }} />
                          {model.likes}
                        </Tag>
                      </Tooltip>

                      {model.totalSizeBytes != null && model.totalSizeBytes > 0 && (
                        <Tooltip title="GGUF 文件总大小">
                          <Tag
                            style={{
                              borderRadius: 4,
                              margin: 0,
                              fontSize: 11,
                              lineHeight: '20px',
                              padding: '0 6px',
                              border: '1px solid rgba(52, 211, 153, 0.3)',
                              background: 'rgba(52, 211, 153, 0.08)',
                              color: '#6ee7b7',
                            }}
                          >
                            <HddOutlined style={{ marginRight: 3 }} />
                            {formatSize(model.totalSizeBytes)}
                          </Tag>
                        </Tooltip>
                      )}

                      {relTime && (
                        <Text
                          style={{
                            color: '#475569',
                            fontSize: 11,
                            marginLeft: 'auto',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <ClockCircleOutlined style={{ marginRight: 3 }} />
                          {relTime}
                        </Text>
                      )}
                    </div>

                    {/* Row 5 — Tags + Download action */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap', overflow: 'hidden' }}>
                        {displayTags.slice(0, 3).map((tag) => (
                          <Tag
                            key={tag}
                            style={{
                              borderRadius: 4,
                              margin: 0,
                              fontSize: 10,
                              lineHeight: '18px',
                              padding: '0 5px',
                              color: '#94a3b8',
                              border: '1px solid rgba(148, 163, 184, 0.2)',
                              background: 'rgba(148, 163, 184, 0.06)',
                            }}
                          >
                            {tag}
                          </Tag>
                        ))}
                      </div>
                      {renderCardAction(model)}
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      ) : searched ? (
        <Empty description="未找到相关模型" />
      ) : null}

      <RepoFileSelector
        open={selectorOpen}
        repoId={selectedRepoId}
        onClose={() => setSelectorOpen(false)}
        onDownload={handleFileSelected}
        downloading={downloading}
      />
    </div>
  );
};

export default HFModelBrowser;
