export interface ComponentStatus {
  name: string;
  installed: boolean;
  version?: string;
  message: string;
  installUrl?: string;
  /** Step-by-step installation guide, shown when component is not installed. */
  installGuide?: string[];
}

export interface EnvironmentStatus {
  llamaServer: ComponentStatus;
  modelscope: ComponentStatus;
  python: ComponentStatus;
  allReady: boolean;
}
