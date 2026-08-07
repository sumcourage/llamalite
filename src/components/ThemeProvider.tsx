import React from 'react';
import { ConfigProvider } from 'antd';
import { darkTheme } from '../styles/theme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  return (
    <ConfigProvider theme={darkTheme}>
      {children}
    </ConfigProvider>
  );
};

export default ThemeProvider;