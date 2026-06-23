<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-them/main/assets/markdown-them-logo.png" width="128" alt="Markdown Them Logo">
</p>

# Markdown Them

웹 애플리케이션, Electron 데스크톱 앱, VS Code 확장 프로그램 또는 Node.js 패키지 환경에서 다양한 문서 파일을 Markdown (.md) 형식으로 변환합니다.

- **웹 앱:** 브라우저 내에서 100% 클라이언트 사이드로만 동작하는 웹 변환기. GitHub Pages를 통해 직접 호스팅 및 배포됩니다.
- **데스크톱 앱:** 로컬 파일, 폴더 및 텍스트 입력을 지원하고 맞춤형 출력 경로를 설정할 수 있는 고급 Electron 데스크톱 애플리케이션. Windows (Portable), Linux (.AppImage, .deb), macOS (.dmg) 설치 파일을 제공합니다.
- **VS Code 확장 프로그램:** 파일 탐색기 우클릭 메뉴 연동 및 개발 프로세스에 유용한 에디터 내 좌우 Markdown 실시간 미리보기 기능을 제공합니다.
- **Node.js 패키지:** 사용자가 직접 작성하는 스크립트, CLI 도구 또는 자동화 워크플로우에 동일한 변환 엔진을 모듈로 직접 탑재할 수 있습니다.

- **지원 형식:** `.docx`, `.doc`, `.pdf`, `.html`, `.xlsx`, `.xls`, `.xlm`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf` (참고: 레거시 형식 `.doc`, `.xls`, `.xlm`은 이름 변경 에뮬레이션을 사용하므로 가끔 올바르게 변환되지 않을 수 있습니다.)
- **동시 일괄 처리:** 최적화된 성능으로 수십 개의 파일을 한 번에 동시 변환합니다.

## Markdown Them 에디션 종류

Markdown Them은 사용자의 작업 흐름에 맞게 선택할 수 있도록 네 가지 버전으로 제공됩니다:

| 에디션 종류 | 가장 적합한 환경 | 로컬/개인정보 보호 모델 | 시작 방법 |
|---|---|---|---|
| **웹 앱** | 설치가 필요 없는 브라우저 기반의 간편 변환 | 클라이언트 사이드 단독 실행; 서버 파일 업로드 및 외부 네트워크 요청 없음. GitHub Pages에 배포. | `npm run start:web` |
| **데스크톱 앱** | 앱 셸을 이용한 로컬 파일, 폴더 및 텍스트 변환 | 컴퓨터에서 실행되는 Electron 앱; 출력 대상 폴더 지정 지원. Windows, Linux, macOS용 빌드 제공. | `npm run start:desktop` |
| **VS Code 확장 프로그램** | 탐색기 우클릭 메뉴, 에디터 미리보기, 개발자 워크플로우 | 컴퓨터 내 VS Code 내부에서 로컬로 실행 | [VS Code 마켓플레이스](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 또는 [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) |
| **Node.js 패키지** | 스크립트, CLI, 자동화 및 직접 제어하는 서버 측 도구 빌드 | 사용자 Node.js 프로세스 내에서 직접 실행 | [`@the-long-ride/markdown-them`](https://www.npmjs.com/package/@the-long-ride/markdown-them) |

---

## 데스크톱 및 웹 앱

본 리포지토리에는 로컬 웹 앱과 Electron 데스크톱 앱을 위한 공통 React UI 코드가 포함되어 있습니다.

- **웹 앱:** 클라이언트 사이드 변환 단독 실행. 여러 파일 또는 텍스트 입력을 지원하며, 파일을 서버로 전송하지 않습니다. GitHub Pages에 직접 배포됩니다.
- **데스크톱 앱:** 맞춤형 윈도우 프레임을 지닌 Electron 기반 앱. 텍스트, 단일/다중 파일 및 전체 폴더 입력을 지원합니다. 변환 파일은 원본 파일과 같은 위치에 생성됩니다.

![온라인 웹 앱](../media/demo-pics/Markdown-them-Online-web-app.png)
![데스크톱 앱](../media/demo-pics/Markdown-them-Desktop-app.png)

### 로컬 실행 명령:

```bash
npm run start:web
npm run start:desktop
npm run preview:desktop
```

### 빌드 명령:

```bash
npm run build:web
npm run build:desktop
npm run build:apps
```

### 데스크톱 앱 배포 패키징:

`electron-builder`를 사용하여 배포용 단일 실행 파일 및 배포판(Windows Portable `.exe`, Linux `.AppImage`/`.deb`, macOS `.dmg`)을 빌드할 수 있습니다:

```bash
# Windows용 빌드 (무설치 포터블 exe)
npm run dist:desktop:win

