export interface AppSettings {
  modelsDir?: string;
  llamaServerPath?: string;
  theme: string;
  language: string;
  firstRun: boolean;
}

export const defaultSettings: AppSettings = {
  modelsDir: '',
  llamaServerPath: '',
  theme: 'dark',
  language: 'zh-CN',
  firstRun: true,
};
