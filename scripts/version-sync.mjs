import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(root, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const requested = process.argv[2];
if (requested && !/^\d+\.\d+\.\d+$/.test(requested)) {
  console.error(`[FAIL] 版本号格式无效: ${requested} (应形如 0.3.0)`);
  process.exit(1);
}

if (requested) {
  pkg.version = requested;
  writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

const version = pkg.version;
const minorSeries = version.split('.').slice(0, 2).join('.');

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const now = new Date();
const coverDateZh = `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
const coverDateEn = `${MONTHS_EN[now.getMonth()]} ${now.getFullYear()}`;

const targets = [
  {
    path: 'src-tauri/Cargo.toml',
    rules: [[/(\[package\][\s\S]*?\nversion = ")\d+\.\d+\.\d+(")/, `$1${version}$2`]],
  },
  {
    path: 'src-tauri/Cargo.lock',
    rules: [[/(\[\[package\]\]\r?\nname = "llamalite"\r?\nversion = ")\d+\.\d+\.\d+(")/, `$1${version}$2`]],
  },
  {
    path: 'llamalite-manual-zh/llamalite-manual-zh.html',
    rules: [
      [/(<div class="version-tag">v)\d+\.\d+\.\d+(<\/div>)/, `$1${version}$2`],
      [/(<span>使用说明书 v)\d+\.\d+(<\/span>)/, `$1${minorSeries}$2`],
      [/(<span>版本 )\d+\.\d+\.\d+(<\/span>)/, `$1${version}$2`],
      [/(<span>)\d{4} 年 \d{1,2} 月(<\/span>)/, `$1${coverDateZh}$2`],
      [/(<li>版本号：)\d+\.\d+\.\d+(<\/li>)/, `$1${version}$2`],
      [/(Llamalite v)\d+\.\d+\.\d+( &mdash;)/, `$1${version}$2`],
    ],
  },
  {
    path: 'llamalite-manual-en/llamalite-manual-en.html',
    rules: [
      [/(<div class="version-tag">v)\d+\.\d+\.\d+(<\/div>)/, `$1${version}$2`],
      [/(<span>User Manual v)\d+\.\d+(<\/span>)/, `$1${minorSeries}$2`],
      [/(<span>Version )\d+\.\d+\.\d+(<\/span>)/, `$1${version}$2`],
      [/(<span>)(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}(<\/span>)/, `$1${coverDateEn}$2`],
      [/(<li>Version: )\d+\.\d+\.\d+(<\/li>)/, `$1${version}$2`],
      [/(Llamalite v)\d+\.\d+\.\d+( &mdash;)/, `$1${version}$2`],
    ],
  },
];

let failed = false;

for (const target of targets) {
  const abs = resolve(root, target.path);
  let content = readFileSync(abs, 'utf8');
  for (const [pattern, replacement] of target.rules) {
    if (!pattern.test(content)) {
      console.error(`[FAIL] ${target.path}: 未匹配到 ${pattern}`);
      failed = true;
      continue;
    }
    content = content.replace(pattern, replacement);
  }
  writeFileSync(abs, content);
  console.log(`[OK] ${target.path}`);
}

const tauriConfigPath = resolve(root, 'src-tauri/tauri.conf.json');
const tauriConfig = JSON.parse(readFileSync(tauriConfigPath, 'utf8'));
if (tauriConfig.version !== '../package.json') {
  console.error(`[FAIL] src-tauri/tauri.conf.json: version 应引用 "../package.json"，当前为 ${JSON.stringify(tauriConfig.version)}`);
  failed = true;
}

if (failed) {
  console.error('部分文件未按预期更新，请检查上述提示。');
  process.exit(1);
}

console.log(`版本已同步为 ${version}`);
console.log(`手册封面日期已更新为 ${coverDateZh} / ${coverDateEn}`);
