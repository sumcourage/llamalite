import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Typography, Card, Descriptions, Button, Space, Divider } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const About: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Space style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/settings')}
          style={{ color: '#94a3b8' }}
        />
        <Title level={4} style={{ color: '#e2e8f0', margin: 0 }}>
          关于 Llamalite
        </Title>
      </Space>

      <Card style={{ borderRadius: 12 }}>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <Title level={2} style={{ color: '#a78bfa', margin: 0, letterSpacing: 2 }}>
            Llamalite
          </Title>
          <Text style={{ color: '#64748b', fontSize: 14, marginTop: 8, display: 'block' }}>
            LLM 服务管理器
          </Text>
        </div>

        <Divider style={{ borderColor: '#252540' }} />

        <Descriptions column={1} colon={false} size="small">
          <Descriptions.Item label="版本号">
            <Text style={{ color: '#e2e8f0' }}>0.1.0</Text>
          </Descriptions.Item>
          <Descriptions.Item label="构建时间">
            <Text style={{ color: '#e2e8f0' }}>2024-01</Text>
          </Descriptions.Item>
          <Descriptions.Item label="技术栈">
            <Text style={{ color: '#e2e8f0' }}>
              Tauri v2 + React 18 + TypeScript + Rust
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="UI 框架">
            <Text style={{ color: '#e2e8f0' }}>Ant Design 5</Text>
          </Descriptions.Item>
          <Descriptions.Item label="运行时">
            <Text style={{ color: '#e2e8f0' }}>llama.cpp + Python 3</Text>
          </Descriptions.Item>
        </Descriptions>

        <Divider style={{ borderColor: '#252540' }} />

        <div>
          <Title level={5} style={{ color: '#e2e8f0' }}>
            功能概述
          </Title>
          <Paragraph style={{ color: '#94a3b8', fontSize: 14 }}>
            Llamalite 是一个基于 Tauri v2 的跨平台桌面应用，为 llama.cpp 的本地 AI 模型服务提供可视化管理界面。
            您无需操作命令行，即可完成 llama.cpp server 的参数配置、模型下载、服务启停等全生命周期管理。
          </Paragraph>
        </div>

        <div style={{ marginTop: 16 }}>
          <Title level={5} style={{ color: '#e2e8f0' }}>
            核心功能
          </Title>
          <ul style={{ color: '#94a3b8', fontSize: 14, paddingLeft: 20, lineHeight: 2 }}>
            <li>可视化配置 llama.cpp 服务器参数</li>
            <li>从 HuggingFace 搜索和下载模型</li>
            <li>启动/停止/重启推理服务</li>
            <li>实时查看服务日志</li>
            <li>硬件检测与智能模型推荐</li>
            <li>支持断点续传下载</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};

export default About;