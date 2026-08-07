import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  SettingOutlined,
} from '@ant-design/icons';

const { Sider } = Layout;

interface SidebarProps {
  collapsed: boolean;
  onCollapse: (collapsed: boolean) => void;
}

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/services',
    icon: <CloudServerOutlined />,
    label: '服务管理',
  },
  {
    key: '/models',
    icon: <DatabaseOutlined />,
    label: '模型管理',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: '设置',
  },
];

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onCollapse }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return '/';
    if (path.startsWith('/services')) return '/services';
    if (path.startsWith('/models')) return '/models';
    if (path.startsWith('/settings')) return '/settings';
    return '/';
  };

  const handleMenuClick = (info: { key: string }) => {
    navigate(info.key);
  };

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      onCollapse={onCollapse}
      theme="dark"
      width={220}
      collapsedWidth={64}
      trigger={null}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        zIndex: 100,
        borderRight: '1px solid #252540',
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid #252540',
          padding: '0 16px',
        }}
      >
        <span
          style={{
            fontSize: collapsed ? 20 : 18,
            fontWeight: 700,
            color: '#a78bfa',
            letterSpacing: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
          }}
        >
          {collapsed ? 'L' : 'Llamalite'}
        </span>
      </div>

      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        items={menuItems}
        onClick={handleMenuClick}
        style={{ borderRight: 'none', marginTop: 8 }}
      />
    </Sider>
  );
};

export default Sidebar;