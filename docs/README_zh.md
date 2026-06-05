<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-them/main/assets/markdown-them-logo.png" width="128" alt="Markdown Them Logo">
</p>

# Markdown Them

从 Web 应用、Electron 桌面应用、VS Code 插件或 Node.js 环境中，将各种文档文件转换为 Markdown (.md) 格式。

- **Web 应用：** 完全在浏览器端运行的客户端文档转换器。直接托管并部署于 GitHub Pages。
- **桌面应用：** 优质的 Electron 应用程序，支持转换本地文件、文件夹和文本输入，且提供自定义输出目录选项。可用于 Windows (Portable)、Linux (.AppImage, .deb) 和 macOS (.dmg)。
- **VS Code 插件：** 集成在资源管理器中的右键上下文菜单，以及面向开发者工作流的 Markdown 双栏实时预览。
- **Node.js 依赖包：** 在您自建的脚本、CLI 命令行以及自动化工具中直接调用相同的转换引擎。

- **支持的格式：** `.docx`, `.pdf`, `.html`, `.xlsx`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf`。
- **并发批量处理：** 同时转换数十个文件，性能极佳。

## Markdown Them 版本

Markdown Them 提供四种版本，以便您可以将其应用到您的工作流中：

| 版本 | 最适用于 | 本地/隐私模型 | 从哪里开始 |
|---|---|---|---|
| **Web 应用** | 免安装的浏览器端文件转换 | 仅限客户端运行；不上传任何文档，无外部网络请求。部署在 GitHub Pages。 | `npm run start:web` |
| **桌面应用** | 基于应用壳的本地文件、文件夹和文本转换 | 在您电脑上运行的 Electron 应用；支持自定义输出目录。为 Windows、Linux 和 macOS 构建安装包。 | `npm run start:desktop` |
| **VS Code 插件** | 资源管理器右键菜单、活动编辑器预览、开发者工作流 | 在您本地机器的 VS Code 中运行 | [VS Code 插件市场](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 或 [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) |
| **Node.js 依赖包** | 脚本、CLI 命令行、自动化和您所控制的服务端工具 | 在您的 Node.js 进程中运行 | [`@the-long-ride/markdown-them`](https://www.npmjs.com/package/@the-long-ride/markdown-them) |

---

## 桌面与 Web 应用

本仓库包含了共享的 React UI 代码，可用于本地运行的 Web 应用以及 Electron 桌面应用。

- **Web 应用：** 仅限客户端端转换。支持多个文件或文本输入，且不将文件发送到服务器。部署至 GitHub Pages。
- **桌面应用：** 带有自定义窗口控制的 Electron 壳。支持文本、单个或多个文件，以及文件夹输入。转换后的文件将写入与原文件同级的目录中。

### 本地运行命令：

```bash
npm run start:web
npm run start:desktop
npm run preview:desktop
```

### 编译命令：

```bash
npm run build:web
npm run build:desktop
npm run build:apps
```

### 桌面包打包工作流：

通过 `electron-builder` 工具打包生成适用于多平台开箱即用的安装包与二进制文件 (Windows Portable `.exe`、Linux `.AppImage`/`.deb`、macOS `.dmg`)：

```bash
# 为 Windows 打包 (便携式 exe)
npm run dist:desktop:win

# 为 Linux 打包 (AppImage & deb)
npm run dist:desktop:linux

# 为 macOS 打包 (dmg)
npm run dist:desktop:mac

