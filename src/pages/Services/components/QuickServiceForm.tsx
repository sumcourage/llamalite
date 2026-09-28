import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  Collapse,
  Input,
  InputNumber,
  Select,
  Switch,
  Tooltip,
  Typography,
  message,
} from 'antd';
import {
  BulbOutlined,
  CheckOutlined,
  CodeOutlined,
  DatabaseOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  MessageOutlined,
  PartitionOutlined,
  RocketOutlined,
  SettingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useModelStore } from '../../../stores/modelStore';
import {
  CONTEXT_SIZE_OPTIONS,
  QUICK_SUMMARY_KEYS,
  SERVICE_SCENARIOS,
  applyScenario,
  matchScenario,
} from '../../../constants/servicePresets';
import { getParameterByKey } from '../../../constants/parameters';
import type { HardwareInfo, ParameterValues } from '../../../types';

const { Text } = Typography;

const SCENARIO_ICONS: Record<string, React.ReactNode> = {
  chat: <MessageOutlined />,
  code: <CodeOutlined />,
  'long-context': <FileTextOutlined />,
  creative: <BulbOutlined />,
  embedding: <DatabaseOutlined />,
};

interface QuickServiceFormProps {
  serviceName: string;
  onServiceNameChange: (name: string) => void;
  modelPath: string;
  onModelPathChange: (path: string, mmprojPath?: string) => void;
  values: ParameterValues;
  onChange: (values: ParameterValues) => void;
  hardwareInfo: HardwareInfo | null;
  hardwareLoading: boolean;
  formatMemory: (bytes: number) => string;
  onApplyHardwareDefaults: () => void;
  onSwitchToAdvanced: () => void;
}

const cardStyle: React.CSSProperties = { borderRadius: 12, marginBottom: 16 };

