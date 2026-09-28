import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RepoFileSelector, { isMmprojFile } from '../../pages/Models/components/RepoFileSelector';
import { useModelStore } from '../../stores/modelStore';
import type { RepoFile } from '../../types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const { invoke } = await import('@tauri-apps/api/core');

const visionRepoFiles: RepoFile[] = [
  { filename: 'Qwen2.5-VL-7B-Instruct-Q8_0.gguf', size: 8_000_000_000 },
  { filename: 'Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf', size: 4_500_000_000 },
  { filename: 'mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf', size: 1_300_000_000 },
];

const textRepoFiles: RepoFile[] = [
  { filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf', size: 4_400_000_000 },
];

beforeEach(() => {
  vi.clearAllMocks();
  useModelStore.setState({
    localModels: [],
    downloadProgress: {},
    searchResults: [],
    loading: false,
    error: null,
  });
});

describe('isMmprojFile', () => {
  it('识别 mmproj 的 gguf 文件', () => {
    expect(isMmprojFile('mmproj-model-f16.gguf')).toBe(true);
    expect(isMmprojFile('MMPROJ-model-f16.GGUF')).toBe(true);
  });

  it('普通模型文件与其它扩展名不算 mmproj', () => {
    expect(isMmprojFile('Qwen2.5-7B-Q4_K_M.gguf')).toBe(false);
    expect(isMmprojFile('mmproj-model.pt')).toBe(false);
  });
});

describe('RepoFileSelector', () => {
  it('把 mmproj 排除出模型列表并显示“一并下载”选项', async () => {
    vi.mocked(invoke).mockResolvedValue(visionRepoFiles);

    render(
      <RepoFileSelector
        open
        repoId="ggml-org/Qwen2.5-VL-7B-Instruct-GGUF"
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf')).toBeInTheDocument();
    });

    // mmproj 不应作为可选模型出现在列表中
    expect(screen.queryByText('mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf')).toBeNull();
    // 但应提示将一并下载
    expect(
      screen.getByText('一并下载多模态投影器（视觉模型必需）'),
    ).toBeInTheDocument();
  });

  it('点击下载时透传 companionFilename', async () => {
    vi.mocked(invoke).mockResolvedValue(visionRepoFiles);
    const onDownload = vi.fn();

    render(
      <RepoFileSelector
        open
        repoId="ggml-org/Qwen2.5-VL-7B-Instruct-GGUF"
        onClose={vi.fn()}
        onDownload={onDownload}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('下载选中文件'));

    expect(onDownload).toHaveBeenCalledWith(
      'ggml-org/Qwen2.5-VL-7B-Instruct-GGUF',
      'Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
      'mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf',
    );
  });

  it('取消勾选后不再透传 companionFilename', async () => {
    vi.mocked(invoke).mockResolvedValue(visionRepoFiles);
    const onDownload = vi.fn();

    render(
      <RepoFileSelector
        open
        repoId="ggml-org/Qwen2.5-VL-7B-Instruct-GGUF"
        onClose={vi.fn()}
        onDownload={onDownload}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText('一并下载多模态投影器（视觉模型必需）'));
    await userEvent.click(screen.getByText('下载选中文件'));

    expect(onDownload).toHaveBeenCalledWith(
      'ggml-org/Qwen2.5-VL-7B-Instruct-GGUF',
      'Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
      undefined,
    );
  });

  it('纯文本模型不显示“一并下载”选项', async () => {
    vi.mocked(invoke).mockResolvedValue(textRepoFiles);

    render(
      <RepoFileSelector
        open
        repoId="Qwen/Qwen2.5-7B-Instruct-GGUF"
        onClose={vi.fn()}
        onDownload={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Qwen2.5-7B-Instruct-Q4_K_M.gguf')).toBeInTheDocument();
    });

    expect(screen.queryByText('一并下载多模态投影器（视觉模型必需）')).toBeNull();
  });
});