# HAK Code Quality — quality gates (dự thảo)

## Code Quality
- Chạy đúng test/lint/build script hiện có của từng repository.
- Không chấp nhận regression trong các bài test quan trọng.
- Báo cáo số test pass/fail/skip và commit SHA được kiểm tra.

## Architecture Analyzer
- Liệt kê entry points, module boundaries, import graph và vòng phụ thuộc.
- Kiểm tra coupling giữa UI, nghiệp vụ và persistence.

## Observer
- Ghi nhận lỗi có thể tái hiện, thời gian thao tác và tài nguyên sử dụng bằng dữ liệu tổng hợp.
- Không thu thập mật khẩu, thông tin nhân sự hoặc dữ liệu lương nhạy cảm.

## Dashboard
- Tổng hợp build, test, lint, độ bao phủ nếu đo được, và lỗi theo P0/P1/P2.
- Mỗi chỉ số phải có nguồn đo và thời điểm đo; không tự tạo số liệu.

## Ngưỡng đề xuất
- CI của mọi repo HAK: `hak-quality . --fail-on error` — không cho merge khi còn lỗi (bí mật trong code, Electron không an toàn, skill thiếu khai báo).
- Trước phát hành: xem hết cảnh báo; cảnh báo được giữ lại phải có `hak-quality-ignore <rule>` kèm lý do.

## Trạng thái
- Đã có (v0.2.0): analyzer tĩnh, rule bảo mật cơ bản, rule skill, cấu hình `.hakquality.json`, dashboard HTML.
- Chưa có: observer runtime, lịch sử xu hướng, độ bao phủ test.
