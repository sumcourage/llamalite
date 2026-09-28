import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import QuickServiceForm from '../../pages/Services/components/QuickServiceForm';
import type { HardwareInfo, ParameterValues } from '../../types';

const { invoke } = await import('@tauri-apps/api/core');

const GB = 1024 * 1024 * 1024;

const baseValues: ParameterValues = {
  'ctx-size': 2048,
  'n-gpu-layers': 0,
  port: 8080,
  jinja: true,
  'flash-attn': false,
  temperature: 0.8,
};

const cpuOnlyHardware: HardwareInfo = {
  cpuCores: 8,
  totalMemory: 16 * GB,
  availableMemory: 8 * GB,
  gpuInfo: [],
};

const gpuHardware: HardwareInfo = {
  ...cpuOnlyHardware,
  gpuInfo: [{ name: 'NVIDIA RTX 4060', memoryTotal: 8 * GB, memoryFree: 7 * GB }],
};

function renderForm(
  props: Partial<React.ComponentProps<typeof QuickServiceForm>> = {},
) {
  const onChange = vi.fn();
  const onServiceNameChange = vi.fn();
  const onModelPathChange = vi.fn();
  const onApplyHardwareDefaults = vi.fn();

  render(
    <MemoryRouter>
      <QuickServiceForm
        serviceName=""
        onServiceNameChange={onServiceNameChange}
        modelPath=""
        onModelPathChange={onModelPathChange}
        values={baseValues}
        onChange={onChange}
        hardwareInfo={cpuOnlyHardware}
        hardwareLoading={false}
        formatMemory={(bytes) => `${(bytes / GB).toFixed(1)} GB`}
        onApplyHardwareDefaults={onApplyHardwareDefaults}
        onSwitchToAdvanced={vi.fn()}
        {...props}
      />
    </MemoryRouter>,
  );

  return { onChange, onServiceNameChange, onModelPathChange, onApplyHardwareDefaults };
}

describe('QuickServiceForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(invoke).mockResolvedValue([]);
  });

  it('should apply scenario presets when a scenario is picked', () => {
    const { onChange } = renderForm();

    fireEvent.click(screen.getByText('代码助手'));

    expect(onChange).toHaveBeenCalledTimes(1);
    const applied = onChange.mock.calls[0][0] as ParameterValues;
    expect(applied.temperature).toBe(0.2);
    expect(applied.jinja).toBe(true);
  });

  it('should keep unrelated parameters when applying a scenario', () => {
    const { onChange } = renderForm();

    fireEvent.click(screen.getByText('通用对话'));

    const applied = onChange.mock.calls[0][0] as ParameterValues;
    expect(applied['ctx-size']).toBe(2048);
    expect(applied.port).toBe(8080);
  });

  it('should disable GPU acceleration when no GPU is detected', () => {
    renderForm();

    expect(screen.getByText(/未检测到可用 GPU/)).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeDisabled();
  });

  it('should offload all layers when GPU acceleration is enabled', () => {
    const { onChange } = renderForm({ hardwareInfo: gpuHardware });

    fireEvent.click(screen.getByRole('switch'));

    const applied = onChange.mock.calls[0][0] as ParameterValues;
    expect(applied['n-gpu-layers']).toBe(-1);
  });

  it('should summarize the effective configuration', () => {
    renderForm();

    expect(screen.getByText('仅使用 CPU')).toBeInTheDocument();
    expect(screen.getByText('2048 tokens')).toBeInTheDocument();
  });

  it('should expose a shortcut to the advanced form', () => {
    const onSwitchToAdvanced = vi.fn();
    renderForm({ onSwitchToAdvanced });

    fireEvent.click(screen.getByText('需要更精细的控制？切换到高级配置'));

    expect(onSwitchToAdvanced).toHaveBeenCalledTimes(1);
  });

  it('选择视觉模型时一并回填 mmproj 路径', async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        id: 'v1',
        repo_id: 'ggml-org/Qwen2.5-VL-7B-Instruct-GGUF',
        filename: 'Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
        local_path: '/models/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
        size_bytes: 4_500_000_000,
        quantization: 'Q4_K_M',
        downloaded_at: '2026-01-03',
        metadata: {
          description: null,
          tags: ['downloaded'],
          mmproj_path: '/models/mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf',
        },
      },
    ]);

    const { onModelPathChange } = renderForm();

    const selector = document.querySelector('.ant-select-selector') as HTMLElement;
    await waitFor(() => expect(selector).toBeTruthy());
    fireEvent.mouseDown(selector);

    const option = await waitFor(() => {
      const el = document.querySelector('.ant-select-item-option') as HTMLElement | null;
      if (!el) throw new Error('option not ready');
      return el;
    });
    fireEvent.click(option);

    await waitFor(() => {
      expect(onModelPathChange).toHaveBeenCalledWith(
        '/models/Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf',
        '/models/mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf',
      );
    });
  });

  it('选择无 mmproj 的模型时清空 mmproj 路径', async () => {
    vi.mocked(invoke).mockResolvedValue([
      {
        id: 't1',
        repo_id: 'Qwen/Qwen2.5-7B-Instruct-GGUF',
        filename: 'Qwen2.5-7B-Instruct-Q4_K_M.gguf',
        local_path: '/models/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
        size_bytes: 4_400_000_000,
        quantization: 'Q4_K_M',
        downloaded_at: '2026-01-03',
        metadata: { description: null, tags: ['downloaded'] },
      },
    ]);

    const { onModelPathChange } = renderForm();

    const selector = document.querySelector('.ant-select-selector') as HTMLElement;
    await waitFor(() => expect(selector).toBeTruthy());
    fireEvent.mouseDown(selector);

    const option = await waitFor(() => {
      const el = document.querySelector('.ant-select-item-option') as HTMLElement | null;
      if (!el) throw new Error('option not ready');
      return el;
    });
    fireEvent.click(option);

    await waitFor(() => {
      expect(onModelPathChange).toHaveBeenCalledWith(
        '/models/Qwen2.5-7B-Instruct-Q4_K_M.gguf',
        '',
      );
    });
  });
});