# Linux용 빌드 (AppImage & deb)
npm run dist:desktop:linux

# macOS용 빌드 (dmg)
npm run dist:desktop:mac

# 전 플랫폼 통합 빌드
npm run dist:desktop:all
```

빌드된 설치 실행 파일들은 `dist/installers` 폴더 안에 위치하게 됩니다.

---

## VS Code 확장 프로그램

### 사용 방법

#### 1. 여러 파일 일괄 변환 (Batch)
1. VS Code **탐색기** 사이드바에서 하나 이상의 파일을 선택합니다.
2. 마우스 오른쪽 버튼을 클릭하고 **Convert to Markdown**을 선택합니다.
3. 설정된 최대 제한 개수까지 파일이 **동시** 변환됩니다. 각 파일이 완료될 때마다 알림을 받게 됩니다.

#### 2. 현재 열려있는 파일 변환
- 문서를 보고 있는 동안 `Ctrl+M Ctrl+D` (Mac의 경우 `Cmd+M Ctrl+D`)를 누릅니다.
- 현재 실행 중인 에디터 오른쪽에 새로운 창으로 Markdown 미리보기가 열립니다.

#### 3. 동시 변환 제한 수 설정 변경
- 명령 팔레트(`Ctrl+Shift+P`)를 열고 **Markdown Them: Set Max Concurrent Conversions**를 검색합니다.
- 또는 **기본 설정 > 설정**으로 이동하여 `Markdown Them`을 검색합니다.

> [!NOTE]
> `.pptx`, `.odt`, `.odp` 변환은 구조화된 텍스트와 본문 내의 핵심 이미지를 인라인 Base64 Data URI 형태로 추출합니다. 가독성을 유지하기 위해 배경 이미지, 반복되는 로고, 미세한 장식용 아이콘 등은 자동으로 필터링됩니다. `.ods`는 시트를 Markdown 표 형식으로 변환하며, `.rtf`는 일반 텍스트 스타일, 제목 및 글머리 기호를 보존합니다.

#### 4. 문제 해결
파일 변환에 실패하는 경우, 명령 팔레트에서 **Developer: Toggle Developer Tools**를 실행한 후 **Console** 탭을 열어 상세한 오류 로그와 스택 추적을 확인할 수 있습니다.

### 설정 구성

| 설정 키 | 데이터 타입 | 기본값 | 범위 | 설명 |
|---|---|---|---|---|
| `markdown-them.maxConcurrentConversions` | `integer` | `6` | `1` – `16` | 일괄 변환("Convert to Markdown") 진행 시 동시에 변환할 최대 파일 개수. |

설정은 다음 세 가지 방법으로 조절할 수 있습니다:

**1. 명령 팔레트** — `Markdown Them: Set Max Concurrent Conversions` (`Ctrl+Shift+P`)를 실행하여 입력란에 원하는 숫자를 입력합니다.

**2. 설정 UI** — **설정** (`Ctrl+,`)을 열고 `Markdown Them`을 검색합니다.

**3. `settings.json`** — 설정 파일에 직접 키를 추가합니다:

```jsonc
{
  // 동시에 최대 4개 파일 변환
  "markdown-them.maxConcurrentConversions": 4
}
```

---

## Node.js 패키지

v1.2.0 버전부터 공유 변환 엔진이 Node.js 사용자를 위해 `@the-long-ride/markdown-them` 패키지로 배포됩니다:

```bash
npm i @the-long-ride/markdown-them
pnpm add @the-long-ride/markdown-them
```

```ts
import { convertFileToMarkdown, generateMarkdown } from "@the-long-ride/markdown-them";

