<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-them/main/assets/markdown-them-logo.png" width="128" alt="Markdown Them Logo">
</p>

# Markdown Them

Webアプリケーション、Electronデスクトップアプリ、VS Code拡張機能、またはNode.jsパッケージから、様々なドキュメントファイルをMarkdown (.md) に変換します。

- **Web アプリ:** ブラウザ内のみで完全に動作するクライアントサイド専用のファイルコンバーター。GitHub Pagesにて直接ホスト・配信されます。
- **デスクトップアプリ:** ローカルファイル、フォルダ、およびテキスト入力に対応し、カスタム出力フォルダ選択が可能な高品質Electronデスクトップアプリケーション。Windows（Portable）、Linux（.AppImage, .deb）、macOS（.dmg）に対応。
- **VS Code 拡張機能:** エクスプローラーの右クリックコンテキストメニューや、エディターでのサイドバイサイドMarkdownプレビューといった開発者向けワークフローを統合。
- **Node.js パッケージ:** 自作のスクリプト、CLI、自動化ツールに、同一の変換エンジンを統合。

- **サポートされているフォーマット:** `.docx`, `.pdf`, `.html`, `.xlsx`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf`
- **同時一括処理:** 最適化されたパフォーマンスで、同時に数十個のファイルを一括変換できます。

## Markdown Them のバリアント

Markdown Themは、あなたのワークフローに合わせて使えるよう4つのバリアントを用意しています：

| バリアント | 最適な用途 | ローカル/プライバシーモデル | 開始方法 |
|---|---|---|---|
| **Web アプリ** | インストール不要のブラウザベース変換 | クライアントサイドのみで動作。サーバーへのファイル送信や外部への変換リクエストなし。GitHub Pagesで配信。 | `npm run start:web` |
| **デスクトップアプリ** | ローカルファイル、フォルダ、およびテキストの変換 | コンピュータ上で実行されるElectronアプリ。出力先フォルダの選択をサポート。Windows, Linux, macOS向けのインストーラーを構築可能。 | `npm run start:desktop` |
| **VS Code 拡張機能** | エクスプローラーの右クリックメニュー、アクティブエディタのプレビュー、開発者向けワークフロー | ローカルPC上のVS Code内で動作 | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) または [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) |
| **Node.js パッケージ** | スクリプト、CLI、自動化ツール、サーバーサイドツールなど、自ら制御する仕組み | Node.jsのプロセス内で動作 | [`@the-long-ride/markdown-them`](https://www.npmjs.com/package/@the-long-ride/markdown-them) |

---

## デスクトップ＆Webアプリ

本リポジトリには、ローカルWebアプリおよびElectronデスクトップアプリ向けの共有React UIコードも含まれています。

- **Web アプリ:** クライアントサイドのみで動作します。複数のファイルやテキスト入力を受け付け、サーバーにファイルを送信することはありません。GitHub Pagesにデプロイされます。
- **デスクトップアプリ:** カスタムウィンドウ操作に対応するElectronシェル。テキスト、単一または複数のファイル、フォルダ入力を受け付けます。変換後のファイルは、元ファイルと同一階層に自動保存されます。

### ローカル開発起動コマンド：

```bash
npm run start:web
npm run start:desktop
npm run preview:desktop
```

### ビルドコマンド：

```bash
npm run build:web
npm run build:desktop
npm run build:apps
```

### デスクトップアプリ構築パイプライン：

`electron-builder` を利用して、本番運用に対応したインストーラーや実行ファイル（Windows Portable `.exe`、Linux `.AppImage`/`.deb`、macOS `.dmg`）をビルドできます：

```bash
# Windows向けビルd (ポータブル形式 exe)
npm run dist:desktop:win

# Linux向けビルド (AppImage & deb)
npm run dist:desktop:linux

# macOS向けビルド (dmg)
npm run dist:desktop:mac

