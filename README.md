# HAK Code Quality Test — v0.2.0

CLI phân tích tĩnh chất lượng mã và liên kết Apps Script, chạy bằng Node.js 18+.

## Chạy

```bash
npm ci
npm test
npm run check
node bin/hak-quality.js /path/to/project --out reports
```

Cài phụ thuộc từ package-lock.json một lần; sau đó scanner chạy offline, không gửi mã nguồn hoặc gọi Google. Scanner không chạy mã trong repo đích, không triển khai và không sửa mã đó. Báo cáo được ghi vào thư mục `--out` (mặc định `reports` trong thư mục làm việc hiện tại).

## Đã hỗ trợ

- Acorn AST: cú pháp JavaScript/.gs, debugger thật, import/require/re-export/dynamic import có chuỗi đường dẫn tương đối. Không nhận nhầm chuỗi/comment là code.
- File dài, file quá lớn, file trùng toàn bộ nội dung bằng SHA-256; đồ thị và vòng phụ thuộc import.
- Apps Script: `.gs`, JavaScript trong HTML, scriptlet include và `HtmlService.createTemplateFromFile/createHtmlOutputFromFile` có tên tĩnh.
- Liên kết `google.script.run.withSuccessHandler(...).tenHam(...)` tới khai báo hàm máy chủ; hàm đuôi `_` không được gọi trực tiếp qua RPC.
- Hàm gọi trực tiếp trong thuộc tính sự kiện HTML như `onclick="luu()"`; tra cứu khai báo JavaScript trên toàn dự án.
- Tên động, file không phân tích được, ngôn ngữ chưa hỗ trợ và script ngoài được liệt kê để rà thủ công.

## Cấu hình theo repo

Đặt `.hakquality.json` tại gốc repo cần quét; xem `.hakquality.example.json` để bắt đầu.

- `maxFiles`: số file ứng viên tối đa; `maxBytes`: giới hạn mỗi file; `maxLines`: ngưỡng cảnh báo file dài.
- `exclude`: tên thư mục/file hoặc đường dẫn tương đối chính xác; không phải glob. Mặc định luôn loại `.git`, `node_modules`, `dist`, `build`, `coverage`, `reports`, `.next`, `.cache`; không đi theo symlink.
- `rules`: mức `off`, `info`, `warning`, `error`. Các rule: `long-file`, `oversized-file`, `duplicate-file`, `debugger`, `dependency-cycle`, `syntax`, `missing-include`, `missing-server-function`, `missing-handler`.
- `failOn`: `error` (mặc định), `warning` (chặn cả warning/error), `never` (chỉ báo cáo).
- `appsScript.enabled`: bật/tắt nhóm kiểm tra Apps Script và HTML.
- `appsScript.rpcFactories`: các hàm wrapper đã được người dùng xác nhận có cùng giao diện với google.script.run; ví dụ `["hakRun_"]` cho hosovay_hak. Scanner không tự chứng minh wrapper này bảo toàn cơ chế RPC.
- `appsScript.clientGlobals`, `serverGlobals`: tên được cung cấp bên ngoài dự án. Chỉ thêm sau khi xác minh; khai báo ở đây khiến tên đó được coi là có sẵn.

Cấu hình sai/khóa lạ bị từ chối để tránh âm thầm bỏ qua kiểm tra. Các tùy chọn trực tiếp khi gọi `scan(root, options)` ghi đè cấu hình; object `rules` và `appsScript` được gộp từng khóa.

## CI và mã thoát

```bash
node bin/hak-quality.js /path/to/project --out reports --fail-on warning
node bin/hak-quality.js /path/to/project --fail-on-findings
```

- `0`: vượt qua ngưỡng chặn được cấu hình; có thể vẫn có cảnh báo, lỗi bị đổi mức hoặc phần chưa kiểm tra.
- `1`: bị chặn theo `failOn`; cờ cũ `--fail-on-findings` chặn mọi finding, kể cả `info`.
- `2`: không chạy được, cấu hình hoặc tham số không hợp lệ.

Thay đổi so với v0.1: lỗi mức error mặc định chặn CI; không còn luôn thành công nếu có lỗi cú pháp/liên kết máy chủ. `summary.status` thể hiện phát hiện tĩnh; `gate` thể hiện chính sách CI. Hai thông tin này độc lập (ví dụ `failOn: never` có thể cho gate PASS dù status FAIL).

## Báo cáo

- `quality-report.json`, schemaVersion 2: giữ các trường cũ, bổ sung số error/warning/info, gate, coverage, liên kết Apps Script, unresolved và limitations.
- `dashboard.html`: hiển thị kết quả, phần bỏ qua/chưa phân tích được, tham chiếu cần rà thủ công và các giới hạn. Không có điểm số chất lượng suy diễn.

## Giới hạn cần hiểu

Đây chưa phải kiểm toán bảo mật, hệ thống kiểm thử nghiệp vụ hoặc Observer runtime. Không chạy test của repo đích. Không kiểm tra quyền truy cập, bí mật, tên Sheet/cột hay tính đúng của dữ liệu tài chính.

JavaScript/.gs dùng AST; TypeScript/JSX/Python/Go hiện chỉ thống kê kích thước/dòng/trùng file và được ghi là chưa kiểm cú pháp. Không resolve package import, alias, TS paths hoặc toàn bộ cơ chế module của bundler.

HTML được trích script/thuộc tính theo cú pháp HTML thông thường; chưa dùng parser framework. Chỉ đối chiếu tên toàn dự án, không chứng minh script đã được include vào đúng trang, thứ tự tải hoặc điều kiện khai báo. Không phân tích mọi lời gọi hàm JavaScript tự do, gọi động qua biến, dispatcher `api(...)`, các handler đăng ký bằng framework hoặc nội dung script ngoài. Một số dạng được ghi unresolved, nhưng không có unresolved cũng không có nghĩa đã kiểm hết chương trình.

Báo cáo có đường dẫn tương đối và mô tả lỗi. Kiểm tra nội dung trước khi chia sẻ công khai.
