export interface LocalModel {
  id: string;
  repoId: string | null; // 允许手动导入的模型没有 repoId
  filename: string;
  path: string;
  size: number; // bytes
  quantization: string | null;
  downloadDate: string;
  description?: string;
  tags?: string[];
}

export interface DownloadLogEntry {
  timestamp: string;
  level: 'info' | 'success' | 'warning' | 'error' | 'stderr';
  message: string;
}

export interface DownloadProgress {
  modelId: string;
  repoId: string;
  status: 'downloading' | 'completed' | 'error' | 'deleted';
  errorMessage?: string;
  localPath?: string;
  logs?: DownloadLogEntry[];
}

/** Model search result from ModelScope. */
export interface ModelSearchResult {
  id: string;
  repoId: string;
  author: string;
  description: string;
  downloads: number;
  likes: number;
  tags: string[];
  lastModified: string;
  pipelineTag?: string;
  /** Total size of all .gguf files in the repo (bytes). */
  totalSizeBytes?: number;
}

export interface RepoFile {
  filename: string;
  size: number | null;
}
