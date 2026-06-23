<p align="center">
  <img src="https://raw.githubusercontent.com/the-long-ride/markdown-them/main/assets/markdown-them-logo.png" width="128" alt="Markdown Them Logo">
</p>

# Markdown Them

Chuyển đổi các tệp tài liệu khác nhau sang định dạng Markdown (.md) thông qua ứng dụng web, ứng dụng máy tính Electron, extension VS Code hoặc thư viện Node.js.

- **Web App:** Bộ chuyển đổi tài liệu chạy hoàn toàn ở phía client trên trình duyệt của bạn. Được lưu trữ và triển khai trực tiếp trên GitHub Pages.
- **Desktop App:** Ứng dụng Electron cao cấp để chuyển đổi các tệp, thư mục và văn bản cục bộ với tùy chọn thư mục đầu ra tùy chỉnh. Hỗ trợ cho Windows (Portable), Linux (.AppImage, .deb), và macOS (.dmg).
- **VS Code Extension:** Tích hợp menu ngữ cảnh chuột phải trong explorer và xem trước Markdown song song dành cho quy trình làm việc của lập trình viên.
- **Node.js Package:** Sử dụng trực tiếp bộ chuyển đổi dùng chung này trong các kịch bản lệnh, CLI hoặc tự động hóa của bạn.

- **Định dạng hỗ trợ:** `.docx`, `.doc`, `.pdf`, `.html`, `.xlsx`, `.xls`, `.xlm`, `.pptx`, `.odt`, `.odp`, `.ods`, `.rtf` (Lưu ý: Các định dạng cũ `.doc`, `.xls`, `.xlm` sử dụng giả lập đổi tên và đôi khi hoạt động không chính xác).
- **Xử lý hàng loạt đồng thời:** Chuyển đổi hàng chục tệp cùng lúc với hiệu suất tối ưu.

## Các Biến Thể Markdown Them

Markdown Them có sẵn bốn biến thể để bạn có thể sử dụng ở bất kỳ đâu phù hợp với quy trình làm việc của mình:

| Biến thể | Thích hợp cho | Mô hình cục bộ / bảo mật | Bắt đầu từ đâu |
|---|---|---|---|
| **Web app** | Chuyển đổi trực tiếp trên trình duyệt mà không cần cài đặt | Chỉ chạy ở phía client; không tải tệp lên máy chủ hay thực hiện yêu cầu chuyển đổi ra ngoài. Được triển khai trên GitHub Pages. | `npm run start:web` |
| **Desktop app** | Chuyển đổi tệp, thư mục và văn bản cục bộ bằng ứng dụng máy tính | Ứng dụng Electron chạy trên máy tính của bạn; hỗ trợ chọn thư mục đầu ra tùy chọn. Bản cài đặt được dựng sẵn cho Windows, Linux, và macOS. | `npm run start:desktop` |
| **VS Code extension** | Menu ngữ cảnh Explorer, xem trước trình biên tập, quy trình phát triển | Chạy cục bộ trên máy tính của bạn thông qua VS Code | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) hoặc [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) |
| **Node.js package** | Kịch bản lệnh (scripts), CLI, tự động hóa và công cụ phía máy chủ do bạn kiểm soát | Chạy trực tiếp trong tiến trình Node.js của bạn | [`@the-long-ride/markdown-them`](https://www.npmjs.com/package/@the-long-ride/markdown-them) |

---

## Ứng dụng Máy tính & Web

Kho lưu trữ này bao gồm giao diện React dùng chung cho ứng dụng web chạy cục bộ và ứng dụng máy tính Electron.

- **Web app:** Chuyển đổi tài liệu chỉ ở phía client. Chấp nhận nhiều tệp hoặc văn bản đầu vào và không tải tệp lên máy chủ. Được triển khai trên GitHub Pages.
- **Desktop app:** Giao diện Electron với tùy chọn tùy chỉnh cửa sổ. Chấp nhận văn bản, tệp hoặc thư mục đầu vào. Tài liệu được chuyển đổi sẽ tự động lưu kế bên tệp gốc.

![Ứng dụng Web](../media/demo-pics/Markdown-them-Online-web-app.png)
![Ứng dụng Máy tính](../media/demo-pics/Markdown-them-Desktop-app.png)


### Lệnh chạy ứng dụng cục bộ:

```bash
npm run start:web
npm run start:desktop
npm run preview:desktop
```

### Lệnh biên dịch:

```bash
npm run build:web
npm run build:desktop
npm run build:apps
```

### Quy trình Đóng gói Ứng dụng Máy tính:

Tạo bản cài đặt sẵn sàng sử dụng (Windows Portable `.exe`, Linux `.AppImage`/`.deb`, macOS `.dmg`) thông qua công cụ `electron-builder`:

```bash
# Đóng gói cho Windows (Portable exe)
npm run dist:desktop:win

# Đóng gói cho Linux (AppImage & deb)
npm run dist:desktop:linux

# Đóng gói cho macOS (dmg)
npm run dist:desktop:mac

# Đóng gói cho tất cả nền tảng
npm run dist:desktop:all
```

Các tệp cài đặt sau khi hoàn tất sẽ được đặt trong thư mục `dist/installers`.

---

## Extension VS Code

### Cách sử dụng

#### 1. Chuyển đổi nhiều tệp (Hàng loạt)
1. Trong thanh **Explorer** của VS Code, chọn một hoặc nhiều tệp.
2. Nhấp chuột phải và chọn **Convert to Markdown**.
3. Các tệp sẽ được chuyển đổi **đồng thời** (tối đa theo giới hạn được cấu hình). Bạn sẽ nhận được thông báo khi mỗi tệp hoàn thành.

#### 2. Chuyển đổi tệp đang mở
- Khi đang xem một tài liệu, nhấn `Ctrl+M Ctrl+D` (hoặc `Cmd+M Ctrl+D` trên Mac).
- Một bảng xem trước markdown sẽ mở ra ngay bên cạnh trình soạn thảo hiện tại của bạn.

#### 3. Thay đổi giới hạn xử lý đồng thời
- Sử dụng bảng lệnh Command Palette (`Ctrl+Shift+P`) và tìm kiếm **Markdown Them: Set Max Concurrent Conversions**.
- Or, go to **File > Preferences > Settings** và tìm kiếm `Markdown Them`.

> [!NOTE]
> Việc chuyển đổi `.pptx`, `.odt` và `.odp` sẽ trích xuất văn bản có cấu trúc và các hình ảnh nội dung chính dưới dạng dữ liệu inline Base64 URI khi có sẵn. Các hình nền, logo lặp đi lặp lại và các icon trang trí nhỏ sẽ bị lọc bỏ để giữ cho Markdown dễ đọc hơn. `.ods` trích xuất các trang tính thành bảng Markdown, và `.rtf` giữ lại các kiểu định dạng văn bản thông thường, tiêu đề và danh sách.

#### 4. Khắc phục sự cố
Nếu một tệp không thể chuyển đổi, bạn có thể xem nhật ký lỗi chi tiết bằng cách mở lệnh **Developer: Toggle Developer Tools** (từ bảng lệnh Command Palette) và kiểm tra tab **Console**.

### Cấu hình

| Cài đặt | Kiểu | Mặc định | Phạm vi | Mô tả |
|---|---|---|---|---|
| `markdown-them.maxConcurrentConversions` | `integer` | `6` | `1` – `16` | Số lượng tệp tối đa được chuyển đổi đồng thời trong quá trình xử lý hàng loạt "Convert to Markdown". |

Bạn có thể thay đổi cài đặt này theo ba cách:

**1. Command Palette** — Chạy `Markdown Them: Set Max Concurrent Conversions` (`Ctrl+Shift+P`) để nhập giá trị mới vào ô nhập liệu.

**2. Settings UI** — Mở **Settings** (`Ctrl+,`) và tìm kiếm `Markdown Them`.

**3. `settings.json`** — Thêm cấu hình trực tiếp:

```jsonc
{
  // Chuyển đổi tối đa 4 tệp cùng một lúc
  "markdown-them.maxConcurrentConversions": 4
}
```

---

## Gói Node.js

Bắt đầu từ phiên bản v1.2.0, bộ chuyển đổi dùng chung được đóng gói cho các nhà phát triển Node.js dưới tên thư viện `@the-long-ride/markdown-them`:

```bash
npm i @the-long-ride/markdown-them
pnpm add @the-long-ride/markdown-them
```

```ts
import { convertFileToMarkdown, generateMarkdown } from "@the-long-ride/markdown-them";

const outputPath = await convertFileToMarkdown("./docs/report.docx");
const markdown = await generateMarkdown("./docs/report.docx");
```

### Lệnh đóng gói cục bộ:

```bash
npm run pack:vsix
npm run pack:node-package
```

Thực hiện đẩy thẻ (tags) phát hành để tự động xuất bản thư viện lên npm. Cấu hình khóa bí mật của kho lưu trữ GitHub trước khi đẩy thẻ `v*`:

```text
NPM_TOKEN
```

---

## Cấu Trúc Thư Mục Nguồn

- `src/core`: Thư mục chứa logic lõi chuyển đổi tài liệu sang Markdown.
- `src/app`: Giao diện React dùng chung và adapter chuyển đổi dành riêng cho trình duyệt.
- `src/electron`: Tiến trình chính và tiền tải của Electron dành cho ứng dụng máy tính.
- `src/shared`: Chứa metadata định dạng tệp dùng chung và các hàm bổ trợ liên quan.
- `src/vscode`: Nơi đăng ký lệnh của VS Code và tích hợp trình soạn thảo.
- `src/nodejs-package`: Điểm khởi chạy của gói thư viện Node.js.
- `scripts`: Các kịch bản lệnh biên dịch và khởi chạy cục bộ.
- `nodejs-package`: Cấu hình metadata, tài liệu hướng dẫn, giấy phép sử dụng của npm package và thư mục `dist` đầu ra.

---

## Được Hỗ Trợ Bởi các Thư Viện An Toàn

Tôi quan tâm đến bảo mật và giấy phép sử dụng cho mục đích thương mại, vì vậy tôi đã chọn các gói thư viện phổ biến có giấy phép nguồn mở hoặc giấy phép tiêu chuẩn rõ ràng.
Cảm ơn các tác giả và nhà đóng góp của những thư viện tuyệt vời này:

- [`react`](https://github.com/facebook/react) / [`react-dom`](https://github.com/facebook/react) (Giấy phép MIT): Cấu trúc giao diện tương tác.
- [`gsap`](https://github.com/greensock/GSAP) / [`@gsap/react`](https://github.com/greensock/react) (Giấy phép Tiêu chuẩn GreenSock): Hiệu ứng chuyển trang cao cấp.
- [`lucide-react`](https://github.com/lucide-icons/lucide) (Giấy phép ISC): Biểu tượng giao diện đẹp mắt.
- [`mammoth`](https://github.com/mwilliamson/mammoth.js) (Giấy phép BSD-2-Clause): Chuyển đổi tệp `.docx` mạnh mẽ.
- [`@opendocsg/pdf2md`](https://github.com/opendocsg/pdf2md) (Giấy phép MIT): Trích xuất văn bản từ tệp `.pdf`.
- [`jszip`](https://github.com/Stuk/jszip) (Giấy phép MIT hoặc GPL-3.0): Giải nén tệp zip.
- [`fast-xml-parser`](https://github.com/NaturalIntelligence/fast-xml-parser) (Giấy phép MIT): Phân tích cú pháp XML cho các tài liệu Office.
- [`turndown`](https://github.com/mixmark-io/turndown) (Giấy phép MIT): Chuyển đổi định dạng HTML sang Markdown sạch sẽ.
- [`officeparser`](https://github.com/harshankur/officeParser) (Giấy phép MIT): Trích xuất văn bản dự phòng cho các tệp Office/OpenDocument bất thường.

---

## Liên kết & Tài liệu
[VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=the-long-ride.markdown-them) 
| [Open VSX](https://open-vsx.org/extension/the-long-ride/markdown-them) 
| [Kho lưu trữ GitHub](https://github.com/the-long-ride/markdown-them) 
| [Nhật ký thay đổi](https://github.com/the-long-ride/markdown-them/blob/main/CHANGELOG.md) 
| [Hướng dẫn đóng góp](https://github.com/the-long-ride/markdown-them/blob/main/GUIDELINE.md)

## Giấy phép sử dụng
[MIT (Có giới hạn về việc sử dụng Theme)](https://github.com/the-long-ride/markdown-them/blob/main/LICENSE)
