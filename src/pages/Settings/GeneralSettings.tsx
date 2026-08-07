import React, { useEffect, useState } from 'react';
import { Typography, Card, Form, Input, Button, message, Space, Tag } from 'antd';
import {
  SaveOutlined,
  FolderOutlined,
  ReloadOutlined,
  LoadingOutlined,
  LinkOutlined,
} from '@ant-design/icons';
import { useSettingsStore } from '../../stores/settingsStore';
import EnvironmentCheck from '../../components/EnvironmentCheck';
import type { EnvironmentStatus } from '../../types';

const { Title, Text } = Typography;

const GeneralSettings: React.FC = () => {
  const {
    settings,
    loading,
    fetchSettings,
    updateSettings,
    checkEnvironment,
    checkExecutablePath,
    environmentStatus,
    checkingEnvironment,
  } = useSettingsStore();

  const [modelsDir, setModelsDir] = useState('');
  const [llamaServerPath, setLlamaServerPath] = useState('');
  const [saving, setSaving] = useState(false);
  const [pathValidating, setPathValidating] = useState(false);
  const [pathValid, setPathValid] = useState<boolean | null>(null);

  useEffect(() => {
    // Run settings fetch and environment check in parallel for faster page load
    fetchSettings();
    checkEnvironment();
  }, []);

  useEffect(() => {
    if (settings) {
      setModelsDir(settings.modelsDir || '');
      setLlamaServerPath(settings.llamaServerPath || '');
    }
  }, [settings]);

  const handleModelsDirSelect = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        directory: true,
        title: '选择模型存储目录',
      });
      if (selected && typeof selected === 'string') {
        setModelsDir(selected);
      }
    } catch (err) {
      console.error('File dialog error:', err);
    }
  };

  const handleLlamaServerSelect = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({
        multiple: false,
        title: '选择 llama-server 可执行文件',
        filters: [
          { name: '可执行文件', extensions: ['exe', 'bin'] },
          { name: '所有文件', extensions: ['*'] },
        ],
      });
      if (selected && typeof selected === 'string') {
        setLlamaServerPath(selected);
        setPathValid(null);
      }
    } catch (err) {
      console.error('File dialog error:', err);
    }
  };

  const handleValidatePath = async () => {
    if (!llamaServerPath) {
      message.warning('请先选择 llama-server 路径');
      return;
    }
    setPathValidating(true);
    try {
      const valid = await checkExecutablePath(llamaServerPath);
      setPathValid(valid);
      if (valid) {
        message.success('llama-server 可执行文件验证通过');
      } else {
        message.error('llama-server 可执行文件无效');
      }
    } catch (err) {
      message.error(String(err));
    } finally {
      setPathValidating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings({
        modelsDir: modelsDir.trim(),
        llamaServerPath: llamaServerPath.trim(),
      });
      message.success('设置已保存');
      // Re-check environment after save
      await checkEnvironment();
    } catch (err) {
      message.error(String(err));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <LoadingOutlined style={{ fontSize: 32 }} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <Title level={4} style={{ color: '#e2e8f0', marginBottom: 24 }}>
        设置
      </Title>

      {/* Environment Check Section */}
      <div style={{ marginBottom: 24 }}>
        <EnvironmentCheck
          status={environmentStatus}
          loading={checkingEnvironment}
          onCheck={checkEnvironment}
        />
      </div>

      {/* General Settings Section */}
      <Card
        title={<span style={{ color: '#e2e8f0' }}>通用设置</span>}
        style={{ borderRadius: 12 }}
        extra={
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
          >
            保存
          </Button>
        }
      >
        <Form layout="vertical">
          <Form.Item
            label={
              <Space>
                <span style={{ color: '#e2e8f0' }}>llama-server 路径</span>
                <Tag color="default" style={{ fontSize: 11 }}>可选</Tag>
              </Space>
            }
            help={
              <Space direction="vertical" size={4}>
                <Text style={{ color: '#64748b', fontSize: 12 }}>
                  如已将 llama-server 添加到系统 PATH，此处无需配置。
                  仅在 PATH 中未找到时，才需要手动指定路径。
                </Text>
                {pathValid !== null && (
                  <Tag color={pathValid ? 'success' : 'error'}>
                    {pathValid ? '路径有效' : '路径无效'}
                  </Tag>
                )}
              </Space>
            }
          >
            <Space.Compact style={{ width: '100%' }}>
              <Input
                value={llamaServerPath}
                onChange={(e) => {
                  setLlamaServerPath(e.target.value);
                  setPathValid(null);
                }}
                placeholder="llama-server"
                style={{ maxWidth: 500 }}
              />
              <Button
                icon={<FolderOutlined />}
                onClick={handleLlamaServerSelect}
                style={{ height: 32 }}
              >
                浏览
              </Button>
              <Button
                icon={pathValidating ? <LoadingOutlined /> : <ReloadOutlined />}
                onClick={handleValidatePath}
                loading={pathValidating}
                style={{ height: 32 }}
              >
                验证
              </Button>
            </Space.Compact>
            <div style={{ marginTop: 8 }}>
              <Text style={{ color: '#7c3aed', fontSize: 12 }}>
                <a
                  href="https://github.com/ggml-org/llama.cpp/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Space size={4}>
                    <LinkOutlined />
                    下载 llama.cpp
                  </Space>
                </a>
              </Text>
            </div>
          </Form.Item>

          <Form.Item
            label={<span style={{ color: '#e2e8f0' }}>模型存储目录</span>}
            help={
              <Text style={{ color: '#64748b', fontSize: 12 }}>
                下载的模型将存储在此目录中。留空则使用默认目录。
              </Text>
            }
          >
            <Input
              value={modelsDir}
              readOnly
              placeholder="默认目录"
              addonAfter={
                <span
                  onClick={handleModelsDirSelect}
                  style={{ cursor: 'pointer', color: '#7c3aed' }}
                >
                  <FolderOutlined /> 选择
                </span>
              }
              style={{ maxWidth: 500 }}
            />
          </Form.Item>
        </Form>
      </Card>

      <div style={{ marginTop: 24 }}>
        <Button type="link" onClick={() => window.open('/settings/about', '_self')}>
          关于 Llamalite
        </Button>
      </div>
    </div>
  );
};

export default GeneralSettings;