const outputPath = await convertFileToMarkdown("./docs/report.docx");
const markdown = await generateMarkdown("./docs/report.docx");
```

### 로컬 빌드 명령:

```bash
npm run pack:vsix
npm run pack:node-package
```

릴리즈용 태그를 푸시하면 패키지 아티팩트가 생성된 후 npm에 자동 배포됩니다. `v*` 태그를 푸시하기 전 GitHub 리포지토리 시크릿을 반드시 설정하세요:

```text
NPM_TOKEN
```

---

## 소스 디렉토리 구조

- `src/core`: 공통 파일 변환 엔진의 코어 로직 소스.
- `src/app`: 공통 React UI 및 웹 브라우저용 변환 어댑터.
- `src/electron`: 데스크톱 앱용 Electron 메인 프로세스 및 사전 로드 스크립트.
- `src/shared`: 공통 포맷 메타데이터 정보 및 파일명 헬퍼.
- `src/vscode`: VS Code 명령 등록 및 에디터 연동 통합부.
- `src/nodejs-package`: Node.js 라이브러리 발행용 진입부.
- `scripts`: 앱 빌드 및 로컬 테스트 구동용 스크립트.
- `nodejs-package`: 발행용 npm 패키지 메타데이터 정보, README, 라이선스 문서 및 빌드 결과 `dist`.

---

## 오픈소스 라이브러리 사용 및 라이선스 (보안 규정 준수)

상업적 목적의 보안과 저작권 라이선스 준수를 중요시하여, 허용 범위가 넓은 오픈소스 및 표준 라이선스를 지닌 저명한 패키지들을 선별해 구축했습니다.
도움을 준 훌륭한 오픈소스 라이브러리 개발자 및 기여자 분들께 감사의 인사를 전합니다:

- [`react`](https://github.com/facebook/react) / [`react-dom`](https://github.com/facebook/react) (MIT 라이선스): 인터랙티브 UI 컴포넌트 구성.
- [`gsap`](https://github.com/greensock/GSAP) / [`@gsap/react`](https://github.com/greensock/react) (GreenSock 표준 라이선스): 페이지 간 유려한 화면 전환 애니메이션.
- [`lucide-react`](https://github.com/lucide-icons/lucide) (ISC 라이선스): 화면 UI 아이콘 세트.
- [`mammoth`](https://github.com/mwilliamson/mammoth.js) (BSD-2-Clause 라이선스): 워드 문서의 안정적인 변환.
- [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) (MIT 라이선스): PDF 파일로부터 텍스트 데이터 추출.
- [`jszip`](https://github.com/Stuk/jszip) (MIT 또는 GPL-3.0 라이선스): 압축 파일 해제.
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) (MIT 라이선스): 오피스 문서를 구성하는 가벼운 XML 분석기.
- [`turndown`](https://github.com/mixmark-io/turndown) (MIT 라이선스): HTML 구조 데이터를 깔끔한 Markdown 문법으로 변환.
- [`officeparser`](https://github.com/harshankur/officeParser) (MIT 라이선스): 오피스/OpenDocument 양식 파일 변환용 서브 텍스트 추출 엔진.

---

## 링크 및 참고 문서
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 
| [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) 
| [GitHub 저장소](https://github.com/the-long-ride/markdown-them) 
| [변경 이력](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md) 
| [기여 지침](https://github.com/the-long-ride/markdown-them/blob/main/GUIDELINE.md)

## 저작권 라이선스
[MIT (테마 사용 제한 조항 포함)](https://github.com/the-long-ride/markdown-them/blob/main/LICENSE)
