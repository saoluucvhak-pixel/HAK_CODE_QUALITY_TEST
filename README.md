# HAK Code Quality Test — v0.2.0

Bộ công cụ CLI phân tích chất lượng mã nguồn, bảo mật cơ bản và kiến trúc cho các dự án HAK (Electron, Google Apps Script, Node, skill AI). Chạy offline với Node.js 18+, không cần cài thêm gói.

## Chạy nhanh

```bash
node bin/hak-quality.js /duong/dan/du-an --out reports
node bin/hak-quality.js /duong/dan/du-an --out reports --fail-on error   # dùng trong CI
```

Kết quả:
- `reports/quality-report.json`: báo cáo máy đọc được (có `summary.errors`, `summary.warnings`, `byRule`).
- `reports/dashboard.html`: dashboard HTML tĩnh theo giao diện luxe HAK, có chế độ tối, mở offline.

Mã thoát: `0` đạt · `1` có phát hiện đạt ngưỡng `--fail-on` · `2` lỗi khi quét.
`--fail-on-findings` (cũ) tương đương `--fail-on info`.

## Các rule

| Rule | Mức | Bắt gì |
|---|---|---|
| `hardcoded-secret` | lỗi | Khóa Google/OpenAI/GitHub/Telegram/AWS, private key, `password = "..."` gán cứng. Báo cáo **không in giá trị** bí mật. |
| `electron-insecure-webpreferences` | lỗi / cảnh báo | `nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false`, `enableRemoteModule: true`; `sandbox: false` là cảnh báo |
| `unsafe-inner-html` | cảnh báo | `innerHTML`/`outerHTML` gán bằng dữ liệu động, `document.write` |
| `eval-usage` | cảnh báo | `eval(...)`, `new Function(...)` |
| `skill-missing-frontmatter` | lỗi | `SKILL.md` thiếu khối `--- name / description ---` (Claude sẽ không nhận skill) |
| `skill-name-mismatch` | cảnh báo | `name` khác tên thư mục skill |
| `skill-weak-description` | cảnh báo / lỗi | `description` quá ngắn (< 60 ký tự) hoặc quá dài (> 1024) |
| `skill-missing-section` | cảnh báo | Skill `hak-*` thiếu mục chuẩn (Mục đích, Khi dùng, Đầu vào, Quy trình, Đầu ra, Kiểm thử, Ràng buộc) |
| `unpinned-plugin` | cảnh báo | `.mcp.json` / `.claude/settings.json` chạy MCP bằng `npx`/`uvx` không ghim phiên bản |
| `debugger` | cảnh báo | Còn câu lệnh `debugger` |
| `long-file` | cảnh báo | File code dài hơn `maxLines` (mặc định 1000; không áp dụng cho JSON) |
| `duplicate-file` | cảnh báo | Hai file nội dung trùng y hệt |
| `dependency-cycle` | cảnh báo | Vòng phụ thuộc import/require |
| `oversized-file` | cảnh báo | File vượt giới hạn dung lượng quét |
| `unresolved-import` | thông tin | Import tương đối không tìm thấy file |

File được quét: `.js .cjs .mjs .jsx .ts .tsx .gs .json .css .html .htm .py .go` và mọi `SKILL.md`.

## Cấu hình theo dự án

Đặt `.hakquality.json` ở thư mục gốc dự án (mẫu: `.hakquality.example.json`):

```json
{
  "exclude": ["vendor", "LuongHAK_Offline/libs"],
  "maxLines": 1200,
  "disable": ["unresolved-import"],
  "severity": { "unsafe-inner-html": "error" }
}
```

Bỏ qua một dòng có chủ đích: thêm chú thích `hak-quality-ignore <rule>` ngay trên dòng đó (vd. `// hak-quality-ignore eval-usage`). Không ghi tên rule thì bỏ qua mọi rule trên dòng đó — nên tránh.

## Dùng cùng HAK_AI_SKILLS

Skill `hak-code-auditor` và `hak-electron-security` bắt Claude chạy công cụ này trước khi báo một thay đổi là xong. Skill `hak-task-observer` dùng các rule `skill-*` để kiểm tra skill mới trước khi đưa vào kho.

## Giới hạn

Đây là bộ phân tích tĩnh theo dòng, **không thay thế ESLint, TypeScript compiler, kiểm thử nghiệp vụ hoặc kiểm toán bảo mật**. Nhận dạng bằng biểu thức chính quy nên có thể bỏ sót (bí mật bị tách nhiều dòng, mã đã nén) hoặc báo nhầm. Không tự động sửa mã nguồn. Không quét file nhị phân hoặc thư mục phụ thuộc.

## Quy tắc dữ liệu

Không đưa dữ liệu nhân sự, mật khẩu, chứng từ hoặc thông tin lương vào repository công khai. Báo cáo có đường dẫn tương đối và mô tả lỗi; kiểm tra trước khi chia sẻ.

## Kế hoạch

1. Observer runtime có cơ chế đồng ý rõ ràng và ẩn dữ liệu nhạy cảm.
2. Dashboard so sánh lịch sử CI, xu hướng lỗi.
3. Rule tính tiền bằng số thực (`0.1 + 0.2`) trong code lương/kế toán.
