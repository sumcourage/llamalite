import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Typography, Button, Input, Card, message, Space, Form, Spin, Segmented, Tooltip } from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useParameterValidation } from '../../hooks/useParameterValidation';
import { useServiceStore } from '../../stores/serviceStore';
import { useHardwareInfo } from '../../hooks/useHardwareInfo';
import ParameterForm from './components/ParameterForm';
import QuickServiceForm from './components/QuickServiceForm';
import { buildHardwareDefaults } from '../../constants/servicePresets';
import type { HardwareProfile } from '../../constants/servicePresets';
import type { ParameterValues } from '../../types';

const { Title, Text } = Typography;

type ConfigMode = 'quick' | 'advanced';

const ServiceCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { validateAll, mergeStoredValues } = useParameterValidation();
  const { services, fetchServices } = useServiceStore();
  const { hardwareInfo, loading: hardwareLoading, formatMemory } = useHardwareInfo();

  // 新建服务默认走快速配置；编辑已有服务默认保留高级配置，避免误改已调好的参数
  const [mode, setMode] = useState<ConfigMode>(isEditMode ? 'advanced' : 'quick');
  const [serviceName, setServiceName] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [parameterValues, setParameterValues] = useState<ParameterValues>(
    () => mergeStoredValues()
  );
  const [saving, setSaving] = useState(false);
  const [loadingService, setLoadingService] = useState(false);

  const valuesRef = useRef(parameterValues);
  const touchedKeysRef = useRef<Set<string>>(new Set());
  const hardwareAppliedRef = useRef(false);

  useEffect(() => {
    valuesRef.current = parameterValues;
  }, [parameterValues]);

  const hardwareProfile = useMemo<HardwareProfile | null>(() => {
    if (!hardwareInfo) return null;
    const gpus = hardwareInfo.gpuInfo ?? [];
    return {
      cpuCores: hardwareInfo.cpuCores,
      totalMemoryGb: hardwareInfo.totalMemory / 1073741824,
      availableMemoryGb: hardwareInfo.availableMemory / 1073741824,
      vramGb: (gpus[0]?.memoryTotal ?? 0) / 1073741824,
      hasGpu: gpus.length > 0,
    };
  }, [hardwareInfo]);

  const applyHardwareDefaults = useCallback(() => {
    const defaults = buildHardwareDefaults(hardwareProfile);
    if (Object.keys(defaults).length === 0) {
      message.info('硬件信息尚未就绪，请稍后再试');
      return;
    }
    Object.keys(defaults).forEach((key) => touchedKeysRef.current.add(key));
    hardwareAppliedRef.current = true;
    setParameterValues((prev) => ({ ...prev, ...defaults }));
  }, [hardwareProfile]);

  // 新建服务时，硬件信息就绪后自动套用推荐参数（用户已手动调整过的项不覆盖）
  useEffect(() => {
    if (isEditMode || hardwareAppliedRef.current || !hardwareProfile) return;
    const defaults = buildHardwareDefaults(hardwareProfile);
    const keys = Object.keys(defaults);
    if (keys.length === 0) return;
    if (keys.some((key) => touchedKeysRef.current.has(key))) return;

    hardwareAppliedRef.current = true;
    setParameterValues((prev) => ({ ...prev, ...defaults }));
  }, [hardwareProfile, isEditMode]);

  // 参数变更入口：记录用户手动改过的键，供硬件推荐避让
  const handleParameterChange = useCallback((next: ParameterValues) => {
    const prev = valuesRef.current;
    Object.keys(next).forEach((key) => {
      if (prev[key] !== next[key]) touchedKeysRef.current.add(key);
    });
    setParameterValues(next);
  }, []);

  const handleModelPathChange = useCallback((path: string) => {
    setModelPath(path);
    handleParameterChange({ ...valuesRef.current, model: path });
  }, [handleParameterChange]);

  // Load existing service data in edit mode
  useEffect(() => {
    if (!isEditMode || !id) return;

    const loadService = async () => {
      setLoadingService(true);
      try {
        // Ensure services are loaded
        let targetService = services.find((s) => s.id === id);
        if (!targetService) {
          await fetchServices();
          targetService = useServiceStore.getState().services.find((s) => s.id === id);
        }

        if (!targetService) {
          message.error('服务未找到');
          navigate('/services');
          return;
        }

        // Pre-fill form with existing data
        setServiceName(targetService.name);
        setModelPath(targetService.modelPath);

        // Restore every persisted parameter (including those without defaults)
        const merged = mergeStoredValues(
          targetService.parameters as Record<string, unknown>
        );
        merged.model = targetService.modelPath || merged.model;
        setParameterValues(merged);
      } catch (err) {
        message.error(`加载服务配置失败: ${String(err)}`);
      } finally {
        setLoadingService(false);
      }
    };

    loadService();
  }, [id, isEditMode]);

  const handleFileSelect = useCallback(async (key: string) => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        title: '选择文件',
        filters: [{ name: 'GGUF 模型', extensions: ['gguf'] }],
      });
      if (selected && typeof selected === 'string') {
        if (key === 'model') {
          setModelPath(selected);
        }
        handleParameterChange({ ...valuesRef.current, [key]: selected });
      }
    } catch (err) {
      console.error('File dialog error:', err);
    }
  }, [handleParameterChange]);

  const handleModelPathSelect = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        title: '选择模型文件',
        filters: [{ name: 'GGUF 模型', extensions: ['gguf'] }],
      });
      if (selected && typeof selected === 'string') {
        handleModelPathChange(selected);
      }
    } catch (err) {
      console.error('File dialog error:', err);
    }
  }, [handleModelPathChange]);

  const handleSave = async () => {
    if (!serviceName.trim()) {
      message.warning('请输入服务名称');
      return;
    }

    if (!modelPath) {
      message.warning('请选择模型文件');
      return;
    }

    // Validate parameters
    const errors = validateAll(parameterValues);
    if (errors.length > 0) {
      message.error(errors[0].message);
      return;
    }

    setSaving(true);
    try {
      const { invoke } = await import('@tauri-apps/api/core');

      if (isEditMode && id) {
        await invoke('update_service', {
          id,
          name: serviceName.trim(),
          modelPath,
          parameters: parameterValues,
        });
        message.success('服务配置已更新');
      } else {
        await invoke('create_service', {
          name: serviceName.trim(),
          modelPath,
          parameters: parameterValues,
        });
        message.success('服务创建成功');
      }
      navigate('/services');
    } catch (err) {
      message.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loadingService) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div className="section-header">
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(isEditMode ? `/services/${id}` : '/services')}
            style={{ color: '#94a3b8' }}
          />
          <Title level={4} style={{ color: '#e2e8f0', margin: 0 }}>
            {isEditMode ? '编辑服务' : '新建服务'}
          </Title>
        </Space>
        <Button
          type="primary"
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saving}
        >
          {isEditMode ? '保存修改' : '保存'}
        </Button>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Segmented
          value={mode}
          onChange={(value) => setMode(value as ConfigMode)}
          options={[
            {
              label: (
                <Tooltip title="只需选择模型和用途，其余参数自动推荐">
                  <span>
                    <ThunderboltOutlined style={{ marginRight: 6 }} />
                    快速配置
                  </span>
                </Tooltip>
              ),
              value: 'quick',
            },
            {
              label: (
                <Tooltip title="逐项设置全部 llama.cpp 参数">
                  <span>
                    <SettingOutlined style={{ marginRight: 6 }} />
                    高级配置
                  </span>
                </Tooltip>
              ),
              value: 'advanced',
            },
          ]}
        />
        <Text style={{ color: '#64748b', fontSize: 12 }}>
          {mode === 'quick'
            ? '不懂参数也能用：选好模型和用途即可，已按硬件自动推荐'
            : '全部参数可自由调整，切换模式不会丢失已填内容'}
        </Text>
      </div>

      {mode === 'quick' ? (
        <QuickServiceForm
          serviceName={serviceName}
          onServiceNameChange={setServiceName}
          modelPath={modelPath}
          onModelPathChange={handleModelPathChange}
          values={parameterValues}
          onChange={handleParameterChange}
          hardwareInfo={hardwareInfo}
          hardwareLoading={hardwareLoading}
          formatMemory={formatMemory}
          onApplyHardwareDefaults={applyHardwareDefaults}
          onSwitchToAdvanced={() => setMode('advanced')}
        />
      ) : (
        <>
          <Card style={{ borderRadius: 12, marginBottom: 16 }}>
            <Form layout="vertical">
              <Form.Item
                label={<span style={{ color: '#e2e8f0' }}>服务名称</span>}
                required
                style={{ marginBottom: 16 }}
              >
                <Input
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="例如: 我的聊天服务"
                  style={{ maxWidth: 400 }}
                />
              </Form.Item>

              <Form.Item
                label={<span style={{ color: '#e2e8f0' }}>模型文件路径</span>}
                required
                style={{ marginBottom: 16 }}
              >
                <Input
                  value={modelPath}
                  readOnly
                  placeholder="点击选择 GGUF 模型文件..."
                  addonAfter={
                    <span
                      onClick={handleModelPathSelect}
                      style={{ cursor: 'pointer', color: '#7c3aed' }}
                    >
                      选择文件
                    </span>
                  }
                  style={{ maxWidth: 600 }}
                />
              </Form.Item>
            </Form>
          </Card>

          <Card
            title={<span style={{ color: '#e2e8f0' }}>服务参数配置</span>}
            style={{ borderRadius: 12 }}
          >
            <ParameterForm
              values={parameterValues}
              onChange={handleParameterChange}
              onFileSelect={handleFileSelect}
            />
          </Card>
        </>
      )}
    </div>
  );
};

export default ServiceCreate;
