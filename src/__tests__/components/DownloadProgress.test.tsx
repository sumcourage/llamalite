import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DownloadProgressComponent from '../../pages/Models/components/DownloadProgress';
import type { DownloadProgress } from '../../types';

beforeAll(() => {
  // jsdom does not implement scrollIntoView
  Element.prototype.scrollIntoView = vi.fn();
});

const baseProgress: DownloadProgress = {
  modelId: 'model-1',
  repoId: 'Qwen/Qwen2.5-7B-GGUF',
  status: 'downloading',
  logs: [
    { timestamp: '10:00:00', level: 'info', message: '开始下载' },
    { timestamp: '10:00:05', level: 'info', message: '已完成 45%' },
  ],
};

describe('DownloadProgress', () => {
  it('should collapse logs by default and preview the latest entry', () => {
    render(<DownloadProgressComponent progress={baseProgress} />);

    expect(screen.getByText('展开')).toBeInTheDocument();
    expect(screen.getByTitle('已完成 45%')).toBeInTheDocument();
    // Only the preview line is rendered, earlier entries stay hidden
    expect(screen.queryByText('开始下载')).not.toBeInTheDocument();
  });

  it('should expand logs on click and collapse them again', () => {
    render(<DownloadProgressComponent progress={baseProgress} />);

    fireEvent.click(screen.getByText('日志输出'));

    expect(screen.getByText('收起')).toBeInTheDocument();
    expect(screen.getByText('开始下载')).toBeInTheDocument();
    expect(screen.getByText('已完成 45%')).toBeInTheDocument();

    fireEvent.click(screen.getByText('日志输出'));

    expect(screen.getByText('展开')).toBeInTheDocument();
    expect(screen.queryByText('开始下载')).not.toBeInTheDocument();
  });

  it('should show a waiting hint when no logs exist yet', () => {
    render(<DownloadProgressComponent progress={{ ...baseProgress, logs: [] }} />);

    expect(screen.getByText('等待下载日志...')).toBeInTheDocument();
  });

  it('should show an empty hint for finished downloads without logs', () => {
    render(
      <DownloadProgressComponent
        progress={{ ...baseProgress, status: 'completed', logs: [] }}
      />,
    );

    expect(screen.getByText('暂无日志')).toBeInTheDocument();
  });
});
