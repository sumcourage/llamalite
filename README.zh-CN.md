# Llamalite

一个跨平台的本地 LLM 推理服务管理桌面应用，基于 [Tauri 2](https://tauri.app/)（React + TypeScript 前端、Rust 后端），由 [llama.cpp](https://github.com/ggerganov/llama.cpp) 的 `llama-server` 驱动。

Llamalite 帮助你从 [ModelScope](https://modelscope.cn) 下载 GGUF 模型、通过图形界面配置并启动 llama-server 实例、实时查看运行日志 —— 全程无需命令行。

> English README: [README.md](./README.md)

## 功能特性

- **仪表盘** — 服务运行状态总览、本地模型数量 / 总大小统计、快捷操作（启动 / 停止 / 重启 / 打开 Web 界面）。
- **服务管理** — 创建、编辑、删除服务配置，可自定义 llama-server 参数（host、端口、上下文长度、GPU 层数等）；支持启动 / 停止 / 重启、实时日志流与自动滚动。
- **模型管理** — 浏览本地已下载的 GGUF 模型；从 ModelScope 下载模型（带进度跟踪与取消）；搜索模型库；查看并单独下载仓库中的某个 GGUF 文件。
- **硬件信息与推荐** — 通过 `sysinfo` 读取硬件信息（CPU / 内存 / GPU），并根据显存给出模型规格推荐。
- **环境检查** — 检测 `llama-server`、Python、`modelscope` 包是否就绪，并给出分步安装指引。

## 技术栈

| 层次      | 技术                                                                        |
| --------- | --------------------------------------------------------------------------- |
| 前端      | React 18、TypeScript、Vite 6、Ant Design 5、Zustand、TanStack React Query、React Router |
| 桌面壳    | Tauri 2（插件：shell、dialog、fs）                                          |
| 后端      | Rust（tokio、sysinfo、serde、uuid、chrono）                                 |
| 模型/SDK  | llama.cpp `llama-server`、ModelScope Hub API（通过内置 Python 脚本调用）    |
| 测试      | Vitest + Testing Library（前端）、pytest（Python 脚本）                     |

## 架构

采用标准 Tauri 项目布局：

```
llamalite/
├── src/                  # React 前端
│   ├── pages/            # 仪表盘、服务、模型、设置
│   ├── components/       # 通用组件（Sidebar、StatusBadge、ConfirmDialog 等）
│   ├── stores/           # Zustand 状态（服务、模型）
│   ├── hooks/            # useServiceManager、useModelDownload 等
│   ├── layouts/          # MainLayout（侧边栏 + 内容区）
│   ├── types/            # 共享 TypeScript 类型
│   └── __tests__/        # 前端单元测试
├── src-tauri/            # Rust 后端（Tauri）
│   ├── src/
│   │   ├── commands/     # #[tauri::command] 处理器（service、model、settings、environment、hardware、python）
│   │   ├── models/       # 序列化结构体（service、model、settings、hardware）
│   │   ├── sidecar/      # llama-server 进程管理器（启停 / 日志流）
│   │   └── storage/      # JSON 文件持久化（服务 / 模型 / 设置 / 目录缓存）
│   └── python/           # ModelScope 辅助脚本（搜索、下载、列文件、清理）
├── llamalite-manual-zh/  # 中文用户手册
├── llamalite-manual-en/  # 英文用户手册
└── package.json
```

核心数据流：

- **服务生命周期** — Rust 端 `ServiceManager`（`src-tauri/src/sidecar/manager.rs`）以子进程方式拉起 `llama-server`，跟踪其 PID / 端口 / 运行时长，并通过 Tauri 事件把 stdout/stderr 日志推送给前端。
- **模型下载** — 前端调用 Rust 命令，Rust 再执行 `python/download_model.py`，以 JSON 行流式回传下载进度；取消下载时通过 `cleanup_cache.py` 清理 ModelScope 缓存。
- **持久化** — 服务、模型、设置均以 JSON 文件保存在应用配置目录下（`src-tauri/src/storage/`）。

## 环境要求

- [Node.js](https://nodejs.org/) 18+ 与 npm
- [Rust](https://www.rust-lang.org/tools/install) 稳定版工具链
- [llama.cpp](https://github.com/ggerganov/llama.cpp) 的 `llama-server` 可执行文件（自动从 PATH 检测，或在设置中手动指定）
- Python 3 与 `modelscope` 包（`pip install modelscope`），用于模型下载与搜索

## 快速开始

```bash
npm install

# 启动 Tauri 开发应用（同时启动 Vite 开发服务器与 Rust 应用）
npm run tauri dev

# 仅以浏览器方式运行前端
npm run dev
```

## 构建

```bash
npm run build          # 类型检查 + 构建前端
npm run tauri build    # 构建生产安装包
```

## 测试

```bash
npm run test           # 运行 Vitest 前端测试（单次）
npm run test:watch     # 监听模式
npm run test:coverage  # 覆盖率报告
```

Python 辅助脚本在 `src-tauri/python/tests` 下有独立测试（使用 `pytest` 运行）。

## 用户手册

- 中文用户手册：[llamalite-manual-zh/llamalite-manual-zh.html](llamalite-manual-zh/llamalite-manual-zh.html)
- 英文用户手册：[llamalite-manual-en/llamalite-manual-en.html](llamalite-manual-en/llamalite-manual-en.html)

## 许可证

© 2026 sumcourage. 保留所有权利。
