import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

export const appVersion = pkg.version;
export const buildTime = new Date().toISOString().slice(0, 10);

export const buildInfoDefine = {
  __APP_VERSION__: JSON.stringify(appVersion),
  __BUILD_TIME__: JSON.stringify(buildTime),
};
