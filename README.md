# HAK Code Quality Test — v0.3.0

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

## Bản chuẩn duy nhất

Từ v0.3.0, repo này là **bản chuẩn** của HAK Code Quality. Bản Python từng phát triển song song trong `LUONG_HAK` (các nhánh `feature/hak-code-quality-*`, `feature/hak-quality-*`, `feature/hak-observer-memory-v1`, `feature/hak-architecture-analyzer-v1`, `feature/hak-dashboard-auto-json-v3-2` — commit `a19ad8a`) đã được gộp vào đây bằng JavaScript, không cần cài Python hay thư viện:

| Bản Python | Ở đây |
|---|---|
| `audit.py`, `security_audit.py` | `hak-quality scan` — đủ các rule cũ (mật khẩu, eval/exec, innerHTML, `verify=False`, `shell=True`, `except:` trống) và nhiều rule hơn |
| `quality_gate.py` | `hak-quality gate` — chạy lệnh thật, argv không qua shell, có timeout |
| `architecture_analyzer.py` | `hak-quality scan` — đồ thị import JS **và Python**, vòng phụ thuộc, `--changed` để biết file nào bị ảnh hưởng |
| `observer.py`, `project_memory.py`, `ci_observer.py` | `hak-quality memory` — bộ nhớ theo commit, đề xuất skill khi lỗi lặp ở ≥ 3 commit |
| `dashboard/history.html`, `auto.html`, `serve.py` | `hak-quality history` — một trang HTML tĩnh, **không cần chạy máy chủ** |

Các nhánh Python trong LUONG_HAK nên dừng phát triển và trỏ về repo này.

## Bốn lệnh

```bash
# 1. Quét tĩnh (mặc định)
hak-quality ./du-an --out reports --fail-on error
hak-quality ./du-an --changed core/payroll.js        # thêm danh sách file bị ảnh hưởng

# 2. Cổng chất lượng: chạy test/lint/build đã khai báo, chỉ "đạt" khi mọi lệnh thật sự chạy xong và thành công
hak-quality gate --config hak-gate.json --out reports/hak-quality-results.json --commit $SHA --branch main

# 3. Bộ nhớ chất lượng + đề xuất skill (chỉ đề xuất, cần người duyệt)
hak-quality memory --memory .hak/quality-memory.jsonl --project LUONG_HAK --branch main --commit $SHA \
  --scan reports/quality-report.json --gate reports/hak-quality-results.json --out reports/hak-skill-proposals.json

# 4. Lịch sử nhiều lần chạy
hak-quality history runs/*/quality-report.json runs/*/hak-quality-results.json --out history.html
```

`hak-gate.json` (ví dụ chính repo này dùng):
```json
{ "project": "HAK_CODE_QUALITY_TEST",
  "checks": [ { "name": "Unit test", "command": ["npm", "test"], "timeoutSeconds": 120 } ] }
```
Lệnh **phải là mảng** (`["npm","test"]`), không nhận chuỗi shell như `"npm test && ..."`.

Bộ nhớ chỉ lưu: dự án, nhánh, commit, nhóm lỗi, tên test, trạng thái — **không** lưu mã nguồn, nội dung lỗi hay dữ liệu cá nhân.

## Các rule

| Rule | Mức | Bắt gì |
|---|---|---|
| `hardcoded-secret` | lỗi | Khóa Google/OpenAI/GitHub/Telegram/AWS, private key, `password = "..."` gán cứng. Báo cáo **không in giá trị** bí mật. |
| `electron-insecure-webpreferences` | lỗi / cảnh báo | `nodeIntegration: true`, `contextIsolation: false`, `webSecurity: false`, `enableRemoteModule: true`; `sandbox: false` là cảnh báo |
| `unsafe-inner-html` | cảnh báo | `innerHTML`/`outerHTML` gán bằng dữ liệu động, `document.write` |
| `eval-usage` | cảnh báo | `eval(...)`, `new Function(...)`; Python `eval`/`exec` |
| `tls-verify-disabled` | lỗi | Python `verify=False`, Node `rejectUnauthorized: false`, `NODE_TLS_REJECT_UNAUTHORIZED=0` |
| `shell-injection-risk` | cảnh báo | Python `shell=True`; Node `exec()` với chuỗi ghép |
| `bare-except` | cảnh báo | Python `except:` trống |
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

1. Rule tính tiền bằng số thực (`0.1 + 0.2`) trong code lương/kế toán.
2. Đọc lịch sử trực tiếp từ artifact GitHub Actions (hiện phải tải về rồi chạy `history`).
