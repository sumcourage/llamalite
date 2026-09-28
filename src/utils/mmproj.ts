import type { LocalModel } from '../types';

/** 比较模型路径时忽略大小写与路径分隔符差异（Windows 反斜杠 vs 正斜杠）。 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase();
}

/**
 * 查找本地模型自带的多模态投影器（mmproj）。
 *
 * 视觉模型（OCR、图片理解）必须带上 --mmproj 才能接收图片输入；
 * 文本模型没有配套投影器，返回 undefined。
 */
export function findMmprojForModel(
  models: LocalModel[],
  modelPath: string,
): string | undefined {
  if (!modelPath) return undefined;
  const target = normalizePath(modelPath);
  return models.find((m) => normalizePath(m.path) === target)?.mmprojPath || undefined;
}
