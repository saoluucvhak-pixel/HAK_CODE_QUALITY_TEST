# HAK Code Quality Test — v0.1.0

Bộ công cụ CLI phân tích chất lượng mã nguồn và kiến trúc, chạy offline với Node.js 18+.

## Chạy nhanh

```bash
npm test
npm run check
node bin/hak-quality.js /path/to/project --out reports
```

Kết quả:
- `reports/quality-report.json`: báo cáo máy đọc được.
- `reports/dashboard.html`: dashboard HTML tĩnh, mở offline.

Thêm `--fail-on-findings` để trả exit code 1 khi có cảnh báo.

## Các thành phần hiện có

- **Code Quality:** phát hiện `debugger`, file quá dài, file trùng nội dung và file quá lớn.
- **Architecture Analyzer:** nhận dạng import/require tương đối, đồ thị phụ thuộc và vòng phụ thuộc.
- **Observer:** hiện mới là số liệu tổng hợp của mỗi lần scan; chưa có agent theo dõi runtime.
- **Dashboard:** báo cáo HTML tĩnh, không cần server.
- **CI:** chạy Node.js 18/20/22 và upload JSON/HTML dưới dạng artifacts.

## Giới hạn

Đây là bộ phân tích tĩnh mức cơ bản, **không thay thế ESLint, TypeScript compiler, kiểm thử nghiệp vụ hoặc kiểm toán bảo mật**. Nhận dạng import bằng biểu thức chính quy, có thể bỏ sót hoặc báo sai trong mã phức tạp. Không tự động sửa mã nguồn. Không quét file nhị phân hoặc thư mục phụ thuộc mặc định.

## Quy tắc dữ liệu

Không đưa dữ liệu nhân sự, mật khẩu, chứng từ hoặc thông tin lương vào repository công khai. Báo cáo có đường dẫn tương đối và đoạn mô tả lỗi; cần kiểm tra trước khi chia sẻ.

## Kế hoạch

1. Hoàn thiện bộ rule và cấu hình per-project.
2. Observer runtime có cơ chế đồng ý rõ ràng và ẩn dữ liệu nhạy cảm.
3. Dashboard so sánh lịch sử CI, xu hướng lỗi và hiệu năng.
4. Tích hợp các skill trong `HAK_AI_SKILLS`.
