import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Typography, Button, Input, Card, message, Space, Form, Spin } from 'antd';
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';
import { useParameterValidation } from '../../hooks/useParameterValidation';
import { useServiceStore } from '../../stores/serviceStore';
import ParameterForm from './components/ParameterForm';
import type { ParameterValues } from '../../types';

const { Title, Text } = Typography;

const ServiceCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { getDefaultValues, validateAll, serializeParameters } = useParameterValidation();
  const { services, fetchServices } = useServiceStore();

  const [serviceName, setServiceName] = useState('');
  const [modelPath, setModelPath] = useState('');
  const [parameterValues, setParameterValues] = useState<ParameterValues>(getDefaultValues());
  const [saving, setSaving] = useState(false);
  const [loadingService, setLoadingService] = useState(false);

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

        // Merge stored parameters with defaults (defaults fill in any missing keys)
        const defaults = getDefaultValues();
        const stored = targetService.parameters as Record<string, unknown>;
        const merged: ParameterValues = { ...defaults };
        for (const key of Object.keys(defaults)) {
          if (stored[key] !== undefined && stored[key] !== null) {
            merged[key] = stored[key] as ParameterValues[string];
          }
        }
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
        setParameterValues((prev) => ({ ...prev, [key]: selected }));
      }
    } catch (err) {
      console.error('File dialog error:', err);
    }
  }, []);

  const handleModelPathSelect = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        title: '选择模型文件',
        filters: [{ name: 'GGUF 模型', extensions: ['gguf'] }],
      });
      if (selected && typeof selected === 'string') {
        setModelPath(selected);
        setParameterValues((prev) => ({ ...prev, model: selected }));
      }
    } catch (err) {
      console.error('File dialog error:', err);
    }
  }, []);

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
          onChange={setParameterValues}
          onFileSelect={handleFileSelect}
        />
      </Card>
    </div>
  );
};

export default ServiceCreate;
