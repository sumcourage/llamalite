import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

const pkg = JSON.parse(read('package.json')) as { version: string };
const version = pkg.version;
const minorSeries = version.split('.').slice(0, 2).join('.');

describe('版本号一致性', () => {
  it('package.json 的版本已注入到前端常量', () => {
    expect(__APP_VERSION__).toBe(version);
  });

  it('tauri.conf.json 引用 package.json 作为版本来源', () => {
    const config = JSON.parse(read('src-tauri/tauri.conf.json')) as { version: string };
    expect(config.version).toBe('../package.json');
  });

  it('Cargo.toml 与 package.json 版本一致', () => {
    const matched = read('src-tauri/Cargo.toml').match(/\[package\][\s\S]*?\nversion = "([^"]+)"/);
    expect(matched?.[1]).toBe(version);
  });

  it('Cargo.lock 中 llamalite 条目与 package.json 版本一致', () => {
    const matched = read('src-tauri/Cargo.lock').match(/\[\[package\]\]\r?\nname = "llamalite"\r?\nversion = "([^"]+)"/);
    expect(matched?.[1]).toBe(version);
  });

  it.each([
    ['llamalite-manual-zh/llamalite-manual-zh.html', '使用说明书', '版本 ', '版本号：'],
    ['llamalite-manual-en/llamalite-manual-en.html', 'User Manual', 'Version ', 'Version: '],
  ])('%s 中的版本号与 package.json 一致', (path, manualTitle, metaLabel, aboutLabel) => {
    const html = read(path);
    expect(html).toContain(`<div class="version-tag">v${version}</div>`);
    expect(html).toContain(`<span>${manualTitle} v${minorSeries}</span>`);
    expect(html).toContain(`<span>${metaLabel}${version}</span>`);
    expect(html).toContain(`<li>${aboutLabel}${version}</li>`);
    expect(html).toContain(`Llamalite v${version} &mdash;`);
  });

  it.each([
    ['llamalite-manual-zh/llamalite-manual-zh.html', /\d{4} 年 \d{1,2} 月/],
    [
      'llamalite-manual-en/llamalite-manual-en.html',
      /(?:January|February|March|April|May|June|July|August|September|October|November|December) \d{4}/,
    ],
  ])('%s 的封面日期格式有效', (path, pattern) => {
    expect(read(path)).toMatch(new RegExp(`<span>${pattern.source}</span>`));
  });
});