# 全プラットフォーム向けビルド
npm run dist:desktop:all
```

ビルドされた成果物は `dist/installers` ディレクトリに出力されます。

---

## VS Code 拡張機能

### 使用方法

#### 1. 複数ファイルの一括変換（バッチ）
1. VS Codeの**エクスプローラー**サイドバーで、1つまたは複数のファイルを選択します。
2. 右クリックして **Convert to Markdown** を選択します。
3. 設定された最大上限値まで、ファイルが**同時並行**で変換されます。変換が完了するたびに通知が表示されます。

#### 2. アクティブファイルを変換
- ドキュメントを表示中に、`Ctrl+M Ctrl+D`（Macの場合は `Cmd+M Ctrl+D`）を押します。
- 現在のエディタの隣にMarkdownプレビューのペインが新しく開きます。

#### 3. 同時変換上限値의 変更
- コマンドパレット (`Ctrl+Shift+P`) を開き、**Markdown Them: Set Max Concurrent Conversions** を検索します。
- または、**ファイル > ユーザー設定 > 設定** を開き、`Markdown Them` を検索します。

> [!NOTE]
> `.pptx`、`.odt`、および `.odp` の変換は、構造化テキストとコンテンツ内の主要な画像をインラインBase64 Data URIとして抽出します。読みやすいMarkdown出力を保つため、背景画像や繰り返しのロゴ、小さな装飾用アイコンはフィルタリングされます。`.ods` はシートをMarkdownテーブルとして抽出し、`.rtf` は一般的なテキスト装飾、見出し、箇条書きリストを保持します。

#### 4. トラブルシューティング
ファイルの変換に失敗した場合は、コマンドパレットから **Developer: Toggle Developer Tools** コマンドを開き、**Console**（コンソール）タブで詳細なエラーログとスタックトレースを確認できます。

### 設定項目

| 設定キー | 型 | デフォルト値 | 範囲 | 説明 |
|---|---|---|---|---|
| `markdown-them.maxConcurrentConversions` | `integer` | `6` | `1` – `16` | 一括変換 "Convert to Markdown" の実行中に同時に変換するファイルの最大数。 |

この設定は、次の3つの方法で変更できます：

**1. コマンドパレット** — `Markdown Them: Set Max Concurrent Conversions` (`Ctrl+Shift+P`) を実行し、入力ボックスに直接数値を入力します。

**2. 設定UI** — **設定** (`Ctrl+,`) を開き、`Markdown Them` を検索します。

**3. `settings.json`** — 次のように設定キーを追加します：

```jsonc
{
  // 同時に最大4つのファイルを並行して変換する
  "markdown-them.maxConcurrentConversions": 4
}
```

---

## Node.js パッケージ

v1.2.0以降、共有のコンバーターはNode.js向けパッケージ `@the-long-ride/markdown-them` としても配布されています：

```bash
npm i @the-long-ride/markdown-them
pnpm add @the-long-ride/markdown-them
```

```ts
import { convertFileToMarkdown, generateMarkdown } from "@the-long-ride/markdown-them";

const outputPath = await convertFileToMarkdown("./docs/report.docx");
const markdown = await generateMarkdown("./docs/report.docx");
```

### ローカルビルドコマンド：

```bash
npm run pack:vsix
npm run pack:node-package
```

リリース用タグをプッシュすると、生成されたビルド成果物が自動的にnpmへパブリッシュされます。タグ `v*` をプッシュする前に、GitHubリポジトリのシークレットに以下を設定してください：

```text
NPM_TOKEN
```

---

## ソースのディレクトリ構成

- `src/core`: 共有ドキュメント変換処理のコアロジック。
- `src/app`: 共有React UIおよびブラウザ用変換アダプター。
- `src/electron`: デスクトップアプリ用Electronメインプロセス・プリロードスクリプト。
- `src/shared`: 共有フォーマットメタデータとファイル名変換のユーティリティ。
- `src/vscode`: VS Codeのコマンド登録、およびエディターとの連携。
- `src/nodejs-package`: Node.jsパッケージの公開エントリーポイント。
- `scripts`: アプリのビルド、およびローカル起動スクリプト。
- `nodejs-package`: 配布用npmパッケージ設定、README、ライセンス、およびビルドされた `dist`。

---

## 使用しているライブラリとライセンス（安全性の確認）

商用利用のためのセキュリティとライセンス遵守を重視し、許諾範囲の広いオープンソースまたは標準ライセンスを持つ著名なパッケージを選択しています。
このプロジェクトを支える優れたライブラリの作者およびコントリビューターの皆様に深く感謝いたします：

- [`react`](https://github.com/facebook/react) / [`react-dom`](https://github.com/facebook/react) (MIT ライセンス): インタラクティブな画面構造の構築。
- [`gsap`](https://github.com/greensock/GSAP) / [`@gsap/react`](https://github.com/greensock/react) (GreenSock 標準ライセンス): プレミアムな画面切り替えアニメーションの実装。
- [`lucide-react`](https://github.com/lucide-icons/lucide) (ISC ライセンス): UI用の高品質アイコン。
- [`mammoth`](https://github.com/mwilliamson/mammoth.js) (BSD-2-Clause ライセンス): `.docx` ファイルの堅牢な変換。
- [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) (MIT ライセンス): `.pdf` ファイルからの確実なテキスト抽出。
- [`jszip`](https://github.com/Stuk/jszip) (MIT または GPL-3.0 ライセンス): zipファイルの展開。
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) (MIT ライセンス): Officeドキュメント解析用の軽量XMLパーサー。
- [`turndown`](https://github.com/mixmark-io/turndown) (MIT ライセンス): HTMLコンテンツを綺麗なMarkdownに変換。
- [`officeparser`](https://github.com/harshankur/officeParser) (MIT ライセンス): 標準外のOffice/OpenDocumentファイル用の予備テキスト抽出器。

---

## クレジット＆関連リンク
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 
| [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) 
| [GitHub リポジトリ](https://github.com/the-long-ride/markdown-them) 
| [変更履歴](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md) 
| [貢献ガイドライン](https://github.com/the-long-ride/markdown-them/blob/main/GUIDELINE.md)

## ライセンス
[MIT (テーマ使用制限条項付き)](https://github.com/the-long-ride/markdown-them/blob/main/LICENSE)
