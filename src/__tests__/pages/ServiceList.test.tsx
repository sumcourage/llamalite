import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ServiceList from '../../pages/Services/ServiceList';
import { useServiceStore } from '../../stores/serviceStore';
import type { ServiceConfig, ServiceStatusInfo } from '../../types';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockServices: ServiceConfig[] = [
  {
    id: 'svc-1',
    name: '图片OCR服务',
    modelPath: '/models/ocr.gguf',
    parameters: { port: 8080 },
    createdAt: '2026-01-01 00:00:00',
    updatedAt: '2026-01-01 00:00:00',
  },
  {
    id: 'svc-2',
    name: '聊天服务',
    modelPath: '/models/chat.gguf',
    parameters: { port: 8081 },
    createdAt: '2026-01-02 00:00:00',
    updatedAt: '2026-01-02 00:00:00',
  },
];

// Only svc-1 owns the running process; the backend reports svc-2 as stopped.
const runningStatus: ServiceStatusInfo = {
  id: 'svc-1',
  status: 'running',
  modelName: '图片OCR服务',
  port: 8080,
};
const stoppedStatus: ServiceStatusInfo = {
  id: 'svc-2',
  status: 'stopped',
  modelName: '',
  port: 0,
};

const noop = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  useServiceStore.setState({
    services: mockServices,
    serviceStatuses: { 'svc-1': runningStatus, 'svc-2': stoppedStatus },
    currentStatus: runningStatus,
    logs: [],
    loading: false,
    error: null,
    fetchServices: noop,
    fetchAllStatuses: noop,
  });
});

function renderList() {
  return render(
    <MemoryRouter>
      <ServiceList />
    </MemoryRouter>,
  );
}

describe('ServiceList', () => {
  it('只把真正在运行的服务标记为运行中', () => {
    renderList();

    expect(screen.getByText('图片OCR服务')).toBeInTheDocument();
    expect(screen.getAllByText('运行中')).toHaveLength(1);
    expect(screen.getAllByText('已停止')).toHaveLength(1);
  });

  it('每张卡片都渲染完整的操作按钮', () => {
    renderList();

    expect(screen.getAllByText('打开Web页面')).toHaveLength(2);
    expect(screen.getAllByText('详情')).toHaveLength(2);
    expect(screen.getAllByText('编辑')).toHaveLength(2);
    expect(screen.getAllByText('删除')).toHaveLength(2);
    expect(screen.getAllByText('停止')).toHaveLength(1);
    expect(screen.getAllByText('启动')).toHaveLength(1);
  });
});