# 为全平台打包
npm run dist:desktop:all
```

生成后的安装包将被输出存放在 `dist/installers` 目录中。

---

## VS Code 插件

### 使用方法

#### 1. 批量转换多个文件
1. 在 VS Code 的**资源管理器**侧边栏中，选择一个或多个文件。
2. 右键单击并选择 **Convert to Markdown**。
3. 文件将**并发**转换（直至达到设定的最大限制）。每个文件转换完成后，您将收到通知。

#### 2. 转换活动编辑文件
- 在阅读文档时，按下 `Ctrl+M Ctrl+D`（Mac 上为 `Cmd+M Cmd+D`）。
- 转换后的 Markdown 预览将会在当前编辑器旁边的侧边栏窗口中打开。

#### 3. 修改并发数限制
- 打开命令面板 (`Ctrl+Shift+P`) 并搜索 **Markdown Them: Set Max Concurrent Conversions**。
- 或者，前往 **首选项 > 设置** 并搜索 `Markdown Them`。

> [!NOTE]
> 转换 `.pptx`、`.odt` 和 `.odp` 会提取结构化文本以及主要内容的图片（如果可用，转化为 Base64 Data URI 嵌入）。背景、重复的 Logo 徽标和细微装饰性图标会被自动过滤，以保持 Markdown 的可读性。`.ods` 会将表格提取为 Markdown 表格，`.rtf` 会保留常用的文本样式、标题和列表。

#### 4. 故障排查
如果某个文件转换失败，您可以通过从命令面板中打开 **Developer: Toggle Developer Tools** 并查看 **Console**（控制台）选项卡来查看详细的错误日志和堆栈轨迹。

### 配置项

| 设置项 | 类型 | 默认值 | 范围 | 说明 |
|---|---|---|---|---|
| `markdown-them.maxConcurrentConversions` | `integer` | `6` | `1` – `16` | 在批量执行 "Convert to Markdown" 期间同时转换的最大文件数。 |

您可以通过三种方式更改此设置：

**1. 命令面板** — 执行 `Markdown Them: Set Max Concurrent Conversions` (`Ctrl+Shift+P`)，在交互式输入框中填入新数值。

**2. 设置界面** — 打开**设置** (`Ctrl+,`) 并搜索 `Markdown Them`。

**3. `settings.json`** — 直接添加配置键值对：

```jsonc
{
  // 同时最多转换 4 个文件
  "markdown-them.maxConcurrentConversions": 4
}
```

---

## Node.js 包

自 v1.2.0 起，该转换器也被打包为 Node.js 模块 `@the-long-ride/markdown-them`：

```bash
npm i @the-long-ride/markdown-them
pnpm add @the-long-ride/markdown-them
```

```ts
import { convertFileToMarkdown, generateMarkdown } from "@the-long-ride/markdown-them";

const outputPath = await convertFileToMarkdown("./docs/report.docx");
const markdown = await generateMarkdown("./docs/report.docx");
```

### 本地打包命令：

```bash
npm run pack:vsix
npm run pack:node-package
```

在打包成果物生成后，推送版本标签（tag）可实现自动化发布包至 npm 平台。在推送 `v*` 标签前请配置如下 GitHub Repository 密钥：

```text
NPM_TOKEN
```

---

## 源码目录结构说明

- `src/core`：共享文档转 Markdown 的核心转换逻辑。
- `src/app`：共享的 React UI 代码及仅浏览器端适用的转换适配层。
- `src/electron`：桌面版 Electron 主进程与预加载脚本。
- `src/shared`：共享格式元数据与文件名解析助手方法。
- `src/vscode`：VS Code 扩展命令注册及编辑器集成逻辑。
- `src/nodejs-package`：Node.js 包导出入口。
- `scripts`：项目构建和本地调试启动脚本。
- `nodejs-package`：待发布的 npm 包配置、README 文档、使用许可证以及打包构建后的 `dist`。

---

## 依赖致谢（安全合规）

我们非常注重商业使用的安全合规性与软件授权，因此我们选择了拥有宽松开源或标准许可证的知名依赖包。
特别感谢以下优秀开源库的作者及贡献者：

- [`react`](https://github.com/facebook/react) / [`react-dom`](https://github.com/facebook/react) (MIT 许可证)：构建交互式界面。
- [`gsap`](https://github.com/greensock/GSAP) / [`@gsap/react`](https://github.com/greensock/react) (GreenSock 标准许可证)：实现高品质页面切换动效。
- [`lucide-react`](https://github.com/lucide-icons/lucide) (ISC 许可证)：UI 图标。
- [`mammoth`](https://github.com/mwilliamson/mammoth.js) (BSD-2-Clause 许可证)：高保真转换 `.docx` 格式文档。
- [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) (MIT 许可证)：从 `.pdf` 文件中提取文本。
- [`jszip`](https://github.com/Stuk/jszip) (MIT 或 GPL-3.0 许可证)：解压 zip 压缩文件。
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) (MIT 许可证)：轻量级 Office 文档 XML 解析器。
- [`turndown`](https://github.com/mixmark-io/turndown) (MIT 许可证)：将 HTML 干净地转为 Markdown 语法。
- [`officeparser`](https://github.com/harshankur/officeParser) (MIT 许可证)：用于非标准 Office/OpenDocument 文件的备用文本提取器。

---

## 相关链接与文档
[VS Code 插件市场](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 
| [Open VSX 平台](https://open-vsx.org/extension/the-long-ride/markdown-them) 
| [GitHub 代码仓库](https://github.com/the-long-ride/markdown-them) 
| [更新日志](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md) 
| [贡献指南](https://github.com/the-long-ride/markdown-them/blob/main/GUIDELINE.md)

## 许可证
[MIT (附带主题使用限制)](https://github.com/the-long-ride/markdown-them/blob/main/LICENSE)
