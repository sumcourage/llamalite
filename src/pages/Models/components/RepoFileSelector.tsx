import React, { useEffect, useState, useMemo } from 'react';
import {
  Modal,
  List,
  Typography,
  Tag,
  Button,
  Space,
  Spin,
  Empty,
  message,
} from 'antd';
import {
  DownloadOutlined,
  FileOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import type { RepoFile } from '../../../types';
import { useModelStore } from '../../../stores/modelStore';

const { Text } = Typography;

interface RepoFileSelectorProps {
  open: boolean;
  repoId: string;
  onClose: () => void;
  onDownload: (repoId: string, filename: string) => void;
  downloading?: boolean;
}

/** Quantization preference order for auto-recommendation. */
const QUANT_PREFERENCE = [
  'Q4_K_M',
  'Q4_0',
  'Q5_K_M',
  'Q6_K',
  'Q8_0',
  'IQ4_XS',
  'IQ4_NL',
  'Q4_K_S',
  'Q5_K_S',
  'Q3_K_M',
  'Q3_K_S',
  'Q2_K',
];

/** Extract quantization tag from a filename (case-insensitive). */
function extractQuant(filename: string): string | null {
  const upper = filename.toUpperCase();
  for (const q of QUANT_PREFERENCE) {
    if (upper.includes(q)) return q;
  }
  return null;
}

/** Format bytes to human-readable string. */
function formatSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '--';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const RepoFileSelector: React.FC<RepoFileSelectorProps> = ({
  open,
  repoId,
  onClose,
  onDownload,
  downloading = false,
}) => {
  const { listRepoFiles } = useModelStore();
  const [files, setFiles] = useState<RepoFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [actualRepoId, setActualRepoId] = useState('');

  // Filter only .gguf files and sort by preference
  const ggufFiles = useMemo(() => {
    return files
      .filter((f) => f.filename.toLowerCase().endsWith('.gguf'))
      .sort((a, b) => {
        const qA = extractQuant(a.filename);
        const qB = extractQuant(b.filename);
        const idxA = qA ? QUANT_PREFERENCE.indexOf(qA) : 999;
        const idxB = qB ? QUANT_PREFERENCE.indexOf(qB) : 999;
        if (idxA !== idxB) return idxA - idxB;
        // Same quant or both unknown — sort by size descending
        return (b.size ?? 0) - (a.size ?? 0);
      });
  }, [files]);

  // Auto-recommend the first (best) file
  const recommendedFile = ggufFiles.length > 0 ? ggufFiles[0].filename : null;

  // Fetch files when modal opens, with GGUF variant fallback
  useEffect(() => {
    if (!open || !repoId) return;

    setSelectedFile(null);
    setFiles([]);
    setLoadingFiles(true);

    const tryFetch = async (targetRepoId: string): Promise<RepoFile[]> => {
      const result = await listRepoFiles(targetRepoId);
      // Filter to only keep .gguf files
      const ggufFiles = result.filter((f) => f.filename.toLowerCase().endsWith('.gguf'));
      
      if (ggufFiles.length === 0 && !targetRepoId.toUpperCase().endsWith('-GGUF')) {
        // Try GGUF variant (e.g. "Qwen/Qwen2.5-0.5B-Instruct" -> "Qwen/Qwen2.5-0.5B-Instruct-GGUF")
        const ggufVariant = `${targetRepoId}-GGUF`;
        try {
          const ggufResult = await listRepoFiles(ggufVariant);
          const ggufFilesInVariant = ggufResult.filter((f) => f.filename.toLowerCase().endsWith('.gguf'));
          if (ggufFilesInVariant.length > 0) {
            message.info(`已自动切换到 GGUF 仓库: ${ggufVariant}`);
            setActualRepoId(ggufVariant);
            return ggufResult;
          }
        } catch {
          // GGUF variant not found, fall through to original result
        }
      }
      setActualRepoId(targetRepoId);
      return result;
    };

    tryFetch(repoId)
      .then((result) => {
        setFiles(result);
        const gguf = result
          .filter((f) => f.filename.toLowerCase().endsWith('.gguf'))
          .sort((a, b) => {
            const qA = extractQuant(a.filename);
            const qB = extractQuant(b.filename);
            const idxA = qA ? QUANT_PREFERENCE.indexOf(qA) : 999;
            const idxB = qB ? QUANT_PREFERENCE.indexOf(qB) : 999;
            return idxA - idxB;
          });
        if (gguf.length > 0) {
          setSelectedFile(gguf[0].filename);
        }
      })
      .catch((err) => {
        message.error(`获取文件列表失败: ${err instanceof Error ? err.message : String(err)}`);
      })
      .finally(() => {
        setLoadingFiles(false);
      });
  }, [open, repoId, listRepoFiles]);

  const handleDownload = () => {
    const filename = selectedFile || recommendedFile;
    if (!filename) {
      message.warning('没有可下载的文件');
      return;
    }
    onDownload(actualRepoId || repoId, filename);
  };

  return (
    <Modal
      title={
        <Space>
          <FileOutlined />
          <span>选择下载文件 — {repoId}</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      width={680}
      footer={
        <Space style={{ justifyContent: 'flex-end', width: '100%' }}>
          <Button onClick={onClose}>取消</Button>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
            disabled={!selectedFile && !recommendedFile}
            loading={loadingFiles || downloading}
          >
            {downloading ? '下载中...' : '下载选中文件'}
          </Button>
        </Space>
      }
    >
      {loadingFiles ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 12, color: '#94a3b8' }}>正在获取仓库文件列表...</div>
        </div>
      ) : ggufFiles.length === 0 ? (
        <Empty description="该仓库中没有 .gguf 文件" />
      ) : (
        <List
          dataSource={ggufFiles}
          renderItem={(file, index) => {
            const quant = extractQuant(file.filename);
            const isRecommended = file.filename === recommendedFile;
            const isSelected = selectedFile === file.filename;

            return (
              <List.Item
                onClick={() => setSelectedFile(file.filename)}
                style={{
                  cursor: 'pointer',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: isSelected
                    ? '1px solid #7c3aed'
                    : '1px solid transparent',
                  background: isSelected
                    ? 'rgba(124, 58, 237, 0.08)'
                    : 'transparent',
                  marginBottom: 4,
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text
                      style={{
                        color: '#e2e8f0',
                        fontSize: 13,
                        fontWeight: isSelected ? 600 : 400,
                        wordBreak: 'break-all',
                      }}
                    >
                      {file.filename}
                    </Text>
                    {isRecommended && (
                      <Tag
                        color="purple"
                        icon={<CheckCircleOutlined />}
                        style={{ marginRight: 0, borderRadius: 4, fontSize: 11 }}
                      >
                        推荐
                      </Tag>
                    )}
                    {isSelected && !isRecommended && (
                      <Tag
                        color="blue"
                        style={{ marginRight: 0, borderRadius: 4, fontSize: 11 }}
                      >
                        已选
                      </Tag>
                    )}
                  </div>
                  <Space size={12}>
                    {quant && (
                      <Tag style={{ borderRadius: 4, fontSize: 11 }}>{quant}</Tag>
                    )}
                    <Text style={{ color: '#64748b', fontSize: 12 }}>
                      {formatSize(file.size)}
                    </Text>
                  </Space>
                </div>
              </List.Item>
            );
          }}
          style={{ maxHeight: 400, overflow: 'auto' }}
        />
      )}
    </Modal>
  );
};

export default RepoFileSelector;
