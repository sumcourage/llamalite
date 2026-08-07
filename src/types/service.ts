import type { ParameterValues } from './parameter';

export type ServiceStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'error';

export interface ServiceConfig {
  id: string;
  name: string;
  modelPath: string;
  parameters: ParameterValues;
  createdAt: string;
  updatedAt: string;
}

export interface ServiceStatusInfo {
  id: string;
  status: ServiceStatus;
  modelName: string;
  port: number;
  pid?: number;
  uptime?: number; // seconds
  startedAt?: string;
  errorMessage?: string;
}

export interface ServiceLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
}