const QuickServiceForm: React.FC<QuickServiceFormProps> = ({
  serviceName,
  onServiceNameChange,
  modelPath,
  onModelPathChange,
  values,
  onChange,
  hardwareInfo,
  hardwareLoading,
  formatMemory,
  onApplyHardwareDefaults,
  onSwitchToAdvanced,
}) => {
  const navigate = useNavigate();
  const { localModels, fetchLocalModels } = useModelStore();
  const [scenarioKey, setScenarioKey] = useState<string | undefined>(() =>
    matchScenario(values),
  );
  const userPickedScenarioRef = useRef(false);

  useEffect(() => {
    fetchLocalModels();
  }, [fetchLocalModels]);

  // 编辑已有服务时参数是异步载入的，载入后自动识别命中的场景
  useEffect(() => {
    if (userPickedScenarioRef.current) return;
    setScenarioKey(matchScenario(values));
  }, [values]);

  const setValue = useCallback(
    (key: string, value: ParameterValues[string]) => {
      onChange({ ...values, [key]: value });
    },
    [onChange, values],
  );

  const modelOptions = useMemo(() => {
    const options = localModels.map((model) => ({
      label: `${model.filename}${model.size > 0 ? `  ·  ${formatMemory(model.size)}` : ''}`,
      value: model.path,
    }));
    // 已保存的模型文件可能不在模型目录中，保留为选项以免显示为空
    if (modelPath && !options.some((option) => option.value === modelPath)) {
      options.unshift({ label: `${modelPath}  ·  手动指定`, value: modelPath });
    }
    return options;
  }, [localModels, modelPath, formatMemory]);

  const handleScenarioSelect = useCallback(
    (key: string) => {
      const scenario = SERVICE_SCENARIOS.find((item) => item.key === key);
      if (!scenario) return;
      userPickedScenarioRef.current = true;
      setScenarioKey(key);
      onChange(applyScenario(values, scenario));
    },
    [onChange, values],
  );

  const handleManualFileSelect = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        title: '选择 GGUF 模型文件',
        filters: [{ name: 'GGUF 模型', extensions: ['gguf'] }],
      });
      if (selected && typeof selected === 'string') {
        onModelPathChange(selected);
        if (!serviceName.trim()) {
          const filename = selected.split(/[\\/]/).pop() || '';
          onServiceNameChange(filename.replace(/\.gguf$/i, ''));
        }
      }
    } catch (err) {
      message.error(String(err));
    }
  }, [onModelPathChange, onServiceNameChange, serviceName]);

  const handleModelSelect = useCallback(
    (path: string) => {
      // 本地视觉模型自带 mmproj 投影器，选中后自动回填 --mmproj
      const model = localModels.find((item) => item.path === path);
      onModelPathChange(path, model ? model.mmprojPath ?? '' : undefined);
      if (!serviceName.trim()) {
        const filename = path.split(/[\\/]/).pop() || '';
        onServiceNameChange(filename.replace(/\.gguf$/i, ''));
      }
    },
    [onModelPathChange, onServiceNameChange, serviceName, localModels],
  );

  const hasGpu = (hardwareInfo?.gpuInfo?.length ?? 0) > 0;
  const gpuEnabled = Number(values['n-gpu-layers'] ?? 0) !== 0;

  const ctxSize = Number(values['ctx-size'] ?? 0);
  const ctxOptions = useMemo(() => {
    const options = CONTEXT_SIZE_OPTIONS.map((size) => ({
      label: `${size} tokens`,
      value: size,
    }));
    if (ctxSize > 0 && !CONTEXT_SIZE_OPTIONS.includes(ctxSize)) {
      options.unshift({ label: `${ctxSize} tokens（当前）`, value: ctxSize });
    }
    return options;
  }, [ctxSize]);

  const formatSummaryValue = useCallback((key: string, raw: unknown): string => {
    if (raw === undefined || raw === null || raw === '') return '使用默认值';
    if (typeof raw === 'boolean') return raw ? '开启' : '关闭';
    if (key === 'n-gpu-layers') {
      const layers = Number(raw);
      if (layers === -1) return '全部卸载到 GPU';
      if (layers === 0) return '仅使用 CPU';
      return `${layers} 层`;
    }
    return String(raw);
  }, []);

  const renderFieldRow = (
    label: React.ReactNode,
    control: React.ReactNode,
    hint?: string,
  ) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '10px 0',
        borderBottom: '1px solid rgba(37, 37, 64, 0.6)',
      }}
    >
      <div style={{ width: 140, flexShrink: 0 }}>
        <Text style={{ color: '#cbd5e1', fontSize: 13 }}>{label}</Text>
        {hint && (
          <Text style={{ color: '#64748b', fontSize: 11, display: 'block' }}>
            {hint}
          </Text>
        )}
      </div>
      <div style={{ flex: 1, maxWidth: 320 }}>{control}</div>
    </div>
  );

  return (
    <div>
      {/* 基础信息 */}
      <Card
        title={<span style={{ color: '#e2e8f0' }}>1. 基础信息</span>}
        style={cardStyle}
      >
        <div style={{ marginBottom: 16 }}>
          <Text style={{ color: '#cbd5e1', fontSize: 13, display: 'block', marginBottom: 6 }}>
            服务名称
          </Text>
          <Input
            value={serviceName}
            onChange={(e) => onServiceNameChange(e.target.value)}
            placeholder="例如: 我的聊天服务"
            style={{ maxWidth: 400 }}
          />
        </div>

        <div>
          <Text style={{ color: '#cbd5e1', fontSize: 13, display: 'block', marginBottom: 6 }}>
            模型文件
          </Text>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Select
              style={{ minWidth: 360, maxWidth: 520 }}
              placeholder={
                localModels.length > 0 ? '从已下载的模型中选择' : '暂无本地模型，可手动选择文件'
              }
              value={modelPath || undefined}
              onChange={handleModelSelect}
              options={modelOptions}
              showSearch
              optionFilterProp="label"
              notFoundContent="没有匹配的本地模型"
            />
            <Button icon={<FolderOpenOutlined />} onClick={handleManualFileSelect}>
              手动选择文件
            </Button>
          </div>
          {localModels.length === 0 && (
            <Text style={{ color: '#f59e0b', fontSize: 12, display: 'block', marginTop: 8 }}>
              还没有本地模型，
              <Button type="link" size="small" onClick={() => navigate('/models')} style={{ padding: 0 }}>
                去模型管理下载
              </Button>
            </Text>
          )}
        </div>
      </Card>

      {/* 使用场景 */}
      <Card
        title={
          <span style={{ color: '#e2e8f0' }}>
            2. 选择用途
            <Text style={{ color: '#64748b', fontSize: 12, marginLeft: 8, fontWeight: 400 }}>
              会自动套用适合的采样参数，之后仍可在高级配置中微调
            </Text>
          </span>
        }
        style={cardStyle}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))',
            gap: 12,
          }}
        >
          {SERVICE_SCENARIOS.map((scenario) => {
            const selected = scenarioKey === scenario.key;
            return (
              <div
                key={scenario.key}
                onClick={() => handleScenarioSelect(scenario.key)}
                className="hover-card"
                style={{
                  position: 'relative',
                  padding: '12px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: selected ? 'rgba(124, 58, 237, 0.16)' : 'rgba(15, 15, 30, 0.6)',
                  border: selected
                    ? '1px solid rgba(124, 58, 237, 0.7)'
                    : '1px solid rgba(124, 58, 237, 0.18)',
                }}
              >
                {selected && (
                  <CheckOutlined
                    style={{ position: 'absolute', top: 10, right: 10, color: '#a78bfa', fontSize: 12 }}
                  />
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ color: selected ? '#c4b5fd' : '#94a3b8', fontSize: 14 }}>
                    {SCENARIO_ICONS[scenario.key]}
                  </span>
                  <Text style={{ color: selected ? '#e2e8f0' : '#cbd5e1', fontSize: 13 }}>
                    {scenario.label}
                  </Text>
                </div>
                <Text style={{ color: '#64748b', fontSize: 12, lineHeight: 1.5 }}>
                  {scenario.description}
                </Text>
              </div>
            );
          })}
        </div>
      </Card>

      {/* 运行配置 */}
      <Card
        title={<span style={{ color: '#e2e8f0' }}>3. 运行配置</span>}
        extra={
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={onApplyHardwareDefaults}
            loading={hardwareLoading}
            style={{ borderColor: 'rgba(124, 58, 237, 0.5)', color: '#c4b5fd' }}
          >
            按硬件推荐一键配置
          </Button>
        }
        style={cardStyle}
      >
        {/* 硬件摘要 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            flexWrap: 'wrap',
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(124, 58, 237, 0.08)',
            border: '1px solid rgba(124, 58, 237, 0.15)',
            marginBottom: 8,
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <PartitionOutlined style={{ color: '#93c5fd' }} />
            <Text style={{ color: '#cbd5e1', fontSize: 12 }}>
              {hardwareInfo ? `${hardwareInfo.cpuCores} 核` : '检测中...'}
            </Text>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <DatabaseOutlined style={{ color: '#34d399' }} />
            <Text style={{ color: '#cbd5e1', fontSize: 12 }}>
              {hardwareInfo
                ? `内存 ${formatMemory(hardwareInfo.totalMemory)}（可用 ${formatMemory(hardwareInfo.availableMemory)}）`
                : '内存检测中...'}
            </Text>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <RocketOutlined style={{ color: hasGpu ? '#fcd34d' : '#64748b' }} />
            <Text style={{ color: '#cbd5e1', fontSize: 12 }}>
              {hasGpu && hardwareInfo?.gpuInfo?.[0]
                ? `${hardwareInfo.gpuInfo[0].name} · ${formatMemory(hardwareInfo.gpuInfo[0].memoryTotal)}`
                : '未检测到可用 GPU（将使用 CPU 推理）'}
            </Text>
          </span>
        </div>

        {renderFieldRow(
          '上下文长度',
          <Select
            style={{ width: '100%' }}
            value={ctxSize > 0 ? ctxSize : undefined}
            onChange={(value) => setValue('ctx-size', value)}
            options={ctxOptions}
          />,
          '越大能记住的内容越多，占用内存也越多',
        )}

        {renderFieldRow(
          'GPU 加速',
          <Tooltip title={hasGpu ? '开启后将模型全部层卸载到 GPU' : '未检测到可用 GPU'}>
            <Switch
              checked={gpuEnabled}
              disabled={!hasGpu}
              onChange={(checked) => setValue('n-gpu-layers', checked ? -1 : 0)}
            />
          </Tooltip>,
          '使用显卡推理，速度更快',
        )}

        {renderFieldRow(
          '服务端口',
          <InputNumber
            style={{ width: '100%' }}
            min={1}
            max={65535}
            value={typeof values.port === 'number' ? values.port : 8080}
            onChange={(value) => setValue('port', value ?? undefined)}
          />,
          '访问地址 http://127.0.0.1:端口',
        )}

        <Collapse
          ghost
          style={{ marginTop: 4 }}
          items={[
            {
              key: 'more',
              label: (
                <Text style={{ color: '#94a3b8', fontSize: 13 }}>
                  <SettingOutlined style={{ marginRight: 6 }} />
                  更多选项（可选）
                </Text>
              ),
              children: (
                <>
                  {renderFieldRow(
                    '聊天模板',
                    <Tooltip title={getParameterByKey('jinja')?.description}>
                      <Switch
                        checked={Boolean(values.jinja)}
                        onChange={(checked) => setValue('jinja', checked)}
                      />
                    </Tooltip>,
                    '建议开启，适配大多数对话模型',
                  )}
                  {renderFieldRow(
                    'Flash Attention',
                    <Tooltip title={getParameterByKey('flash-attn')?.description}>
                      <Switch
                        checked={Boolean(values['flash-attn'])}
                        onChange={(checked) => setValue('flash-attn', checked)}
                      />
                    </Tooltip>,
                    '降低显存占用并提升速度',
                  )}
                </>
              ),
            },
          ]}
        />
      </Card>

      {/* 配置预览 */}
      <Card
        title={<span style={{ color: '#e2e8f0' }}>4. 配置预览</span>}
        extra={
          <Button type="link" size="small" onClick={onSwitchToAdvanced} style={{ padding: 0 }}>
            需要更精细的控制？切换到高级配置
          </Button>
        }
        style={{ ...cardStyle, marginBottom: 0 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '10px 24px',
          }}
        >
          {QUICK_SUMMARY_KEYS.map((key) => {
            const meta = getParameterByKey(key);
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <Text style={{ color: '#94a3b8', fontSize: 12 }}>{meta?.label ?? key}</Text>
                <Text style={{ color: '#e2e8f0', fontSize: 12, textAlign: 'right' }}>
                  {formatSummaryValue(key, values[key])}
                </Text>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default QuickServiceForm;
